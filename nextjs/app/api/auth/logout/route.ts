import { createClient } from '@/utils/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling, ApiError } from '@/lib/errorHandler';
import { successResponse } from '@/lib/apiResponse';
import { authRateLimiter } from '@/lib/rateLimiter';

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Apply rate limiting for logout attempts
  const rateLimitResponse = await authRateLimiter(request);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const supabase = await createClient();

  // Get current user before signing out for audit log
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Get user profile for audit log
    const { data: profile } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_user_id', user.id)
      .single();

    // Create audit log entry for logout
    if (profile) {
      await supabase.from('audit_logs').insert([
        {
          organization_id: profile.organization_id,
          user_id: profile.id,
          action: 'user_logout',
          resource_type: 'user',
          resource_id: profile.id,
          details: {
            logout_time: new Date().toISOString(),
            ip_address:
              request.headers.get('x-forwarded-for') ||
              request.headers.get('x-real-ip') ||
              'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown',
          },
        },
      ]);
    }
  }

  // Sign out of Supabase
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Logout error:', error);
    throw new ApiError('Failed to logout', 500);
  }

  // Return standardized success response
  return successResponse({ message: 'Logged out successfully' }, 'User logged out successfully');
});

// Also support GET requests for direct logout links
export const GET = withErrorHandling(async (request: NextRequest) => {
  const requestUrl = new URL(request.url);
  const supabase = await createClient();

  // Get current user before signing out for audit log
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Get user profile for audit log
    const { data: profile } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_user_id', user.id)
      .single();

    // Create audit log entry for logout
    if (profile) {
      await supabase.from('audit_logs').insert([
        {
          organization_id: profile.organization_id,
          user_id: profile.id,
          action: 'user_logout',
          resource_type: 'user',
          resource_id: profile.id,
          details: {
            logout_time: new Date().toISOString(),
            ip_address:
              request.headers.get('x-forwarded-for') ||
              request.headers.get('x-real-ip') ||
              'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown',
          },
        },
      ]);
    }
  }

  // Sign out of Supabase
  await supabase.auth.signOut();

  // Redirect to login page
  return NextResponse.redirect(
    new URL('/login?message=Logged+out+successfully', requestUrl.origin)
  );
});
