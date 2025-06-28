import { NextRequest } from 'next/server'
import { withErrorHandling, ValidationError, AuthorizationError } from '@/lib/errorHandler'
import { successResponse, errorResponse } from '@/lib/apiResponse'
import { authRateLimiter } from '@/lib/rateLimiter'
import { createClient } from '@/utils/supabase/server'
import type { User } from '@/types/components'

/**
 * POST handler for user authentication
 * Standardized login with rate limiting, validation, and audit logging
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Apply rate limiting for login attempts
  const rateLimitResponse = await authRateLimiter(request)
  
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  // Parse and validate request body
  const body = await request.json()
  const { email, password } = body

  // Validate required fields
  if (!email || !password) {
    throw new ValidationError('Email and password are required')
  }

  // Validate email format
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format')
  }

  const supabase = await createClient()

  // Sign in with Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password
  })

  if (error) {
    console.error('Login error:', error)
    throw new AuthorizationError(error.message)
  }

  if (!data.session || !data.user) {
    throw new AuthorizationError('Login failed - no session created')
  }

  // Get user profile from database with organization context
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', data.user.id)
    .eq('deleted_at', null)
    .single()

  if (profileError || !profile) {
    console.error('Profile fetch error:', profileError)
    throw new AuthorizationError('User profile not found')
  }

  // Check if user is active
  if (!profile.is_active || profile.status !== 'active') {
    throw new AuthorizationError('Account is inactive. Please contact your administrator.')
  }

  // Create audit log entry for security tracking
  await supabase
    .from('audit_logs')
    .insert([{
      organization_id: profile.organization_id,
      user_id: profile.id,
      action: 'user_login',
      resource_type: 'user',
      resource_id: profile.id,
      details: {
        email: profile.email,
        login_time: new Date().toISOString(),
        ip_address: request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    }])

  // Return standardized success response
  return successResponse({
    user: {
      id: data.user.id,
      email: data.user.email,
      profile: {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        role: profile.role,
        organization_id: profile.organization_id,
        status: profile.status,
        is_active: profile.is_active
      }
    },
    session: {
      expires_at: data.session.expires_at
    }
  }, 'Login successful')
})