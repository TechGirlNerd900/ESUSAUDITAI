import { withAuth } from '@/lib/auth/apiAuth'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const GET = withAuth(async (request: NextRequest, user) => {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const projectId = searchParams.get('projectId')
  const offset = (page - 1) * limit

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        }
      }
    }
  )

  let query = supabase
    .from('documents')
    .select(`
      id,
      name,
      file_type,
      file_size,
      processing_status,
      uploaded_at,
      analysis_results,
      projects!inner (
        id,
        name
      ),
      uploaded_by:users!documents_uploaded_by_fkey (
        first_name,
        last_name
      )
    `, { count: 'exact' })
    .eq('organization_id', user.organizationId)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data: documents, error, count } = await query

  if (error) {
    console.error('Error fetching documents:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch documents' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      documents: documents || [],
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

export const POST = withAuth(async (request: NextRequest, user) => {
  // Document upload logic will be implemented here
  return new Response(
    JSON.stringify({ message: 'Document upload endpoint' }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
