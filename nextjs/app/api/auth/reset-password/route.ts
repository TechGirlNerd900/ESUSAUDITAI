import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if user exists in our database
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, organization_id, is_active, status')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (profileError || !profile) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    if (!profile.is_active || profile.status !== 'active') {
      return NextResponse.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/update-password`,
    });

    if (error) {
      console.error('Password reset error:', error);
      return NextResponse.json({ error: 'Failed to send password reset email' }, { status: 500 });
    }

    // Create audit log entry
    await supabase.from('audit_logs').insert([
      {
        organization_id: profile.organization_id,
        user_id: profile.id,
        action: 'password_reset_requested',
        resource_type: 'user',
        resource_id: profile.id,
        details: {
          email: email.toLowerCase().trim(),
          request_time: new Date().toISOString(),
        },
      },
    ]);

    return NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Password reset API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
