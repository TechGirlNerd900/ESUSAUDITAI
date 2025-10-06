// Authentication Debug API
// For troubleshooting authentication issues

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { authenticateApiRequest } from '@/lib/auth/apiAuth';

export async function GET(request: NextRequest) {
  try {
    // Get the auth status
    const supabase = await createClient();
    const authResponse = await supabase.auth.getUser();

    // Check if user is authenticated via our middleware
    const auth = await authenticateApiRequest(request);

    if (!auth.success) {
      return NextResponse.json({
        authStatus: 'error',
        supabaseAuthUser: authResponse.data?.user || null,
        supabaseAuthError: authResponse.error,
        middlewareError: true,
        authenticatedViaMiddleware: false,
        errorResponse:
          auth.success === false && auth.error
            ? {
                status: 401, // Default to 401 for authentication errors
                statusText: auth.error,
              }
            : null,
      });
    }

    // Get database entry for profile
    const { data: dbProfile, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authResponse.data.user?.id || '')
      .single();

    // Return full diagnostic information
    return NextResponse.json({
      authStatus: 'authenticated',
      authenticatedViaMiddleware: true,
      supabaseAuthUser: authResponse.data.user,
      userProfile: auth.profile,
      databaseProfile: dbProfile,
      databaseError: dbError,
      diagnostics: {
        missingAuthUserId: !authResponse.data.user?.id,
        missingProfile: !auth.profile,
        missingDbProfile: !dbProfile,
        authProfileMismatch: dbProfile && auth.profile && dbProfile.id !== auth.profile.id,
        authUserRoleMismatch: authResponse.data.user?.user_metadata?.role !== auth.profile?.role,
        inactiveProfile:
          auth.profile && (!auth.profile.is_active || auth.profile.status !== 'active'),
        deletedProfile: dbProfile && dbProfile.deleted_at !== null,
      },
    });
  } catch (error) {
    console.error('Auth debug error:', error);
    return NextResponse.json(
      {
        authStatus: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
