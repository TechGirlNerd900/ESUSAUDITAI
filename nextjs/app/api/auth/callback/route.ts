import { createClient } from '@/utils/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')
  const type = requestUrl.searchParams.get('type')

  // Handle missing code parameter
  if (!code) {
    console.error('Auth callback: Missing code parameter')
    return NextResponse.redirect(new URL('/login?error=Missing+authorization+code', requestUrl.origin))
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin))
    }

    if (!data.session || !data.user) {
      console.error('Auth callback: No session or user returned')
      return NextResponse.redirect(new URL('/login?error=Authentication+failed', requestUrl.origin))
    }

    // Handle different callback types
    if (type === 'signup') {
      // Email confirmation for new signups
      return NextResponse.redirect(
        new URL('/login?message=Email+confirmed.+Please+sign+in.', requestUrl.origin)
      )
    }

    if (type === 'recovery') {
      // Password reset flow
      return NextResponse.redirect(
        new URL('/update-password', requestUrl.origin)
      )
    }

    // For regular login callbacks, check if user profile exists
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, is_active, status')
      .eq('auth_user_id', data.user.id)
      .single()

    if (profileError || !profile) {
      console.error('Auth callback: User profile not found:', profileError)
      return NextResponse.redirect(new URL('/login?error=User+profile+not+found', requestUrl.origin))
    }

    if (!profile.is_active || profile.status !== 'active') {
      console.error('Auth callback: User account is inactive')
      return NextResponse.redirect(new URL('/login?error=Account+is+inactive', requestUrl.origin))
    }

    // Create audit log entry for successful login
    await supabase
      .from('audit_logs')
      .insert([{
        organization_id: profile.organization_id,
        user_id: profile.id,
        action: 'user_login_callback',
        resource_type: 'user',
        resource_id: profile.id,
        details: {
          callback_type: type || 'login',
          login_time: new Date().toISOString()
        }
      }])

    // Validate and sanitize redirect URL for security
    let redirectUrl = '/dashboard'
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      redirectUrl = next
    }

    return NextResponse.redirect(new URL(redirectUrl, requestUrl.origin))

  } catch (error) {
    console.error('Auth callback unexpected error:', error)
    return NextResponse.redirect(new URL('/login?error=Authentication+failed', requestUrl.origin))
  }
}