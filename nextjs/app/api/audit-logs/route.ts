import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const organization_id = searchParams.get('organization_id')
  const event_type = searchParams.get('event_type')
  const severity = searchParams.get('severity')
  const tag = searchParams.get('tag')
  const limit = parseInt(searchParams.get('limit') || '100', 10)

  if (!organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('search_audit_logs', {
    p_organization_id: organization_id,
    p_event_type: event_type,
    p_severity: severity,
    p_tag: tag,
    p_limit: limit
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ logs: data })
} 