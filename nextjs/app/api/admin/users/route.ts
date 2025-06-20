// Admin Users Management API
// Lists all users in the organization for admin management

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest } from '@/lib/apiAuth'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireRole: 'admin' })
  if (!auth.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()

    // Get all users in the same organization
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        auth_user_id,
        email,
        first_name,
        last_name,
        role,
        status,
        is_active,
        last_login_at,
        last_activity_at,
        created_at,
        updated_at
      `)
      .eq('organization_id', auth.profile.organization_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Users fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireRole: 'admin' })
  if (!auth.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { email, password, firstName, lastName, role } = await request.json()

    if (!email || !password || !firstName || !lastName || !role) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (!['auditor', 'reviewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be auditor or reviewer' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role,
          organization_id: auth.profile.organization_id
        }
      }
    })

    if (authError) {
      console.error('Error creating user:', authError)
      return NextResponse.json(
        { error: authError.message || 'Failed to create user' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: authUser.user?.id,
        email: authUser.user?.email,
        role
      }
    })

  } catch (error) {
    console.error('User creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}