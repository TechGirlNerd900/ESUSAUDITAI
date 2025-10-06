import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { authenticateApiRequest, checkOrganizationAccess } from '@/lib/auth/apiAuth';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api/apiResponse';
import { z } from 'zod';

// Zod schema for project creation/update
const projectSchema = z.object({
  name: z.string().min(3, 'Project name must be at least 3 characters'),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.enum(['active', 'completed', 'on_hold']).optional(),
});

// GET /api/projects/[id] - Get a single project
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiRequest(request);
  if (!auth.success) {
    return errorResponse(auth.error || 'Unauthorized', 401);
  }

  const { supabase } = auth;
  const projectId = params.id;

  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('organization_id', auth.user.organizationId)
      .single();

    if (error || !project) {
      return errorResponse('Project not found', 404);
    }

    return successResponse(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return errorResponse('Failed to fetch project', 500);
  }
}

// PUT /api/projects/[id] - Update a project
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiRequest(request);
  if (!auth.success) {
    return errorResponse(auth.error || 'Unauthorized', 401);
  }

  const { supabase } = auth;
  const projectId = params.id;

  try {
    const body = await request.json();
    const validation = projectSchema.safeParse(body);

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors);
    }

    // Verify project exists and belongs to the user's organization
    const { data: existingProject, error: fetchError } = await supabase
      .from('projects')
      .select('id, organization_id')
      .eq('id', projectId)
      .single();

    if (fetchError || !existingProject) {
      return errorResponse('Project not found', 404);
    }

    // Check if user has access to this organization
    const hasAccess = await checkOrganizationAccess(supabase, auth.profile, existingProject.organization_id);
    if (!hasAccess) {
      return errorResponse('Forbidden: You do not have access to this project\'s organization.', 403);
    }

    // Only admins or project managers can update
    if (auth.profile.role !== 'admin' && auth.profile.role !== 'super_admin') {
      // Check if user is a project manager for this project
      const { data: projectMember, error: memberError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', auth.user.id)
        .single();

      if (memberError || !projectMember || projectMember.role !== 'manager') {
        return errorResponse('Forbidden: You must be an admin or project manager to update this project.', 403);
      }
    }

    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating project:', updateError);
      return errorResponse('Failed to update project', 500);
    }

    // Log the update
    await supabase.from('audit_logs').insert({
      organization_id: existingProject.organization_id,
      user_id: auth.user.id,
      action: 'update_project',
      resource_type: 'project',
      resource_id: projectId,
      details: {
        changes: validation.data,
      },
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    return successResponse(updatedProject);
  } catch (error) {
    console.error('Error processing project update:', error);
    return errorResponse('Failed to process project update', 500);
  }
}

// DELETE /api/projects/[id] - Delete a project
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiRequest(request, ['admin', 'super_admin']);
  if (!auth.success) {
    return errorResponse(auth.error || 'Unauthorized', 401);
  }

  const { supabase } = auth;
  const projectId = params.id;

  try {
    // Verify project exists and belongs to the user's organization
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id, organization_id')
      .eq('id', projectId)
      .single();

    if (fetchError || !project) {
      return errorResponse('Project not found', 404);
    }

    // Double-check organization access
    const hasAccess = await checkOrganizationAccess(supabase, auth.profile, project.organization_id);
    if (!hasAccess) {
      return errorResponse('Forbidden: You do not have access to this project\'s organization.', 403);
    }

    // Soft delete the project
    const { error: deleteError } = await supabase
      .from('projects')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'archived',
      })
      .eq('id', projectId);

    if (deleteError) {
      console.error('Error deleting project:', deleteError);
      return errorResponse('Failed to delete project', 500);
    }

    // Log the deletion
    await supabase.from('audit_logs').insert({
      organization_id: project.organization_id,
      user_id: auth.user.id,
      action: 'delete_project',
      resource_type: 'project',
      resource_id: projectId,
      details: {
        message: `Project with ID ${projectId} was soft-deleted.`, 
      },
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    return successResponse({ message: 'Project deleted successfully' }, 200);
  } catch (error) {
    console.error('Error processing project deletion:', error);
    return errorResponse('Failed to process project deletion', 500);
  }
}