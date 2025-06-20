// Individual User Management API
// Handles updating user status and role changes

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest } from '@/lib/apiAuth'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireRole: 'admin' })
  if (!auth.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

}
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const auth = await authenticateApiRequest(request, { requireRole: 'admin' })
  if (!auth.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { is_active, role } = await request.json()
    const userId = id

    if (is_active === undefined && !role) {
      return NextResponse.json(
        { error: 'Either is_active or role must be provided' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Build update object
    const updateData: any = {}
    if (is_active !== undefined) updateData.is_active = is_active
    if (role) updateData.role = role
    updateData.updated_at = new Date().toISOString()

    // Update user in organization
    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .eq('organization_id', auth.profile.organization_id) // Ensure same organization
      .select()
      .single()

    if (error) {
      console.error('Error updating user:', error)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('User update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateApiRequest(request, { requireRole: 'admin' })
  if (!auth.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const userId = id

    // Prevent admin from deleting themselves
    if (userId === auth.profile.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get user to verify organization and get auth_user_id
    const { data: user, error: getUserError } = await supabase
      .from('users')
      .select('auth_user_id, organization_id')
      .eq('id', userId)
      .eq('organization_id', auth.profile.organization_id)
      .single()

    if (getUserError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete from Supabase Auth (this will cascade to users table via trigger)
    if (user.auth_user_id) {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.auth_user_id)
      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError)
        // Continue with local deletion even if auth deletion fails
      }
    }

    // Delete from users table (in case auth deletion didn't cascade)
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)
      .eq('organization_id', auth.profile.organization_id)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('User deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



