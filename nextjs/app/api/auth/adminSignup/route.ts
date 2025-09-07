// Admin Organization Creation API
// Allows the first admin to create an organization without an invitation
// This is used when setting up a new organization for the first time

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withErrorHandling, ValidationError, ApiError } from '@/lib/errorHandler';
import { successResponse } from '@/lib/api/apiResponse';
import { authRateLimiter } from '@/lib/api/rateLimiter';
import { createClient } from '@/utils/supabase/server';

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Apply rate limiting for admin signup attempts
  const rateLimitResponse = await authRateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const {
    email,
    password,
    firstName,
    lastName,
    organizationName,
    adminKey, // Optional admin key for additional security
  } = await request.json();

  // Validate required fields
  if (!email || !password || !firstName || !lastName || !organizationName) {
    throw new ValidationError('All fields are required');
  }

  // Validate email format
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }

  // Validate password complexity
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    throw new ValidationError(
      'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
    );
  }

  // Validate name fields
  if (firstName.trim().length < 2 || lastName.trim().length < 2) {
    throw new ValidationError('First and last name must be at least 2 characters');
  }

  // Validate organization name
  if (organizationName.trim().length < 3) {
    throw new ValidationError('Organization name must be at least 3 characters');
  }

  // Optional: Check admin key if provided in environment
  if (process.env.ADMIN_SIGNUP_KEY && adminKey !== process.env.ADMIN_SIGNUP_KEY) {
    throw new ApiError('Invalid admin key', 403);
  }

  const supabase = await createClient();

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (existingUser) {
    throw new ApiError('Could not create account', 400);
  }

  // Check if organization name already exists
  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('name', organizationName.trim())
    .single();

  if (existingOrg) {
    throw new ApiError('Could not create account', 400);
  }

  // Create organization first
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .insert([
      {
        name: organizationName.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (orgError) {
    throw new ApiError('Failed to create organization', 500);
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
        organization_id: organization.id,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?type=signup`,
    },
  });

  if (authError) {
    // Clean up organization if user creation fails
    await supabase.from('organizations').delete().eq('id', organization.id);
    throw new ApiError(authError.message || 'Failed to create admin account', 400);
  }

  if (!authUser.user) {
    // Clean up organization if no user returned
    await supabase.from('organizations').delete().eq('id', organization.id);
    throw new ApiError('Failed to create admin account - no user returned', 500);
  }

  // Create user profile in database
  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .insert([
      {
        id: authUser.user.id, // Set the primary key to the auth user's ID
        auth_user_id: authUser.user.id,
        organization_id: organization.id,
        email: email.toLowerCase().trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: 'admin',
        status: 'active',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (profileError) {
    // Clean up auth user and organization
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    await supabase.from('organizations').delete().eq('id', organization.id);
    throw new ApiError('Failed to create user profile', 500);
  }

  // Create audit log entry for the admin creation
  await supabase.from('audit_logs').insert([
    {
      organization_id: organization.id,
      user_id: userProfile.id,
      action: 'admin_organization_created',
      resource_type: 'organization',
      resource_id: organization.id,
      details: {
        admin_email: email.toLowerCase().trim(),
        organization_name: organizationName.trim(),
        creation_time: new Date().toISOString(),
      },
    },
  ]);

  return successResponse({
    message:
      'Organization and admin account created successfully. Please check your email to verify your account.',
    organization: {
      id: organization.id,
      name: organization.name,
    },
    user: {
      id: authUser.user.id,
      email: authUser.user.email,
      role: 'admin',
      organization_id: organization.id,
    },
  });
});
