import { createClient } from '@/utils/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { authenticateApiRequest } from '@/lib/apiAuth'
import { successResponse, errorResponse, createdResponse } from '@/lib/apiResponse';


export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')
  const type = requestUrl.searchParams.get('type')

  const authCheck = await authenticateApiRequest(request)
  if (!authCheck.success && 'error' in authCheck) {
    const error = authCheck.error
    return NextResponse.json({ error: (error as { message: string }).message }, { status: (error as { status: number }).status })
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(new URL('/login?error=AuthError', requestUrl.origin))
    }

    // Check if this is an email confirmation callback
    if (type === 'signup') {
      // Redirect to login page with success message for email confirmation
      return NextResponse.redirect(new URL('/login?message=Email confirmed successfully. Please sign in.', requestUrl.origin))
    }
  }

  // URL to redirect to after sign in process completes
  const redirectUrl = next || '/dashboard'
  return NextResponse.redirect(new URL(redirectUrl, requestUrl.origin))
}