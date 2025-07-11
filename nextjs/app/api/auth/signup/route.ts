// Enhanced User Registration API
// Supports both organization creation and invitation-based registration

import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { withErrorHandling, ValidationError, ApiError } from '@/lib/errorHandler';
import { successResponse } from '@/lib/apiResponse';
import { authRateLimiter } from '@/lib/rateLimiter';
import { validate } from '@/lib/validation';
import { SecurityService } from '@/lib/security';

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Apply rate limiting for signup attempts
  const rateLimitResponse = await authRateLimiter(request);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const {
    email,
    password,
    firstName,
    lastName,
    role,
    organizationName,
    inviteToken,
    registrationType, // 'create_org' or 'join_invite'
  } = await request.json();

  // SECURITY: Validate and sanitize all inputs
  const validator = validate({
    email,
    password,
    firstName,
    lastName,
    registrationType,
    organizationName,
    inviteToken,
  });

  // Validate required fields
  validator
    .required('email', 'Email is required')
    .required('password', 'Password is required')
    .required('firstName', 'First name is required')
    .required('lastName', 'Last name is required')
    .required('registrationType', 'Registration type is required')
    .oneOf('registrationType', ['create_org', 'join_invite'], 'Invalid registration type');

  // Validate email format
  validator.email('email', 'Invalid email format');

  // Validate password complexity
  validator.matches(
    'password',
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
  );

  // Validate name fields
  validator
    .minLength('firstName', 2, 'First name must be at least 2 characters')
    .maxLength('firstName', 50, 'First name must be less than 50 characters')
    .minLength('lastName', 2, 'Last name must be at least 2 characters')
    .maxLength('lastName', 50, 'Last name must be less than 50 characters');

  // Conditional validation based on registration type
  if (registrationType === 'create_org') {
    validator
      .required('organizationName', 'Organization name is required for new organizations')
      .minLength('organizationName', 3, 'Organization name must be at least 3 characters')
      .maxLength('organizationName', 100, 'Organization name must be less than 100 characters');
  } else if (registrationType === 'join_invite') {
    validator.required('inviteToken', 'Invitation token is required');
  }

  if (!validator.isValid) {
    throw new ValidationError(
      `Validation failed: ${Object.values(validator.validationErrors).join(', ')}`
    );
  }

  // Initialize security service for sanitization
  const securityService = new SecurityService({
    getAll: () => [],
    setAll: () => {},
  });

  // Sanitize inputs
  const sanitizedData = {
    email: securityService.sanitizeInput(email).toLowerCase().trim(),
    firstName: securityService.sanitizeInput(firstName).trim(),
    lastName: securityService.sanitizeInput(lastName).trim(),
    organizationName: organizationName
      ? securityService.sanitizeInput(organizationName).trim()
      : null,
    inviteToken: inviteToken ? securityService.sanitizeInput(inviteToken).trim() : null,
  };

  const supabase = await createClient();
  
  // For organization creation, we need to use the service role to bypass RLS
  const { createClient: createServiceClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let organizationId: string | undefined;
  let userRole: string = 'auditor'; // Default role

  if (registrationType === 'create_org') {
    // Organization creation flow - first user becomes admin
    try {
      // Create organization first using service role to bypass RLS
      const { data: organization, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert([
          {
            name: sanitizedData.organizationName,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (orgError) {
        console.error('Organization creation error:', orgError);
        console.error('Organization error details:', {
          code: orgError.code,
          message: orgError.message,
          details: orgError.details,
          hint: orgError.hint
        });
        throw new Error(`Failed to create organization: ${orgError.message}`);
      }

      console.log('Organization created successfully:', organization);
      organizationId = organization.id;
      userRole = 'admin'; // First user of organization becomes admin
    } catch (error) {
      console.error('Error in organization creation:', error);
      throw new ApiError(
        error instanceof Error ? error.message : 'Failed to create organization',
        500
      );
    }
  } else if (registrationType === 'join_invite') {
    // Invitation-based registration
    try {
      // Validate invitation token - use invitations table from schema
      const { data: inviteData, error: inviteError } = await supabaseAdmin
        .from('invitations') // Correct table name from schema
        .select('*')
        .eq('token', sanitizedData.inviteToken)
        .eq('status', 'pending')
        .single();

      if (inviteError || !inviteData) {
        throw new ValidationError('Invalid or expired invitation token');
      }

      // Check if invitation is expired
      if (new Date(inviteData.expires_at) < new Date()) {
        // Update invitation status to expired
        await supabaseAdmin
          .from('invitations')
          .update({ status: 'expired' })
          .eq('token', sanitizedData.inviteToken);

        throw new ValidationError('Invitation has expired');
      }

      // Check if email matches invitation
      if (inviteData.email !== sanitizedData.email) {
        throw new ValidationError('Email does not match invitation');
      }

      organizationId = inviteData.organization_id;
      userRole = inviteData.role || 'auditor';
    } catch (error) {
      console.error('Error processing invitation:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ApiError('Failed to process invitation', 500);
    }
  }

  // Ensure organizationId is set
  if (!organizationId) {
    throw new ApiError('Failed to determine organization', 500);
  }

  // Create user in Supabase Auth
  const { data: authUser, error: authError } = await supabase.auth.signUp({
    email: sanitizedData.email,
    password,
    options: {
      data: {
        first_name: sanitizedData.firstName,
        last_name: sanitizedData.lastName,
        role: userRole,
        organization_id: organizationId,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback?type=signup`,
    },
  });

  if (authError) {
    console.error('Error creating user:', authError);
    console.error('Auth error details:', {
      code: authError.code,
      message: authError.message,
      status: authError.status
    });
    throw new ApiError(authError.message || 'Failed to create account', 400);
  }

  console.log('Auth user created successfully:', {
    id: authUser.user?.id,
    email: authUser.user?.email,
    confirmed: authUser.user?.email_confirmed_at
  });

  // SECURITY: Create user profile in database with validated data using service role
  if (authUser.user) {
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          auth_user_id: authUser.user.id,
          email: sanitizedData.email,
          first_name: sanitizedData.firstName,
          last_name: sanitizedData.lastName,
          role: userRole,
          organization_id: organizationId,
          status: 'active',
          is_active: true,
        },
      ])
      .select()
      .single();

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      console.error('Profile error details:', {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint
      });
      console.error('Attempted user data:', {
        auth_user_id: authUser.user.id,
        email: sanitizedData.email,
        first_name: sanitizedData.firstName,
        last_name: sanitizedData.lastName,
        role: userRole,
        organization_id: organizationId,
        status: 'active',
        is_active: true
      });
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw new ApiError(`Failed to create user profile: ${profileError.message}`, 500);
    }

    // If this was an invite, update the invitation status
    if (registrationType === 'join_invite' && sanitizedData.inviteToken) {
      await supabaseAdmin
        .from('invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_by: userProfile.id,
        })
        .eq('token', sanitizedData.inviteToken);
    }

    // Create audit log entry for the registration
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     '127.0.0.1'; // Default to localhost for development
    
    await supabaseAdmin
      .from('audit_logs')
      .insert([
        {
          organization_id: organizationId,
          user_id: userProfile.id,
          action: registrationType === 'create_org' ? 'organization_created' : 'user_joined',
          resource_type: 'user',
          resource_id: authUser.user.id,
          ip_address: clientIp,
          user_agent: request.headers.get('user-agent') || 'unknown',
          details: {
            email: sanitizedData.email,
            role: userRole,
            registration_type: registrationType,
            invitation_token: registrationType === 'join_invite' ? sanitizedData.inviteToken : null,
          },
        },
      ])
      .select();
  }

  return successResponse(
    {
      message: 'Account created successfully. Please check your email to verify your account.',
      user: {
        id: authUser.user?.id,
        email: authUser.user?.email,
        role: userRole,
        organization_id: organizationId,
      },
    },
    'Account created successfully'
  );
});
