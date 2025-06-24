import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    })

    if (error) {
      console.error('Login error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (!data.session || !data.user) {
      return NextResponse.json(
        { error: 'Login failed - no session created' },
        { status: 401 }
      )
    }

    // Get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError)
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Check if user is active
    if (!profile.is_active || profile.status !== 'active') {
      return NextResponse.json(
        { error: 'Account is inactive. Please contact your administrator.' },
        { status: 403 }
      )
    }

    // Create audit log entry
    await supabase
      .from('audit_logs')
      .insert([{
        organization_id: profile.organization_id,
        user_id: profile.id,
        action: 'user_login',
        resource_type: 'user',
        resource_id: profile.id,
        details: {
          email: profile.email,
          login_time: new Date().toISOString()
        }
      }])

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        profile: {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          role: profile.role,
          organization_id: profile.organization_id
        }
      }
    })

  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}