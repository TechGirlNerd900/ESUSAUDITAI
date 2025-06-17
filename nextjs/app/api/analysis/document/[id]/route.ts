import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { AzureServices } from '@/lib/azureServices'
import { openai } from '@/lib/openaiClient'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params since they're now a Promise in newer Next.js versions
    const { id: documentId } = await params
    
    const supabase = await createClient()

    // Check if user is authenticated
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select(`
        *,
        projects!inner(id, created_by, assigned_to)
      `)
      .eq('id', documentId)
      .single()

    if (docError) {
      console.error('Document fetch error:', docError)
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check access to project
    const project = document.projects
    const hasAccess = 
      project.created_by === user.id || 
      (project.assigned_to && project.assigned_to.includes(user.id))

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if analysis already exists and is recent
    const { data: existingAnalysis, error: analysisCheckError } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('document_id', documentId)
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
            extracted_data: documentAnalysis,
            ai_summary: aiSummary,
            red_flags: extractRedFlags(aiSummary),
            highlights: extractHighlights(aiSummary),
            confidence_score: confidence,
            processing_time_ms: Date.now() - startTime,
          },
        ])
        .select()
        .single()

      if (analysisError) {
        console.error('Analysis save error:', analysisError)
        throw new Error('Failed to save analysis results: ' + analysisError.message)
      }

      // Update document status to analyzed
      const { error: finalStatusError } = await supabase
        .from('documents')
        .update({ status: 'analyzed' })
        .eq('id', documentId)

      if (finalStatusError) {
        console.error('Final status update error:', finalStatusError)
      }

      return NextResponse.json({ 
        analysis: analysisResult,
        message: 'Document analyzed successfully' 
      })

    } catch (analysisError) {
      console.error('Analysis processing error:', analysisError)
      
      // Update document status to error
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