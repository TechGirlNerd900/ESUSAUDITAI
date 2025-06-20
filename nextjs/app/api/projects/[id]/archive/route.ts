import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Fetch user's organization_id
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('organization_id')
    .eq('auth_user_id', user.id)
    .single()
  if (userError || !userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
  }
  // Call soft_delete function
  const { error } = await supabase.rpc('soft_delete', {
    table_name: 'projects',
    row_id: id,
    org_id: userProfile.organization_id,
    user_id: user.id
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ message: 'Project archived (soft deleted)' })
} 