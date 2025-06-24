// Admin Organization Creation API
// Allows the first admin to create an organization without an invitation
// This is used when setting up a new organization for the first time

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      organizationName,
      adminKey // Optional admin key for additional security
    } = await request.json()

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !organizationName) {
      return NextResponse.json(
        { error: 'All fields are required: email, password, firstName, lastName, organizationName' },
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
    
    // Validate password complexity
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character' },
        { status: 400 }
      )
    }
    
    // Validate name fields
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      return NextResponse.json(
        { error: 'First and last name must be at least 2 characters' },
        { status: 400 }
      )
    }

    // Validate organization name
    if (organizationName.trim().length < 3) {
      return NextResponse.json(
        { error: 'Organization name must be at least 3 characters' },
        { status: 400 }
      )
    }

    // Optional: Check admin key if provided in environment
    if (process.env.ADMIN_SIGNUP_KEY && adminKey !== process.env.ADMIN_SIGNUP_KEY) {
      return NextResponse.json(
        { error: 'Invalid admin key' },
        { status: 403 }
      )
    }

    const supabase = await createClient()

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      )
    }

    // Check if organization name already exists
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('name', organizationName.trim())
      .single()

    if (existingOrg) {
      return NextResponse.json(
        { error: 'An organization with this name already exists' },
        { status: 400 }
      )
    }

    // Create organization first
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert([{
        name: organizationName.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (orgError) {
      console.error('Error creating organization:', orgError)
      return NextResponse.json(
        { error: 'Failed to create organization: ' + orgError.message },
        { status: 500 }
      )
    }

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          role: 'admin',
          organization_id: organization.id
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?type=signup`
      }
    })

    if (authError) {
      console.error('Error creating admin user:', authError)
      
      // Clean up organization if user creation fails
      await supabase
        .from('organizations')
        .delete()
        .eq('id', organization.id)
      
      return NextResponse.json(
        { error: authError.message || 'Failed to create admin account' },
        { status: 400 }
      )
    }

    if (!authUser.user) {
      // Clean up organization if no user returned
      await supabase
        .from('organizations')
        .delete()
        .eq('id', organization.id)
      
      return NextResponse.json(
        { error: 'Failed to create admin account - no user returned' },
        { status: 500 }
      )
    }

    // Create user profile in database
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .insert([{
        auth_user_id: authUser.user.id,
        organization_id: organization.id,
        email: email.toLowerCase().trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: 'admin',
        status: 'active',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (profileError) {
      console.error('Error creating user profile:', profileError)
      
      // Clean up auth user and organization
      await supabase.auth.admin.deleteUser(authUser.user.id)
      await supabase
        .from('organizations')
        .delete()
        .eq('id', organization.id)
      
      return NextResponse.json(
        { error: 'Failed to create user profile: ' + profileError.message },
        { status: 500 }
      )
    }
    
    // Create audit log entry for the admin creation
    await supabase
      .from('audit_logs')
      .insert([{
        organization_id: organization.id,
        user_id: userProfile.id,
        action: 'admin_organization_created',
        resource_type: 'organization',
        resource_id: organization.id,
        details: {
          admin_email: email.toLowerCase().trim(),
          organization_name: organizationName.trim(),
          creation_time: new Date().toISOString()
        }
      }])

    return NextResponse.json({
      message: 'Organization and admin account created successfully. Please check your email to verify your account.',
      organization: {
        id: organization.id,
        name: organization.name
      },
      user: {
        id: authUser.user.id,
        email: authUser.user.email,
        role: 'admin',
        organization_id: organization.id
      }
    })

  } catch (error) {
    console.error('Admin signup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}