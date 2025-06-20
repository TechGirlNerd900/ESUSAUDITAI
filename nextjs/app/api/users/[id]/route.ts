import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Only allow self or admin
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('auth_user_id', user.id)
    .single()
  if (userError || !userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
  }
  if (userProfile.role !== 'admin' && user.id !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { data: targetUser, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .eq('deleted_at', null)
    .single()
  if (error || !targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  return NextResponse.json({ user: targetUser })
}

export async function PUT(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Only allow self or admin
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('auth_user_id', user.id)
    .single()
  if (userError || !userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
  }
  if (userProfile.role !== 'admin' && user.id !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const { first_name, last_name, company, custom_fields } = body
  const { data: updatedUser, error } = await supabase
    .from('users')
    .update({
      first_name,
      last_name,
      company,
      custom_fields: custom_fields || {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('deleted_at', null)
    .select()
    .single()
  if (error || !updatedUser) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
  return NextResponse.json({ user: updatedUser })
}

export async function DELETE(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
  // Fetch target user's org
  const { data: targetUser, error: targetError } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', id)
    .single()
  if (targetError || !targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const { error: softDeleteError } = await supabase.rpc('soft_delete', {
    table_name: 'users',
    row_id: id,
    org_id: targetUser.organization_id,
    user_id: user.id
  })
  if (softDeleteError) {
    return NextResponse.json({ error: softDeleteError.message }, { status: 500 })
  }
  return NextResponse.json({ message: 'User soft deleted' })
} 