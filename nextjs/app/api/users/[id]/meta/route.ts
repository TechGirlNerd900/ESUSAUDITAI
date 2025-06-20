import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest, { params }) {
  const { id } = params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Fetch user's organization_id and role
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('auth_user_id', user.id)
    .single()
  if (userError || !userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
  }
  // Only allow admin
  if (userProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const { custom_fields, tags } = body
  // Update user
  const { error } = await supabase
    .from('users')
    .update({ custom_fields: custom_fields || {}, tags: tags || [] })
    .eq('id', id)
    .eq('organization_id', userProfile.organization_id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ message: 'User meta updated' })
} 