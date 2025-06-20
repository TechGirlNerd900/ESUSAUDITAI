import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get JSON data from the request body
    const body = await request.json()
    const { email, firstName, lastName, company, role, authUserId } = body

    // Validate required fields
    if (!email || !firstName || !lastName || !company || !role) {
      return NextResponse.json(
        { error: 'All fields are required: email, firstName, lastName, company, role' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['admin', 'auditor', 'reviewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: admin, auditor, reviewer' },
        { status: 400 }
      )
    }

    // Get or create default organization
    let { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', 'Default Organization')
      .single()

    if (orgError || !organization) {
      // Create default organization if it doesn't exist
      const { data: newOrg, error: createOrgError } = await supabase
        .from('organizations')
        .insert({
          name: 'Default Organization',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (createOrgError) {
        console.error('Error creating default organization:', createOrgError)
        return NextResponse.json(
          { error: 'Failed to create organization' },
          { status: 500 }
        )
      }
      organization = newOrg
    }

    // Create user profile in our database
    const { data: user, error: dbError } = await supabase
      .from('users')
      .insert({
        auth_user_id: authUserId,
        organization_id: organization.id,
        email: email.toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        company: company.trim(),
        role: role,
        status: 'active',
        is_active: true,
        password_hash: 'handled_by_supabase_auth', // Placeholder since Supabase handles auth
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error creating user profile:', dbError)
      return NextResponse.json(
        { error: 'Failed to create user profile: ' + dbError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      user,
      message: 'User profile created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Registration API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}