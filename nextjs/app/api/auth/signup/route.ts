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

    const supabase = await createClient()

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
      
      // Validate organization name
      if (organizationName.trim().length < 3) {
        return NextResponse.json(
          { error: 'Organization name must be at least 3 characters' },
          { status: 400 }
        )
      }

      // Start a transaction by enabling RLS bypass
      const { error: rpcError } = await supabase.rpc('begin_transaction')
      if (rpcError) {
        console.error('Error starting transaction:', rpcError)
        return NextResponse.json({ error: 'Failed to start transaction' }, { status: 500 })
      }
      
      try {
        // Create organization first
        const { data: organization, error: orgError } = await supabase
          .from('organizations')
          .insert([{
            name: organizationName.trim()
          }])
          .select()
          .single()

        if (orgError) {
          throw new Error(`Failed to create organization: ${orgError.message}`)
        }

        organizationId = organization.id
        userRole = 'admin' // First user of organization becomes admin
      } catch (error) {
        // Rollback transaction on error
        await supabase.rpc('rollback_transaction')
        console.error('Error in organization creation transaction:', error)
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : 'Failed to create organization' 
        }, { status: 500 })
      }

    } else if (registrationType === 'join_invite') {
      // Invitation-based registration
      if (!inviteToken) {
        return NextResponse.json(
          { error: 'Invitation token is required' },
          { status: 400 }
        )
      }

      try {
        // Validate invitation token - use invitations table instead of app_settings
        const { data: inviteData, error: inviteError } = await supabase
          .from('invitations')  // Use dedicated invitations table
          .select('*')
          .eq('token', inviteToken)
          .eq('status', 'pending')
          .single()

        if (inviteError || !inviteData) {
          return NextResponse.json(
            { error: 'Invalid or expired invitation token' },
            { status: 400 }
          )
        }

        // Check if invitation is expired
        if (new Date(inviteData.expires_at) < new Date()) {
          // Update invitation status to expired
          await supabase
            .from('invitations')
            .update({ status: 'expired' })
            .eq('token', inviteToken)
            
          return NextResponse.json(
            { error: 'Invitation has expired' },
            { status: 400 }
          )
        }

        // Check if email matches invitation
        if (inviteData.email !== email) {
          return NextResponse.json(
            { error: 'Email does not match invitation' },
            { status: 400 }
          )
        }

        organizationId = inviteData.organization_id
        userRole = inviteData.role || 'auditor'
      } catch (error) {
        console.error('Error processing invitation:', error)
        return NextResponse.json(
          { error: 'Failed to process invitation' },
          { status: 500 }
        )
      }
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

    // If this was an invite, update the invitation status
    if (registrationType === 'join_invite' && inviteToken) {
      await supabase
        .from('invitations')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('token', inviteToken)
    }
    
    // If we started a transaction for organization creation, commit it
    if (registrationType === 'create_org') {
      const { error: commitError } = await supabase.rpc('commit_transaction')
      if (commitError) {
        console.error('Error committing transaction:', commitError)
        // We don't want to fail the request at this point since the user was created
        // Just log the error
      }
    }
    
    // Create audit log entry for the registration
    await supabase
      .from('audit_logs')
      .insert([{
        organization_id: organizationId,
        action: registrationType === 'create_org' ? 'organization_created' : 'user_joined',
        resource_type: 'user',
        resource_id: authUser.user?.id,
        details: {
          email: email,
          role: userRole,
          registration_type: registrationType,
          invitation_token: registrationType === 'join_invite' ? inviteToken : null
        }
      }])
      .select()

    return NextResponse.json({
      message: 'Account created successfully. Please check your email to verify your account.',
      user: {
        id: authUser.user?.id,
        email: authUser.user?.email,
        role: userRole,
        organization_id: organizationId
      }
    })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}