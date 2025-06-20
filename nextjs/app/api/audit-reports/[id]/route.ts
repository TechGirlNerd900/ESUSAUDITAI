import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }) {
  const { id } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Only allow admin or project member
  const { data: report, error } = await supabase
    .from('audit_reports')
    .select('*')
    .eq('id', id)
    .eq('deleted_at', null)
    .single()
  if (error || !report) {
    return NextResponse.json({ error: 'Audit report not found' }, { status: 404 })
  }
  // Check access (project member or admin)
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()
  if (userError || !userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
  }
  if (userProfile.role !== 'admin' && user.id !== report.generated_by) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ report })
}

export async function PUT(request: NextRequest, { params }) {
  const { id } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Only allow admin or report owner
  const { data: report, error } = await supabase
    .from('audit_reports')
    .select('*')
    .eq('id', id)
    .eq('deleted_at', null)
    .single()
  if (error || !report) {
    return NextResponse.json({ error: 'Audit report not found' }, { status: 404 })
  }
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()
  if (userError || !userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
  }
  if (userProfile.role !== 'admin' && user.id !== report.generated_by) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const { report_name, report_data, status, custom_fields, tags } = body
  const { data: updatedReport, error: updateError } = await supabase
    .from('audit_reports')
    .update({
      report_name,
      report_data,
      status,
      custom_fields: custom_fields || {},
      tags: tags || [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('deleted_at', null)
    .select()
    .single()
  if (updateError || !updatedReport) {
    return NextResponse.json({ error: 'Failed to update audit report' }, { status: 500 })
  }
  return NextResponse.json({ report: updatedReport })
}

export async function DELETE(request: NextRequest, { params }) {
  const { id } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Only allow admin
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('auth_user_id', user.id)
    .single()
  if (userError || !userProfile || userProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Fetch report's org
  const { data: report, error: reportError } = await supabase
    .from('audit_reports')
    .select('organization_id')
    .eq('id', id)
    .single()
  if (reportError || !report) {
    return NextResponse.json({ error: 'Audit report not found' }, { status: 404 })
  }
  const { error: softDeleteError } = await supabase.rpc('soft_delete', {
    table_name: 'audit_reports',
    row_id: id,
    org_id: report.organization_id,
    user_id: user.id
  })
  if (softDeleteError) {
    return NextResponse.json({ error: softDeleteError.message }, { status: 500 })
  }
  return NextResponse.json({ message: 'Audit report soft deleted' })
} 