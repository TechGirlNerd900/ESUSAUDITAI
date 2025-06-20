// Organization Invitation API
// Handles user invitations to join existing organizations

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { authenticateApiRequest } from '@/lib/apiAuth'

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireRole: 'admin' })
  if (!auth.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { email, role, firstName, lastName } = await request.json()

    if (!email || !role || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, role, first name, and last name are required' },
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

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, organization_id')
      .eq('email', email)
      .single()

    if (existingUser) {
      if (existingUser.organization_id === auth.profile.organization_id) {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: 'User is already a member of another organization' },
          { status: 400 }
        )
      }
    }

    // Get organization details
    const { data: organization } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', auth.profile.organization_id)
      .single()

    // Create invitation token
    const inviteToken = crypto.randomUUID()
    
    // Store invitation in database (you might want to create an invitations table)
    // For now, we'll use app_settings as temporary storage
    await supabase
      .from('app_settings')
      .insert({
        organization_id: auth.profile.organization_id,
        key: `invite_${inviteToken}`,
        value: JSON.stringify({
          email,
          role,
          firstName,
          lastName,
          invitedBy: auth.profile.id,
          organizationId: auth.profile.organization_id,
          organizationName: organization?.name,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        }),
        category: 'invitations',
        is_sensitive: true
      })

    // Create Supabase auth user with invitation data
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email,
      password: 'TempInvitePassword123!', // They'll set their own password
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role,
          organization_id: auth.profile.organization_id,
          invite_token: inviteToken
        }
      }
    })

    if (authError) {
      console.error('Error creating invited user:', authError)
      return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 })
    }

    return NextResponse.json({
      message: `Invitation sent to ${email}. They will receive setup instructions via email.`,
      inviteToken
    })

  } catch (error) {
    console.error('Invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get pending invitations for the organization
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireRole: 'admin' })
  if (!auth.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()

    // Get all pending invitations
    const { data: invitations, error } = await supabase
      .from('app_settings')
      .select('key, value, created_at')
      .eq('organization_id', auth.profile.organization_id)
      .eq('category', 'invitations')
      .like('key', 'invite_%')

    if (error) {
      console.error('Error fetching invitations:', error)
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
    }

    const parsedInvitations = invitations.map(inv => {
      const data = JSON.parse(inv.value)
      return {
        token: inv.key.replace('invite_', ''),
        email: data.email,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
        organizationName: data.organizationName,
        createdAt: inv.created_at,
        expiresAt: data.expiresAt
      }
    })

    return NextResponse.json({ invitations: parsedInvitations })
  } catch (error) {
    console.error('Fetch invitations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}