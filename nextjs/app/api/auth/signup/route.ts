// Enhanced User Registration API
// Supports both organization creation and invitation-based registration

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      role,
      organizationName,
      inviteToken,
      registrationType // 'create_org' or 'join_invite'
    } = await request.json()

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, password, first name, and last name are required' },
        { status: 400 }
      )
    }

    if (!registrationType || !['create_org', 'join_invite'].includes(registrationType)) {
      return NextResponse.json(
        { error: 'Invalid registration type' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    let organizationId: string
    let userRole: string = role || 'auditor'

    if (registrationType === 'create_org') {
      // Organization creation flow
      if (!organizationName) {
        return NextResponse.json(
          { error: 'Organization name is required for new organizations' },
          { status: 400 }
        )
      }

      // Create organization first
      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .insert([{
          name: organizationName.trim()
        }])
        .select()
        .single()

      if (orgError) {
        console.error('Error creating organization:', orgError)
        return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
      }

      organizationId = organization.id
      userRole = 'admin' // First user of organization becomes admin

    } else if (registrationType === 'join_invite') {
      // Invitation-based registration
      if (!inviteToken) {
        return NextResponse.json(
          { error: 'Invitation token is required' },
          { status: 400 }
        )
      }

      // Validate invitation token
      const { data: inviteData, error: inviteError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', `invite_${inviteToken}`)
        .eq('category', 'invitations')
        .single()

      if (inviteError || !inviteData) {
        return NextResponse.json(
          { error: 'Invalid or expired invitation token' },
          { status: 400 }
        )
      }

      const invitation = JSON.parse(inviteData.value)

      // Check if invitation is expired
      if (new Date(invitation.expiresAt) < new Date()) {
        return NextResponse.json(
          { error: 'Invitation has expired' },
          { status: 400 }
        )
      }

      // Check if email matches invitation
      if (invitation.email !== email) {
        return NextResponse.json(
          { error: 'Email does not match invitation' },
          { status: 400 }
        )
      }

      organizationId = invitation.organizationId
      userRole = invitation.role
    }

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role: userRole,
          organization_id: organizationId
        }
      }
    })

    if (authError) {
      console.error('Error creating user:', authError)
      return NextResponse.json(
        { error: authError.message || 'Failed to create account' },
        { status: 400 }
      )
    }

    // If this was an invite, clean up the invitation
    if (registrationType === 'join_invite' && inviteToken) {
      await supabase
        .from('app_settings')
        .delete()
        .eq('key', `invite_${inviteToken}`)
    }

    return NextResponse.json({
      message: 'Account created successfully. Please check your email to verify your account.',
      user: {
        id: authUser.user?.id,
        email: authUser.user?.email,
        role: userRole
      }
    })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}