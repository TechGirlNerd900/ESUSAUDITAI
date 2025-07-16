import { createClient } from '@/utils/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');
  const type = requestUrl.searchParams.get('type');

  // Handle missing code parameter
  if (!code) {
    console.error('Auth callback: Missing code parameter');
    return NextResponse.redirect(
      new URL('/login?error=Missing+authorization+code', requestUrl.origin)
    );
  }

  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError) {
      console.error('Auth callback error:', authError);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(authError.message)}`, requestUrl.origin)
      );
    }

    if (!data.session || !data.user) {
      console.error('Auth callback: No session or user returned');
      return NextResponse.redirect(
        new URL('/login?error=Authentication+failed', requestUrl.origin)
      );
    }

    // Handle different callback types
    if (type === 'signup') {
      // Email confirmation for new signups
      return NextResponse.redirect(
        new URL('/login?message=Email+confirmed.+Please+sign+in.', requestUrl.origin)
      );
    }

    if (type === 'recovery') {
      // Password reset flow
      return NextResponse.redirect(new URL('/update-password', requestUrl.origin));
    }

    // For regular login callbacks, check if user profile exists
    // FIX: Destructure to separate const `profileError` from let `profile`
    const { data: initialProfile, error: profileError } = await supabase
      .from('users')
      .select('id, is_active, status, organization_id')
      .eq('auth_user_id', data.user.id)
      .single();
    let profile = initialProfile;

    // If profile doesn't exist, create it automatically
    if (profileError && profileError.code === 'PGRST116') {
      console.log('Auth callback: Creating missing user profile for', data.user.email);

      // Get or create default organization
      // FIX: Destructure to separate const `orgError` from let `defaultOrg`
      const { data: initialDefaultOrg, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .limit(1)
        .single();
      let defaultOrg = initialDefaultOrg;

      if (orgError || !defaultOrg) {
        const { data: newOrg, error: createOrgError } = await supabase
          .from('organizations')
          .insert({
            name: 'Default Organization',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createOrgError) {
          console.error('Auth callback: Failed to create default organization:', createOrgError);
          return NextResponse.redirect(
            new URL('/login?error=Failed+to+create+user+profile', requestUrl.origin)
          );
        }
        defaultOrg = newOrg;
      }

      // Create user profile
      const metadata = data.user.user_metadata || {};
      const { data: newProfile, error: createProfileError } = await supabase
        .from('users')
        .insert({
          auth_user_id: data.user.id,
          email: data.user.email,
          first_name: (metadata as any).first_name || (metadata as any).firstName || 'Unknown',
          last_name: (metadata as any).last_name || (metadata as any).lastName || 'User',
          role: (metadata as any).role || 'auditor',
          organization_id: (metadata as any).organization_id || defaultOrg.id,
          status: 'active',
          is_active: true,
          created_at: data.user.created_at,
          updated_at: new Date().toISOString(),
        })
        .select('id, is_active, status, organization_id')
        .single();

      if (createProfileError) {
        console.error('Auth callback: Failed to create user profile:', createProfileError);
        return NextResponse.redirect(
          new URL('/login?error=Failed+to+create+user+profile', requestUrl.origin)
        );
      }

      profile = newProfile;
    } else if (profileError || !profile) {
      console.error('Auth callback: User profile error:', profileError);
      return NextResponse.redirect(new URL('/login?error=User+profile+error', requestUrl.origin));
    }

    if (!profile.is_active || profile.status !== 'active') {
      console.error('Auth callback: User account is inactive');
      return NextResponse.redirect(new URL('/login?error=Account+is+inactive', requestUrl.origin));
    }

    // Create audit log entry for successful login
    await supabase.from('audit_logs').insert([
      {
        organization_id: profile.organization_id,
        user_id: profile.id,
        action: 'user_login_callback',
        resource_type: 'user',
        resource_id: profile.id,
        details: {
          callback_type: type || 'login',
          login_time: new Date().toISOString(),
        },
      },
    ]);

    // Validate and sanitize redirect URL for security
    let redirectUrl = '/dashboard';
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      redirectUrl = next;
    }

    return NextResponse.redirect(new URL(redirectUrl, requestUrl.origin));
  } catch (error) {
    console.error('Auth callback unexpected error:', error);
    return NextResponse.redirect(new URL('/login?error=Authentication+failed', requestUrl.origin));
  }
}
