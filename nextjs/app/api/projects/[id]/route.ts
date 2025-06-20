/**
 * Project Details API Route
 * Handles operations for a specific project with proper authentication and validation
 */

import { NextRequest } from 'next/server';
import { Database } from '@/lib/database';
import { cookies } from 'next/headers';
import { authenticateApiRequest, checkOrganizationAccess } from '@/lib/apiAuth';
import { withErrorHandling, NotFoundError, AuthorizationError } from '@/lib/errorHandler';
import { successResponse, errorResponse, noContentResponse } from '@/lib/apiResponse';
import { createClient } from '@/utils/supabase/server';

/**
 * GET handler for a specific project
 * Retrieves project details with related data
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Extract project ID from URL
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const projectId = pathSegments[pathSegments.length - 1];
  
  // Authenticate request with rate limiting
  const auth = await authenticateApiRequest(request, { rateLimit: 50 });
  
  if (!auth.success) {
    return auth.response;
  }
  

  // Initialize database
  const db = new Database(cookies());
  
  try {
    // Get project with related data
    const project = await db.getProject(projectId, auth.user.id);
    
    // Transform data for compatibility
    const transformedProject = {
      ...project,
      document_count: project.documents?.length || 0,
      due_date: project.end_date,
      audit_type: project.project_type || 'general'
    };

    return successResponse(transformedProject);
  } catch (error) {
    if (error.message === 'Project not found') {
      throw new NotFoundError('Project');
    }
    if (error.message === 'Access denied to this project') {
      throw new AuthorizationError('You do not have access to this project');
    }
    throw error;
  }
});

/**
 * PUT handler for a specific project
 * Updates project details
 */
export const PUT = withErrorHandling(async (request: NextRequest) => {
  // Extract project ID from URL
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const projectId = pathSegments[pathSegments.length - 1];
  
  // Authenticate request with rate limiting
  const auth = await authenticateApiRequest(request, { rateLimit: 20 });
  
  if (!auth.success) {
    return auth.response;
  }

  // Parse request body
  const updates = await request.json();
  
  // Initialize Supabase client for organization access check
  const supabase = await createClient();
  
  // Get project to check access and organization
  const { data: project, error } = await supabase
    .from('projects')
    .select('organization_id, created_by')
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
  
  // Additional check: only creator or admin can update
  const isCreator = project.created_by === auth.user.id;
  const isAdmin = auth.profile.role === 'admin';
  
  if (!hasAccess || (!isCreator && !isAdmin)) {
    throw new AuthorizationError('You do not have permission to update this project');
  }
  
  // Extract fields
  const { 
    name, 
    description, 
    status, 
    due_date, 
    end_date = due_date, // Support both due_date and end_date
    start_date,
    client_name,
    client_email,
    custom_fields,
    tags,
    assigned_to
  } = updates;
  
  // Validate dates if provided
  if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
    return errorResponse('Start date cannot be after end date', 400);
  }
  
  // Prepare update data
  const updateData = {
    name,
    description,
    client_name,
    client_email,
    start_date,
    end_date,
    status,
    custom_fields: custom_fields || undefined,
    tags: tags || undefined,
    assigned_to,
    updated_at: new Date().toISOString()
  };
  
  // Remove undefined fields
  Object.keys(updateData).forEach(key => 
    updateData[key] === undefined && delete updateData[key]
  );
  
  // Update project
  const { data: updatedProject, error: updateError } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', projectId)
    .eq('deleted_at', null)
    .select()
    .single();
  
  if (updateError) {
    throw new Error(`Failed to update project: ${updateError.message}`);
  }
  
  // Create audit log entry
  await supabase.from('audit_logs').insert([{
    user_id: auth.user.id,
    action: 'project_updated',
    resource_type: 'project',
    resource_id: projectId,
    details: {
      updates: Object.keys(updateData).filter(k => k !== 'updated_at')
    }
  }]);
  
  return successResponse(updatedProject, 'Project updated successfully');
});

/**
 * DELETE handler for a specific project
 * Soft deletes a project
 */
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  // Extract project ID from URL
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const projectId = pathSegments[pathSegments.length - 1];
  
  // Authenticate request with rate limiting and admin role requirement
  const auth = await authenticateApiRequest(request, { 
    rateLimit: 10,
    requireRole: 'admin' // Only admins can delete projects
  });
  
  if (!auth.success) {
    return auth.response;
  }

  // Initialize Supabase client
  const supabase = await createClient();
  
  // Get project to check organization
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
    throw new AuthorizationError('You do not have permission to delete this project');
  }
  
  try {
    // Try to use the soft_delete RPC function if it exists
    const { error: softDeleteError } = await supabase.rpc('soft_delete', {
      table_name: 'projects',
      row_id: projectId,
      org_id: auth.profile.organization_id,
      user_id: auth.user.id
    });
    
    if (softDeleteError) {
      // If RPC fails, fall back to manual soft delete
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          status: 'archived',
          deleted_at: new Date().toISOString()
        })
        .eq('id', projectId);
      
      if (updateError) {
        throw new Error(`Failed to delete project: ${updateError.message}`);
      }
    }
    
    // Create audit log entry
    await supabase.from('audit_logs').insert([{
      user_id: auth.user.id,
      action: 'project_deleted',
      resource_type: 'project',
      resource_id: projectId,
      details: {
        deleted_at: new Date().toISOString()
      }
    }]);
    
    return successResponse({ message: 'Project archived (soft deleted)' });
  } catch (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }
});