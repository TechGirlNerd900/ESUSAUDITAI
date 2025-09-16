// Enhanced User Registration API
// Supports both organization creation and invitation-based registration

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withErrorHandling, ValidationError, ApiError } from '@/lib/errorHandler';
import { successResponse } from '@/lib/api/apiResponse';
import { authRateLimiter } from '@/lib/api/rateLimiter';

import { z } from 'zod';
import net from 'net';

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Apply rate limiting for signup attempts
  const rateLimitResponse = await authRateLimiter(request);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // --- ADDED: Robust IP Address Parsing ---
  // Get headers that may contain the client's IP address.
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIp = request.headers.get('x-real-ip');

  // Safely parse the headers to get the first IP address in the list.
  // This handles comma-separated lists and prevents 'undefined' errors by using optional chaining.
  let clientIp: string | null = (
    xForwardedFor?.split(',')[0]?.trim() ||
    xRealIp?.split(',')[0]?.trim() ||
    '127.0.0.1'
  ).replace('::1', '127.0.0.1');

  if (!net.isIP(clientIp)) {
    clientIp = null;
  }
  // --- END ADDED ---

  const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(2).max(50),
    lastName: z.string().min(2).max(50),
    organizationName: z.string().min(3).max(100).optional(),
    inviteToken: z.string().optional(),
    registrationType: z.enum(['create_org', 'join_invite']),
  });

  const parsed = signupSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError('Invalid input');
  }

  const { email, password, firstName, lastName, organizationName, inviteToken, registrationType } =
    parsed.data;

  if (registrationType === 'create_org') {
    // Organization creation flow
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert([{ name: organizationName, is_active: true }])
      .select()
      .single();

    if (orgError) {
      throw new ApiError('Failed to create organization', 500);
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role: 'admin',
          organization_id: organization.id,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?type=signup`,
      },
    });

    if (authError) {
      // If user creation fails, delete the organization
      await supabaseAdmin.from('organizations').delete().eq('id', organization.id);
      throw new ApiError(authError.message, 400);
    }

    // Create user profile record
    if (!authUser.user || !authUser.user.id) {
      await supabaseAdmin.from('organizations').delete().eq('id', organization.id);
      throw new ApiError('Auth user not created properly', 500);
    }

    const { data: createdProfile, error: profileError } = await supabaseAdmin.from('users')
      .insert({
        auth_user_id: authUser.user.id,
        email: authUser.user.email,
        first_name: firstName,
        last_name: lastName,
        role: 'admin',
        organization_id: organization.id,
        status: 'active',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError || !createdProfile || !createdProfile.id) {
      console.error('Failed to create user profile:', profileError);
      // Clean up auth user and organization if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from('organizations').delete().eq('id', organization.id);
      throw new ApiError('Failed to create user profile', 500);
    }

    return successResponse(
      {
        message: 'Account created successfully. Please check your email to verify your account.',
        user: {
          id: authUser.user.id,
          email: authUser.user.email,
          role: 'admin',
          organization_id: organization.id,
        },
      },
      'Account created successfully'
    );
  } else {
    // Invitation-based registration
    const { data: inviteData, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', inviteToken)
      .eq('status', 'pending')
      .single();

    if (inviteError || !inviteData) {
      throw new ValidationError('Invalid or expired invitation token');
    }

    if (new Date(inviteData.expires_at) < new Date()) {
      await supabaseAdmin
        .from('invitations')
        .update({ status: 'expired' })
        .eq('token', inviteToken);
      throw new ValidationError('Invitation has expired');
    }

    if (inviteData.email !== email) {
      throw new ValidationError('Email does not match invitation');
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role: inviteData.role || 'auditor',
          organization_id: inviteData.organization_id,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?type=signup`,
      },
    });

    if (authError) {
      throw new ApiError(authError.message, 400);
    }

    // Create user profile record
    if (authUser.user) {
      const { error: profileError } = await supabaseAdmin.from('users').insert({
        auth_user_id: authUser.user.id,
        email: authUser.user.email,
        first_name: firstName,
        last_name: lastName,
        role: inviteData.role || 'auditor',
        organization_id: inviteData.organization_id,
        status: 'active',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        console.error('Failed to create user profile:', profileError);
        // Clean up auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        throw new ApiError('Failed to create user profile', 500);
      }
    }

    await supabaseAdmin
      .from('invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('token', inviteToken);

    return successResponse(
      {
        message: 'Account created successfully. Please check your email to verify your account.',
        user: {
          id: authUser.user?.id,
          email: authUser.user?.email,
          role: inviteData.role || 'auditor',
          organization_id: inviteData.organization_id,
        },
      },
      'Account created successfully'
    );
  }
});
