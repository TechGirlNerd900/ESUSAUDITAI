import { createClient } from '@/utils/supabase/server'
import { analyzeDocument } from '@/lib/openaiClient'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', params.id)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check if user has access to this document's project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', document.project_id)
      .single()

    if (projectError || !project || project.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Download document content from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path)

    if (downloadError) {
      throw downloadError
    }

    // Convert file to text
    const text = await fileData.text()

    // Analyze document using OpenAI
    const analysisResults = await analyzeDocument(text)

    // Update document with analysis results
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        analysis_results: analysisResults,
        status: 'analyzed',
        analyzed_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (updateError) {
      throw updateError
    }

    // Fetch updated document
    const { data: updatedDocument } = await supabase
      .from('documents')
      .select('*')
      .eq('id', params.id)
      .single()

    return NextResponse.json({
      message: 'Document analyzed successfully',
      document: updatedDocument
    })

  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze document' },
      { status: 500 }
    )
  }
}