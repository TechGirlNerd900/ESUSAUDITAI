import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { AzureServices } from '@/lib/azureServices'
import { openai } from '@/lib/openaiClient'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Declare supabase and documentId outside try block for error handling access
  let supabase: Awaited<ReturnType<typeof createClient>>
  let documentId: string

  try {
    // Await params since they're now a Promise in newer Next.js versions
    const resolvedParams = await params
    documentId = resolvedParams.id
    
    supabase = await createClient()
    
    // Start a transaction
    const { error: txnError } = await supabase.rpc('begin_transaction')
    if (txnError) {
      console.error('Error starting transaction:', txnError)
      return NextResponse.json({ error: 'Failed to start transaction' }, { status: 500 })
    }

    // Check if user is authenticated
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user profile with organization_id for multi-tenant security
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
    }

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select(`
        *,
        projects!inner(id, created_by, assigned_to, deleted_at)
      `)
      .eq('id', documentId)
      .eq('deleted_at', null)
      .single()

    if (docError) {
      console.error('Document fetch error:', docError)
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (!document || document.projects.deleted_at) {
      return NextResponse.json({ error: 'Document or project not found or archived' }, { status: 404 })
    }

    // Validate organization access - CRITICAL for multi-tenant security
    if (document.organization_id !== userProfile.organization_id) {
      return NextResponse.json({ error: 'Cross-organization access denied' }, { status: 403 })
    }

    // Check access to project
    const project = document.projects
    const hasAccess = 
      userProfile.role === 'admin' ||
      project.created_by === user.id || 
      (project.assigned_to && project.assigned_to.includes(user.id))

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if analysis already exists and is recent - with organization filtering
    const { data: existingAnalysis, error: analysisCheckError } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('document_id', documentId)
      .eq('organization_id', userProfile.organization_id) // CRITICAL: Filter by organization
      .order('created_at', { ascending: false })
      .limit(1)

    if (analysisCheckError) {
      console.error('Analysis check error:', analysisCheckError)
    }

    if (existingAnalysis && existingAnalysis.length > 0) {
      return NextResponse.json({ 
        analysis: existingAnalysis[0],
        message: 'Analysis already exists' 
      })
    }

    // Validate document blob_url
    if (!document.blob_url) {
      return NextResponse.json({ 
        error: 'Document URL not available' 
      }, { status: 400 })
    }

    // Update document status to processing
    const { error: statusUpdateError } = await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId)

    if (statusUpdateError) {
      console.error('Status update error:', statusUpdateError)
    }

    // Initialize Azure services
    const cookieStore = {
      getAll: () => [],
      setAll: () => {}
    }
    
    let azureServices: AzureServices
    try {
      azureServices = new AzureServices(cookieStore)
    } catch (azureError) {
      console.error('Azure services initialization error:', azureError)
      
      // Rollback transaction
      const { error: rollbackError } = await supabase.rpc('rollback_transaction')
      if (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError)
      }
      
      // Update document status to error (outside transaction)
      await supabase
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId)
      
      return NextResponse.json(
        { error: 'Failed to initialize document analysis service' },
        { status: 500 }
      )
    }

    const startTime = Date.now()

    try {
      // Analyze document with Azure Document Intelligence
      let documentAnalysis
      try {
        documentAnalysis = await azureServices.analyzeDocument(
          document.blob_url,
          'prebuilt-document'
        )
      } catch (azureAnalysisError) {
        console.error('Azure document analysis error:', azureAnalysisError)
        throw new Error('Document analysis failed: ' + azureAnalysisError.message)
      }

      // Validate analysis results
      if (!documentAnalysis) {
        throw new Error('No analysis results received from Azure')
      }

      // Generate AI summary and insights using OpenAI
      const aiAnalysisPrompt = `
        Analyze this financial document data and provide:
        1. A comprehensive summary
        2. Key financial insights
        3. Potential red flags or areas of concern
        4. Important highlights
        
        Document Data:
        ${JSON.stringify(documentAnalysis, null, 2)}
      `

      let aiSummary: string
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are a financial auditing expert. Analyze the provided document data and provide detailed insights."
            },
            {
              role: "user", 
              content: aiAnalysisPrompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.3
        })

        aiSummary = completion.choices[0]?.message?.content || 'Analysis completed'
      } catch (openaiError) {
        console.error('OpenAI analysis error:', openaiError)
        aiSummary = 'AI analysis unavailable - using extracted data only'
      }

      // Calculate confidence score based on data completeness
      const confidence = calculateConfidenceScore(documentAnalysis)

      // Save analysis results
      const { data: analysisResult, error: analysisError } = await supabase
        .from('analysis_results')
        .insert([
          {
            document_id: documentId,
            organization_id: userProfile.organization_id, // CRITICAL: Add organization_id for multi-tenant isolation
            extracted_data: documentAnalysis,
            ai_summary: aiSummary,
            red_flags: extractRedFlags(aiSummary),
            highlights: extractHighlights(aiSummary),
            confidence_score: confidence,
            processing_time_ms: Date.now() - startTime,
            analysis_type: 'document_analysis',
            model_version: 'gpt-4-turbo',
            metadata: {
              file_type: document.file_type,
              file_size: document.file_size || null,
              processing_duration: Date.now() - startTime
            },
          },
        ])
        .select()
        .single()

      if (analysisError) {
        console.error('Analysis save error:', analysisError)
        // Rollback transaction if analysis save fails
        const { error: rollbackError } = await supabase.rpc('rollback_transaction')
        if (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError)
        }
        throw new Error('Failed to save analysis results: ' + analysisError.message)
      }

      // Update document status to analyzed
      const { error: finalStatusError } = await supabase
        .from('documents')
        .update({ status: 'analyzed' })
        .eq('id', documentId)

      if (finalStatusError) {
        console.error('Final status update error:', finalStatusError)
        // Rollback transaction if status update fails
        await supabase.rpc('rollback_transaction')
        return NextResponse.json({ error: 'Failed to update document status' }, { status: 500 })
      }
      
      // Commit the transaction after successful operations
      const { error: commitError } = await supabase.rpc('commit_transaction')
      if (commitError) {
        console.error('Error committing transaction:', commitError)
        // Even if commit fails, we don't want to roll back at this point
        // as the operations were successful
      }

      return NextResponse.json({ 
        analysis: analysisResult,
        message: 'Document analyzed successfully' 
      })

    } catch (analysisError) {
      console.error('Analysis processing error:', analysisError)
      
      // Rollback transaction
      const { error: rollbackError } = await supabase.rpc('rollback_transaction')
      if (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError)
      }
      
      // Update document status to error (outside transaction)
      await supabase
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId)

      return NextResponse.json(
        { 
          error: 'Analysis failed', 
          details: analysisError instanceof Error ? analysisError.message : 'Unknown analysis error'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Document analysis error:', error)
    
    try {
      // Attempt to rollback the transaction if supabase is available
      if (supabase) {
        await supabase.rpc('rollback_transaction')
      }
      
      // If we have a document ID and supabase client, update its status to error
      if (documentId && supabase) {
        await supabase 
          .from('documents')
          .update({ status: 'error' })
          .eq('id', documentId)
      }
    } catch (cleanupError) {
      console.error('Error during error cleanup:', cleanupError)
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function calculateConfidenceScore(analysisData: any): number {
  // Simple confidence calculation based on data completeness
  let score = 0.5 // Base score
  
  try {
    if (analysisData?.tables && analysisData.tables.length > 0) score += 0.2
    if (analysisData?.keyValuePairs && Object.keys(analysisData.keyValuePairs).length > 0) score += 0.2
    if (analysisData?.content && analysisData.content.length > 100) score += 0.1
  } catch (error) {
    console.error('Error calculating confidence score:', error)
  }
  
  return Math.min(score, 1.0)
}

function extractRedFlags(summary: string): string[] {
  if (!summary || typeof summary !== 'string') {
    return []
  }

  const redFlags = []
  const lowerSummary = summary.toLowerCase()
  
  try {
    if (lowerSummary.includes('discrepanc')) redFlags.push('Potential discrepancies detected')
    if (lowerSummary.includes('inconsisten')) redFlags.push('Inconsistencies found')
    if (lowerSummary.includes('unusual')) redFlags.push('Unusual patterns identified')
    if (lowerSummary.includes('concern')) redFlags.push('Areas of concern noted')
  } catch (error) {
    console.error('Error extracting red flags:', error)
  }
  
  return redFlags
}

function extractHighlights(summary: string): string[] {
  if (!summary || typeof summary !== 'string') {
    return []
  }

  const highlights = []
  
  try {
    const sentences = summary.split(/[.!?]+/)
    
    // Extract sentences that seem like key insights
    for (const sentence of sentences) {
      if (sentence && sentence.length > 20 && 
          (sentence.toLowerCase().includes('key') || 
           sentence.toLowerCase().includes('important') ||
           sentence.toLowerCase().includes('significant'))) {
        highlights.push(sentence.trim())
      }
    }
  } catch (error) {
    console.error('Error extracting highlights:', error)
  }
  
  return highlights.slice(0, 5) // Limit to 5 highlights
}