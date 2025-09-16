import { NextRequest } from 'next/server';
import { Database } from '@/lib/db/database';
import { cookies } from 'next/headers';
import { authenticateApiRequest } from '@/lib/auth/apiAuth';
import { withErrorHandling } from '@/lib/errorHandler';
import { successResponse, errorResponse, createdResponse } from '@/lib/api/apiResponse';
import {
  parsePaginationParams,
  createPaginatedResponse,
  validatePaginationParams,
} from '@/lib/api/pagination';
import { createClient } from '@/utils/supabase/server';

/**
 * GET handler for projects
 * Retrieves projects with optimized pagination and filtering
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Parse and validate pagination parameters
  const searchParams = request.nextUrl.searchParams;
  const paginationParams = parsePaginationParams(searchParams);

  const validation = validatePaginationParams(paginationParams);
  if (!validation.isValid) {
    return errorResponse(validation.errors.join(', '), 400);
  }

  // Authenticate request
  const auth = await authenticateApiRequest(request);

  if (!auth.success) {
    return (auth as import('@/lib/auth/apiAuth').AuthFailure).response;
  }

  // Initialize database
  const cookieStore = await cookies();
  const db = new Database(cookieStore);

  // Get projects with optimized pagination
  const searchParam = searchParams.get('search');
  const statusParam = searchParams.get('status');

  const queryOptions: any = {
    page: paginationParams.page || 1,
    pageSize: paginationParams.pageSize || 10,
    sortBy: paginationParams.sortBy || 'created_at',
    sortOrder: paginationParams.sortOrder || 'desc',
  };

  if (searchParam) {
    queryOptions.search = searchParam;
  }

  if (statusParam) {
    queryOptions.status = statusParam;
  }

  const result = await db.getProjects(auth.user.id, queryOptions);

  // Transform data for compatibility
  const transformedProjects = result.data.map((project: any) => ({
    ...project,
    document_count: project.documents?.length || 0,
    due_date: project.end_date,
    audit_type: project.project_type || 'general',
  }));

  // Create paginated response
  const paginatedResponse = createPaginatedResponse(
    transformedProjects,
    paginationParams,
    result.pagination.total || 0
  );

  return successResponse(paginatedResponse);
});

/**
 * POST handler for projects
 * Creates a new project
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Authenticate request
  const auth = await authenticateApiRequest(request, {
    requireRole: 'auditor', // Only auditors and admins can create projects
  });

  if (!auth.success) {
    // Type assertion to help TypeScript understand the auth object structure
    return (auth as import('@/lib/auth/apiAuth').AuthFailure).response;
  }

  // Parse request body
  const body = await request.json();

  // Extract fields
  const {
    name,
    description,
    client_name,
    client_email,
    start_date,
    end_date,
    assigned_to,
    status,
    project_type,
  } = body;

  // Validate required fields
  if (!name || !client_name) {
    return errorResponse('Project name and client name are required', 400);
  }

  // Validate assigned_to array
  const assignedToArray = assigned_to || [auth.user.id];
  if (!Array.isArray(assignedToArray) || assignedToArray.length === 0) {
    return errorResponse('Project must have at least one assignee', 400);
  }

  // Validate email format if provided
  if (client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email)) {
    return errorResponse('Invalid email format', 400);
  }

  // Validate dates if provided
  if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
    return errorResponse('Start date cannot be after end date', 400);
  }

  // Initialize database
  const cookieStore = await cookies();
  const db = new Database(cookieStore);

  // Create project
  const project = await db.createProject({
    name,
    description,
    clientName: client_name,
    clientEmail: client_email,
    startDate: start_date,
    endDate: end_date,
    status: status || 'active',
    projectType: project_type || 'general',
    userId: auth.user.id,
    assignedTo: assignedToArray,
    organizationId: auth.profile.organization_id,
  });

  const supabase = await createClient();
  // Create audit log entry for the project creation
  await supabase.from('audit_logs').insert([
    {
      organization_id: auth.profile.organization_id,
      user_id: auth.profile.id,
      action: 'project_created',
      resource_type: 'project',
      resource_id: project.id,
      details: {
        project_name: project.name,
        client_name: project.client_name,
        creation_time: new Date().toISOString(),
      },
    },
  ]);

  return createdResponse(project, 'Project created successfully');
});
