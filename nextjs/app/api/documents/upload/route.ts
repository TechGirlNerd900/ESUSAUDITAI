import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
]
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

function sanitizeFileName(name: string): string {
  // Remove path traversal and unsafe characters
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

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

    // Fetch user's organization_id and role from users table
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()
    if (userError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
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

    // File validation
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, Word, Excel, and CSV files are allowed.' },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit.' },
        { status: 400 }
      )
    }

    // Fetch project and check org
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('organization_id, assigned_to, created_by')
      .eq('id', projectId)
      .single()
    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (project.organization_id !== userProfile.organization_id) {
      return NextResponse.json({ error: 'Cross-organization upload denied' }, { status: 403 })
    }
    // Only allow if user is admin, project creator, or assigned
    if (
      userProfile.role !== 'admin' &&
      project.created_by !== user.id &&
      !(project.assigned_to && project.assigned_to.includes(user.id))
    ) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Sanitize filename
    const sanitizedFileName = sanitizeFileName(file.name)
    const timestamp = new Date().getTime()
    const fileName = `${timestamp}-${sanitizedFileName}`
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