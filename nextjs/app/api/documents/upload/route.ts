import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'


export async function POST(request: NextRequest) {
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

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string

    if (!file || !projectId) {
      return NextResponse.json(
        { error: 'File and project ID are required' },
        { status: 400 }
      )
    }

    // Generate a unique filename
    const timestamp = new Date().getTime()
    const fileName = `${timestamp}-${file.name}`
    const filePath = `${user.id}/${projectId}/${fileName}`

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('audit-documents')
      .upload(filePath, file)

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError
    }

    // Get the public URL of the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('audit-documents')
      .getPublicUrl(filePath)

    // Create document record in the database
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        original_name: file.name,
        file_path: filePath,
        project_id: projectId,
        status: 'uploaded',
        uploaded_by: user.id,
        file_type: file.type,
        file_size: file.size,
        blob_url: publicUrl
      })
      .select()
      .single()

    if (dbError) {
      throw dbError
    }

    return NextResponse.json({
      message: 'Document uploaded successfully',
      document
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}