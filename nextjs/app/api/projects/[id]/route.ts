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
  const { name, description, status, due_date, custom_fields, tags } = body

  // Update project
  const { data: project, error } = await supabase
    .from('projects')
    .update({
      name,
      description,
      status,
      due_date,
      custom_fields: custom_fields || {},
      tags: tags || [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('deleted_at', null)
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

  // Soft delete project using the utility function
  // Fetch user's organization_id
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (userError || !userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
  }
  const { error: softDeleteError } = await supabase.rpc('soft_delete', {
    table_name: 'projects',
    row_id: id,
    org_id: userProfile.organization_id,
    user_id: user.id
  })
  if (softDeleteError) {
    return NextResponse.json({ error: softDeleteError.message }, { status: 500 })
  }
  return NextResponse.json({ message: 'Project archived (soft deleted)' })
}