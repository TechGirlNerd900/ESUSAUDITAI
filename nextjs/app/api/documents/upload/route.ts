import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { SecurityService } from '@/lib/security';
import { authenticateApiRequest } from '@/lib/apiAuth';

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function sanitizeFileName(name: string): string {
  // Remove path traversal and unsafe characters
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // SECURITY: Multi-step operations require careful error handling
    // PostgreSQL transactions are handled implicitly by Supabase client
    // We implement compensating transactions for failure scenarios

    // SECURITY: Authenticate with proper role-based access and rate limiting
    const auth = await authenticateApiRequest(request, {
      requireRole: 'auditor', // Only auditors and admins can upload files
      rateLimit: 20, // Limit to 20 file uploads per 15 minutes
    });

    if (!auth.success) {
      return auth.response;
    }

    const { user, profile: userProfile } = auth;

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const customFieldsRaw = formData.get('custom_fields') as string | null;
    const tagsRaw = formData.get('tags') as string | null;

    let custom_fields = {};
    let tags: string[] = [];
    try {
      if (customFieldsRaw) custom_fields = JSON.parse(customFieldsRaw);
      if (tagsRaw) tags = JSON.parse(tagsRaw);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid custom_fields or tags format (must be JSON)' },
        { status: 400 }
      );
    }

    if (!file || !projectId) {
      return NextResponse.json({ error: 'File and project ID are required' }, { status: 400 });
    }

    // SECURITY: Initialize SecurityService for enhanced file validation
    const securityService = new SecurityService({
      getAll: () => [],
      setAll: () => {},
    });

    // SECURITY: Comprehensive file validation using SecurityService
    const fileValidation = securityService.validateFileUpload(
      {
        mimetype: file.type,
        size: file.size,
      },
      50
    );

    if (!fileValidation.valid) {
      return NextResponse.json({ error: fileValidation.error }, { status: 400 });
    }

    // SECURITY: Additional file content inspection
    const fileBuffer = await file.arrayBuffer();
    const fileContent = new Uint8Array(fileBuffer);

    // Check for common malicious file signatures
    const maliciousSignatures = [
      [0x4d, 0x5a], // PE/EXE header
      [0x7f, 0x45, 0x4c, 0x46], // ELF header
      [0xca, 0xfe, 0xba, 0xbe], // Java class file
      [0x50, 0x4b, 0x03, 0x04], // ZIP/JAR (could contain malicious content)
    ];

    for (const signature of maliciousSignatures) {
      if (fileContent.length >= signature.length) {
        const matches = signature.every((byte, index) => fileContent[index] === byte);
        if (
          matches &&
          file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
          file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ) {
          return NextResponse.json(
            {
              error: 'File contains potentially malicious content',
            },
            { status: 400 }
          );
        }
      }
    }

    // SECURITY: Validate file extension matches MIME type
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const mimeToExtension: { [key: string]: string[] } = {
      'application/pdf': ['pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
      'application/msword': ['doc'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
      'application/vnd.ms-excel': ['xls'],
      'text/csv': ['csv'],
    };

    const expectedExtensions = mimeToExtension[file.type];
    if (!expectedExtensions || !expectedExtensions.includes(fileExtension || '')) {
      return NextResponse.json(
        {
          error: 'File extension does not match MIME type',
        },
        { status: 400 }
      );
    }

    // Fetch project and check org
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('organization_id, assigned_to, created_by, deleted_at')
      .eq('id', projectId)
      .single();
    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project.deleted_at) {
      return NextResponse.json({ error: 'Cannot upload to archived project' }, { status: 400 });
    }
    if (project.organization_id !== userProfile.organization_id) {
      return NextResponse.json({ error: 'Cross-organization upload denied' }, { status: 403 });
    }
    // Only allow if user is admin, project creator, or assigned
    if (
      userProfile.role !== 'admin' &&
      project.created_by !== user.id &&
      !(project.assigned_to && project.assigned_to.includes(user.id))
    ) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Sanitize filename
    const sanitizedFileName = sanitizeFileName(file.name);
    const timestamp = new Date().getTime();
    const fileName = `${timestamp}-${sanitizedFileName}`;
    const filePath = `${user.id}/${projectId}/${fileName}`;

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      // Compensating transaction: file upload failed, no cleanup needed
      return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 });
    }

    // Note: No longer using public URLs for security - files accessed via secure download endpoint
    // const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

    // Create document record in the database
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        name: sanitizedFileName,
        original_name: file.name,
        file_path: filePath,
        project_id: projectId,
        organization_id: userProfile.organization_id, // CRITICAL: Add organization_id for multi-tenant isolation
        status: 'uploaded',
        uploaded_by: user.id,
        file_type: file.type,
        file_size: file.size,
        blob_url: null, // Security: No public URLs - use secure download endpoint
        classification: 'internal',
        sensitivity_level: 'medium',
        access_level: 'internal',
        processing_status: 'pending',
        custom_fields,
        tags,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Compensating transaction: delete the uploaded file since DB insert failed
      await supabase.storage.from('documents').remove([filePath]);
      return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 });
    }

    // All operations completed successfully - no explicit commit needed
    // PostgreSQL automatically commits single operations

    // SECURITY: Create audit log entry for file upload
    await supabase.from('audit_logs').insert({
      organization_id: userProfile.organization_id,
      user_id: userProfile.id,
      action: 'file_upload',
      resource_type: 'document',
      resource_id: document.id,
      details: {
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        project_id: projectId,
        upload_path: filePath,
        ip_address:
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // SECURITY: Create data access log for compliance tracking
    await supabase.from('data_access_logs').insert({
      user_id: user.id,
      organization_id: userProfile.organization_id,
      resource_type: 'document',
      resource_id: document.id,
      action: 'upload',
      access_method: 'api',
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('remote-addr'),
      user_agent: request.headers.get('user-agent'),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      message: 'Document uploaded successfully',
      document,
    });
  } catch (error) {
    console.error('Upload error:', error);

    try {
      // Attempt compensating transaction cleanup
      const supabase = await createClient();

      // Clean up any uploaded files that might exist
      // Note: filePath is not available in this scope, so we can't clean up specific files
      // This is a limitation of the current error handling structure
    } catch (cleanupError) {
      console.error('Error during error cleanup:', cleanupError);
    }

    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
