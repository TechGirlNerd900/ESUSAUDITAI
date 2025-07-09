// Organization Invitation API
// Handles user invitations to join existing organizations

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { authenticateApiRequest } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireRole: 'admin' });
  if (!auth.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email, role, firstName, lastName } = await request.json();

    if (!email || !role || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, role, first name, and last name are required' },
        { status: 400 }
      );
    }

    if (!['auditor', 'reviewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be auditor or reviewer' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, organization_id')
      .eq('email', email)
      .single();

    if (existingUser) {
      if (existingUser.organization_id === auth.profile.organization_id) {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: 'User is already a member of another organization' },
          { status: 400 }
        );
      }
    }

    // Get organization details
    const { data: organization } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', auth.profile.organization_id)
      .single();

    // Store invitation in the invitations table
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .insert({
        organization_id: auth.profile.organization_id,
        email: email.toLowerCase().trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role,
        invited_by: auth.profile.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select(
        `
        id,
        email,
        role,
        expires_at,
        token
      `
      )
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      if (inviteError.code === '23505') {
        // Unique constraint violation
        return NextResponse.json(
          { error: 'An invitation for this email already exists for this organization' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // Send invitation email via Supabase Auth
    // This will send an email with a magic link that includes the invitation token
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: {
        data: {
          invitation_token: invitation.token,
          organization_name: organization?.name,
          invited_by_name: `${auth.profile.first_name} ${auth.profile.last_name}`,
          role: role,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/register?invite=${invitation.token}`,
      },
    });

    if (authError) {
      console.error('Error sending invitation email:', authError);
      // Clean up the invitation if email sending fails
      await supabase.from('invitations').delete().eq('id', invitation.id);

      return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 });
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      organization_id: auth.profile.organization_id,
      user_id: auth.profile.id,
      action: 'invitation_sent',
      resource_type: 'invitation',
      resource_id: invitation.id,
      details: {
        invited_email: email,
        invited_role: role,
        invited_name: `${firstName} ${lastName}`,
      },
    });

    return NextResponse.json({
      message: `Invitation sent to ${email}. They will receive setup instructions via email.`,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
        // Note: token is explicitly excluded from response for security
      },
    });
  } catch (error) {
    console.error('Invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get pending invitations for the organization
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireRole: 'admin' });
  if (!auth.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    // Get all pending invitations for the organization
    const { data: invitations, error } = await supabase
      .from('invitations')
      .select(
        `
        id,
        email,
        first_name,
        last_name,
        role,
        status,
        expires_at,
        created_at,
        invited_by,
        users!invited_by(first_name, last_name)
      `
      )
      .eq('organization_id', auth.profile.organization_id)
      .in('status', ['pending', 'expired'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    const formattedInvitations = invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      firstName: inv.first_name,
      lastName: inv.last_name,
      role: inv.role,
      status: inv.status,
      createdAt: inv.created_at,
      expiresAt: inv.expires_at,
      invitedBy:
        inv.users && Array.isArray(inv.users) && inv.users[0]
          ? `${inv.users[0].first_name} ${inv.users[0].last_name}`
          : 'Unknown',
      isExpired: new Date(inv.expires_at) < new Date(),
    }));

    return NextResponse.json({ invitations: formattedInvitations });
  } catch (error) {
    console.error('Fetch invitations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
