import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { projectRateLimiter } from '@/lib/rateLimiter'

export async function GET(request: NextRequest) {
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
      audit_type,
      due_date,
      created_at,
      updated_at,
      created_by,
      assigned_to,
      documents (
        id,
        name,
        status,
        created_at
      )
    `)
    .or(`created_by.eq.${user.id},assigned_to.cs.{${user.id}}`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ projects })
}

export async function POST(request: NextRequest) {
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
  const { name, description, client_name, client_email, audit_type, due_date, assigned_to } = body

  // Enhanced validation
  const VALID_AUDIT_TYPES = ['financial', 'compliance', 'operational', 'security', 'internal']
  
  if (!name || !audit_type) {
    return NextResponse.json(
      { error: 'Name and audit type are required' },
      { status: 400 }
    )
  }

  if (!VALID_AUDIT_TYPES.includes(audit_type)) {
    return NextResponse.json(
      { error: 'Invalid audit type. Must be one of: ' + VALID_AUDIT_TYPES.join(', ') },
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

  // Create project
  const { data: project, error } = await supabase
    .from('projects')
    .insert([
      {
        name,
        description,
        client_name,
        client_email,
        audit_type,
        due_date,
        created_by: user.id,
        assigned_to: assignedToArray,
        status: 'active',
      },
    ])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ project }, { status: 201 })
}