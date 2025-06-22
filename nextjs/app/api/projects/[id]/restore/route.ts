import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest, checkOrganizationAccess } from '@/lib/apiAuth';
import { withErrorHandling, NotFoundError, AuthorizationError } from '@/lib/errorHandler';

export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: { id: string } }
  ) => {
    const projectId = context.params.id;

    // Authenticate request
    const auth = await authenticateApiRequest(request);

    if (!auth.success) {
      return (auth as import('@/lib/apiAuth').AuthFailure).response;
    }

    const supabase = await createClient();

    // Get project to check access and organization
    const { data: project, error } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      throw new NotFoundError('Project');
    }

    // Check if user has access to this project's organization
    const hasAccess = await checkOrganizationAccess(
      supabase,
      auth.profile,
      project.organization_id
    );

    if (!hasAccess) {
      throw new AuthorizationError('You do not have permission to restore this project');
    }

    // Perform the restore operation (set deleted_at to null)
    const { error: updateError } = await supabase
      .from('projects')
      .update({ deleted_at: null, status: 'active' })
      .eq('id', projectId)
      .single(); // Use single() to ensure only one row is updated

    if (updateError) {
      throw new Error(`Failed to restore project: ${updateError.message}`);
    }

    // Create audit log entry
    await supabase.from('audit_logs').insert([{
      user_id: auth.user.id,
      action: 'project_restored',
      resource_type: 'project',
      resource_id: projectId,
      details: {}
    }]);

    return NextResponse.json({ message: 'Project restored successfully' });
  }
);
