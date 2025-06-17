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

    // Create user profile in our database
    const { data: user, error: dbError } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        company: company.trim(),
        role: role,
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