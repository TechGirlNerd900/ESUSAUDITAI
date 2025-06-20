import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Fetch user role
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()
  if (userError || !userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
  }
  if (userProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const organization_id = searchParams.get('organization_id')
  const event_type = searchParams.get('event_type')
  const severity = searchParams.get('severity')
  const tag = searchParams.get('tag')
  const limit = parseInt(searchParams.get('limit') || '100', 10)
  const resource_type = searchParams.get('resource_type')
  const resource_id = searchParams.get('resource_id')

  if (!organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('search_audit_logs', {
    p_organization_id: organization_id,
    p_event_type: event_type,
    p_severity: severity,
    p_tag: tag,
    p_limit: limit,
    ...(resource_type && { p_resource_type: resource_type }),
    ...(resource_id && { p_resource_id: resource_id })
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ logs: data })
} 