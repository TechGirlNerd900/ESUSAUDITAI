import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { projectRateLimiter } from '@/lib/rateLimiter'

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = projectRateLimiter.middleware()(request)
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

    // Get projects for the user with pagination
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        description,
        status,
        client_name,
        client_email,
        start_date,
        end_date,
        created_at,
        updated_at,
        created_by,
        assigned_to,
        documents (
          id,
          original_name,
          status,
          created_at
        )
      `)
      .or(`created_by.eq.${user.id},assigned_to.cs.{${user.id}}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Database error fetching projects:', error);
      return NextResponse.json(
        { error: 'Failed to fetch projects', details: error.message }, 
        { status: 500 }
      )
    }

    // Transform data to include document count and ensure compatibility
    const transformedProjects = (projects || []).map(project => ({
      ...project,
      document_count: project.documents?.length || 0,
      // Ensure backward compatibility
      due_date: project.end_date,
      audit_type: 'general' // Default value since we don't have this field yet
    }))

    return NextResponse.json({ 
      projects: transformedProjects,
      total: transformedProjects.length,
      page,
      limit 
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
    const rateLimitResponse = projectRateLimiter.middleware()(request)
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

    const body = await request.json()
    const { name, description, client_name, client_email, start_date, end_date, assigned_to } = body

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
      .insert([
        {
          name: name.trim(),
          description: description?.trim() || null,
          client_name: client_name.trim(),
          client_email: client_email?.trim() || null,
          start_date: start_date || null,
          end_date: end_date || null,
          created_by: user.id,
          assigned_to: assignedToArray,
          status: 'active',
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Database error creating project:', error);
      return NextResponse.json(
        { error: 'Failed to create project', details: error.message }, 
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