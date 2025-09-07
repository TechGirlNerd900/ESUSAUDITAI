import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/auth/apiAuth';
import { withErrorHandling } from '@/lib/errorHandler';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role for file access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Secure file download endpoint with access control
 * Validates user permissions before allowing file access
 */
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const { id: documentId } = params;

    // Authenticate user and validate rate limiting
    const auth = await authenticateApiRequest(request, {
      rateLimit: 100, // 100 downloads per 15 minutes
      requireRole: 'reviewer', // Minimum role for file access
    });

    if (!auth.success) {
      return auth.response;
    }

    const { user, profile: userProfile } = auth;

    try {
      // Get document metadata with organization validation
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select(
          `
        id,
        name,
        original_name,
        file_path,
        file_type,
        file_size,
        organization_id,
        project_id,
        access_level,
        sensitivity_level,
        classification,
        created_at,
        updated_by,
        projects!inner(
          id,
          name,
          organization_id,
          status
        )
      `
        )
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }

      // Validate multi-tenant access
      if (document.organization_id !== userProfile.organization_id) {
        await supabase.from('audit_logs').insert({
          organization_id: userProfile.organization_id,
          user_id: user.id,
          action: 'unauthorized_file_access_attempted',
          resource_type: 'document',
          resource_id: documentId,
          details: {
            attempted_document_org: document.organization_id,
            user_org: userProfile.organization_id,
            document_name: document.name,
            ip_address:
              request.headers.get('x-forwarded-for') || request.headers.get('remote-addr'),
            user_agent: request.headers.get('user-agent'),
          },
          severity: 'high',
          created_at: new Date().toISOString(),
        });

        return NextResponse.json(
          { error: 'Access denied: Cross-tenant access not allowed' },
          { status: 403 }
        );
      }

      // Check project access if document is linked to a project
      if (document.project_id && document.projects) {
        const project = Array.isArray(document.projects) ? document.projects[0] : document.projects;
        if (project && project.organization_id !== userProfile.organization_id) {
          return NextResponse.json(
            { error: 'Access denied: Project access not allowed' },
            { status: 403 }
          );
        }
      }

      // Role-based access control
      const hasAccess = await validateDocumentAccess(document, userProfile);
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied: Insufficient permissions' },
          { status: 403 }
        );
      }

      // Generate secure signed URL with expiration
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_path, 3600); // 1 hour expiration

      if (signedUrlError || !signedUrlData) {
        console.error('Error generating signed URL:', signedUrlError);
        return NextResponse.json(
          { error: 'Failed to generate secure download link' },
          { status: 500 }
        );
      }

      // Log successful file access
      await supabase.from('audit_logs').insert({
        organization_id: userProfile.organization_id,
        user_id: user.id,
        action: 'document_downloaded',
        resource_type: 'document',
        resource_id: documentId,
        details: {
          document_name: document.name,
          file_type: document.file_type,
          file_size: document.file_size,
          project_id: document.project_id,
          access_level: document.access_level,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('remote-addr'),
          user_agent: request.headers.get('user-agent'),
        },
        created_at: new Date().toISOString(),
      });

      // Create data access log for compliance tracking
      await supabase.from('data_access_logs').insert({
        user_id: user.id,
        organization_id: userProfile.organization_id,
        resource_type: 'document',
        resource_id: documentId,
        action: 'download',
        access_method: 'api',
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('remote-addr'),
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
      });

      // Return secure download information
      return NextResponse.json({
        downloadUrl: signedUrlData.signedUrl,
        document: {
          id: document.id,
          name: document.name,
          originalName: document.original_name,
          fileType: document.file_type,
          fileSize: document.file_size,
          classification: document.classification,
          sensitivityLevel: document.sensitivity_level,
          accessLevel: document.access_level,
          createdAt: document.created_at,
        },
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        security: {
          accessGranted: true,
          organizationValidated: true,
          roleValidated: true,
          logged: true,
        },
      });
    } catch (error) {
      console.error('File download error:', error);

      // Log security event
      await supabase.from('security_events').insert({
        organization_id: userProfile.organization_id,
        user_id: user.id,
        event_type: 'file_download_error',
        severity: 'medium',
        details: {
          document_id: documentId,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('remote-addr'),
          user_agent: request.headers.get('user-agent'),
        },
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        { error: 'Internal server error during file access' },
        { status: 500 }
      );
    }
  }
);

/**
 * Validate document access based on user role and document sensitivity
 */
async function validateDocumentAccess(document: any, userProfile: any): Promise<boolean> {
  const { role } = userProfile;
  const { access_level } = document;

  // Admin has full access
  if (role === 'admin') {
    return true;
  }

  // Auditor access rules
  if (role === 'auditor') {
    // Can access internal and restricted documents
    if (access_level === 'public' || access_level === 'internal' || access_level === 'restricted') {
      return true;
    }
    // Cannot access confidential documents
    if (access_level === 'confidential') {
      return false;
    }
  }

  // Reviewer access rules
  if (role === 'reviewer') {
    // Can only access public and internal documents
    if (access_level === 'public' || access_level === 'internal') {
      return true;
    }
    // Cannot access restricted or confidential documents
    return false;
  }

  // Default deny
  return false;
}

// OPTIONS handler for CORS
export async function OPTIONS(_request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
