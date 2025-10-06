import { withAuth } from '@/lib/auth/apiAuth'
import { NextRequest } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'

export const GET = withAuth(async (request: NextRequest, user, supabase: SupabaseClient) => {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const status = searchParams.get('status')
  const offset = (page - 1) * limit


  let query = supabase
    .from('projects')
    .select(`
      id,
      name,
      client_name,
      client_email,
      description,
      status,
      start_date,
      end_date,
      created_at,
      updated_at,
      created_by:users!projects_created_by_fkey (
        first_name,
        last_name
      )
    `, { count: 'exact' })
    .eq('organization_id', user.organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data: projects, error, count } = await query

  if (error) {
    console.error('Error fetching projects:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch projects' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Standard empty state handling: Always return 200 with empty array and pagination
  // Never return 404 for empty results - 404 is only for missing specific resources
  return new Response(
    JSON.stringify({
      projects: projects || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

export const POST = withAuth(async (request: NextRequest, user, supabase: SupabaseClient) => {
  const body = await request.json()
  

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name: body.name,
      client_name: body.client_name,
      client_email: body.client_email,
      description: body.description,
      start_date: body.start_date,
      end_date: body.end_date,
      organization_id: user.organizationId,
      created_by: user.id,
      status: 'active'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating project:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create project' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ project }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  )
})
