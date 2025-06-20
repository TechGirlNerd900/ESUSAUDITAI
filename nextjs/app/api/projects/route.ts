import { NextRequest } from 'next/server';
import { Database } from '@/lib/database';
import { cookies } from 'next/headers';
import { authenticateApiRequest } from '@/lib/apiAuth';
import { withErrorHandling } from '@/lib/errorHandler';
import { successResponse, errorResponse, createdResponse } from '@/lib/apiResponse';

/**
 * GET handler for projects
 * Retrieves projects with pagination and filtering
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search') || undefined;
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  // Authenticate request with rate limiting
  const auth = await authenticateApiRequest(request)
    if (!auth.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

  // Initialize database
  const db = new Database(cookies());
  
  // Get projects with pagination and filters
  const result = await db.getProjects(auth.user.id, {
    page,
    pageSize,
    status,
    search,
    sortBy,
    sortOrder
  });

  // Transform data to include document count and ensure compatibility
  const transformedProjects = result.data.map(project => ({
    ...project,
    document_count: project.documents?.length || 0,
    // Ensure backward compatibility
    due_date: project.end_date,
    audit_type: project.project_type || 'general'
  }));

  return successResponse({
    projects: transformedProjects,
    total: result.pagination.total,
    page: result.pagination.page,
    pageSize: result.pagination.pageSize,
    totalPages: result.pagination.totalPages
  });
});

/**
 * POST handler for projects
 * Creates a new project
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Authenticate request with rate limiting
  const auth = await authenticateApiRequest(request, { 
    rateLimit: 20,
    requireRole: 'auditor' // Only auditors and admins can create projects
  });
  
  if (!auth.success) {
    return auth.response;
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
    project_type
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
  const db = new Database(cookies());
  
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
    organizationId: auth.profile.organization_id
  });

  return createdResponse(project, 'Project created successfully');
});