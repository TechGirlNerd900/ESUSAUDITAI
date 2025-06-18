import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { projectRateLimiter } from '@/lib/rateLimiter'

// Helper to check if user can create a project
function canCreateProject(user) {
  return user.role === 'admin' || user.role === 'auditor'
}

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await projectRateLimiter(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await createClient()

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's organization_id from users table
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
    }

    // Only return projects in user's organization
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', userProfile.organization_id)

    if (error) {
      console.error('Database error fetching projects:', error);
      return NextResponse.json(
        { error: 'Failed to fetch projects' }, 
        { status: 500 }
      )
    }

    // If reviewer, filter to only assigned projects
    let filteredProjects = projects
    if (userProfile.role === 'reviewer') {
      filteredProjects = projects.filter(p => p.assigned_to && p.assigned_to.includes(user.id))
    }

    // Transform data to include document count and ensure compatibility
    const transformedProjects = (filteredProjects || []).map(project => ({
      ...project,
      document_count: project.documents?.length || 0,
      // Ensure backward compatibility
      due_date: project.end_date,
      audit_type: 'general' // Default value since we don't have this field yet
    }))

    return NextResponse.json({ 
      projects: transformedProjects,
      total: transformedProjects.length,
      page: 1,
      limit: transformedProjects.length 
    })

  } catch (error) {
    console.error('Unexpected error in projects API:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await projectRateLimiter(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await createClient()

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    if (!canCreateProject(userProfile)) {
      return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, client_name, client_email, start_date, end_date, assigned_to } = body

    // Always set organization_id from user profile
    const projectData = { ...body, organization_id: userProfile.organization_id, created_by: user.id }

    // Enhanced validation
    if (!name || !client_name) {
      return NextResponse.json(
        { error: 'Project name and client name are required' },
        { status: 400 }
      )
    }

    // Validate assigned_to array
    const assignedToArray = assigned_to || [user.id]
    if (!Array.isArray(assignedToArray) || assignedToArray.length === 0) {
      return NextResponse.json(
        { error: 'Project must have at least one assignee' },
        { status: 400 }
      )
    }

    // Validate email format if provided
    if (client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate dates if provided
    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      return NextResponse.json(
        { error: 'Start date cannot be after end date' },
        { status: 400 }
      )
    }

    // Create project
    const { data: project, error } = await supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single()

    if (error) {
      console.error('Database error creating project:', error);
      return NextResponse.json(
        { error: 'Failed to create project' }, 
        { status: 500 }
      )
    }

    return NextResponse.json({ project }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error in project creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}