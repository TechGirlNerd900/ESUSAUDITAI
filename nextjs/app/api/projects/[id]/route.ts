import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Helper to check RBAC and project/org access
async function authorizeProjectAccess(supabase, userId, projectId) {
  // Fetch user profile
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', userId)
    .single()
  if (userError || !userProfile) {
    return { allowed: false, error: 'User profile not found' }
  }
  // Fetch project with org
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, created_by, assigned_to, organization_id')
    .eq('id', projectId)
    .single()
  if (error || !project) {
    return { allowed: false, error: 'Project not found' }
  }
  if (userProfile.role === 'admin') {
    // System admin: allow all
    return { allowed: true }
  }
  if (userProfile.organization_id && userProfile.organization_id !== project.organization_id) {
    return { allowed: false, error: 'Cross-organization access denied' }
  }
  if (project.created_by === userId || (project.assigned_to && project.assigned_to.includes(userId))) {
    return { allowed: true }
  }
  return { allowed: false, error: 'Access denied' }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authz = await authorizeProjectAccess(supabase, user.id, id)
  if (!authz.allowed) {
    return NextResponse.json({ error: authz.error }, { status: 403 })
  }

  // Get project with documents
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      documents (
        id,
        name,
        original_name,
        file_size,
        file_type,
        status,
        created_at,
        analysis_results (*)
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Project fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 404 })
  }

  return NextResponse.json({ project })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authz = await authorizeProjectAccess(supabase, user.id, id)
  if (!authz.allowed) {
    return NextResponse.json({ error: authz.error }, { status: 403 })
  }

  const body = await request.json()
  const { name, description, status, due_date } = body

  // Update project
  const { data: project, error } = await supabase
    .from('projects')
    .update({
      name,
      description,
      status,
      due_date,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Project update error:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }

  return NextResponse.json({ project })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authz = await authorizeProjectAccess(supabase, user.id, id)
  if (!authz.allowed) {
    return NextResponse.json({ error: authz.error }, { status: 403 })
  }

  // Archive project instead of deleting
  const { error } = await supabase
    .from('projects')
    .update({ status: 'archived' })
    .eq('id', id)

  if (error) {
    console.error('Project archive error:', error)
    return NextResponse.json({ error: 'Failed to archive project' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Project archived successfully' })
}