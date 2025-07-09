import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { authRateLimiter } from '@/lib/rateLimiter';

export async function POST(request: NextRequest) {
  // Apply rate limiting for password update attempts
  const rateLimitResponse = await authRateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { password } = await request.json();

    // Validate required fields
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Validate password complexity
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        {
          error:
            'Password must be at least 8 characters and include uppercase, lowercase, number, and special character',
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Update password
    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      console.error('Password update error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Get user profile for audit log
    const { data: profile } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_user_id', user.id)
      .single();

    // Create audit log entry
    if (profile) {
      await supabase.from('audit_logs').insert([
        {
          organization_id: profile.organization_id,
          user_id: profile.id,
          action: 'password_updated',
          resource_type: 'user',
          resource_id: profile.id,
          details: {
            update_time: new Date().toISOString(),
          },
        },
      ]);
    }

    return NextResponse.json({
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Password update API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
