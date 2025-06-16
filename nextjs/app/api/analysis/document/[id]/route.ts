import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { AzureServices } from '@/lib/azureServices'
import { openai } from '@/lib/openaiClient'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const documentId = params.id

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select(`
        *,
        projects!inner(id, created_by, assigned_to)
      `)
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check access to project
    const project = document.projects
    const hasAccess = 
      project.created_by === user.id || 
      project.assigned_to?.includes(user.id)

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if analysis already exists and is recent
    const { data: existingAnalysis } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingAnalysis && existingAnalysis.length > 0) {
      return NextResponse.json({ 
        analysis: existingAnalysis[0],
        message: 'Analysis already exists' 
      })
    }

    // Update document status to processing
    await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId)

    // Initialize Azure services
    const cookieStore = {
      getAll: () => [],
      setAll: () => {}
    }
    const azureServices = new AzureServices(cookieStore)

    const startTime = Date.now()

    try {
      // Analyze document with Azure Document Intelligence
      const documentAnalysis = await azureServices.analyzeDocument(
        document.blob_url,
        'prebuilt-document'
      )

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

      const aiSummary = completion.choices[0]?.message?.content || 'Analysis completed'

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
        throw analysisError
      }

      // Update document status to analyzed
      await supabase
        .from('documents')
        .update({ status: 'analyzed' })
        .eq('id', documentId)

      return NextResponse.json({ 
        analysis: analysisResult,
        message: 'Document analyzed successfully' 
      })

    } catch (analysisError) {
      console.error('Analysis error:', analysisError)
      
      // Update document status to error
      await supabase
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId)

      return NextResponse.json(
        { error: 'Analysis failed', details: analysisError.message },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Document analysis error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function calculateConfidenceScore(analysisData: any): number {
  // Simple confidence calculation based on data completeness
  let score = 0.5 // Base score
  
  if (analysisData.tables && analysisData.tables.length > 0) score += 0.2
  if (analysisData.keyValuePairs && Object.keys(analysisData.keyValuePairs).length > 0) score += 0.2
  if (analysisData.content && analysisData.content.length > 100) score += 0.1
  
  return Math.min(score, 1.0)
}

function extractRedFlags(summary: string): string[] {
  const redFlags = []
  const lowerSummary = summary.toLowerCase()
  
  if (lowerSummary.includes('discrepanc')) redFlags.push('Potential discrepancies detected')
  if (lowerSummary.includes('inconsisten')) redFlags.push('Inconsistencies found')
  if (lowerSummary.includes('unusual')) redFlags.push('Unusual patterns identified')
  if (lowerSummary.includes('concern')) redFlags.push('Areas of concern noted')
  
  return redFlags
}

function extractHighlights(summary: string): string[] {
  const highlights = []
  const sentences = summary.split(/[.!?]+/)
  
  // Extract sentences that seem like key insights
  for (const sentence of sentences) {
    if (sentence.length > 20 && 
        (sentence.toLowerCase().includes('key') || 
         sentence.toLowerCase().includes('important') ||
         sentence.toLowerCase().includes('significant'))) {
      highlights.push(sentence.trim())
    }
  }
  
  return highlights.slice(0, 5) // Limit to 5 highlights
}