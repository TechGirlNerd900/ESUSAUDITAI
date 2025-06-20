// Shared API Authentication Middleware
// Consolidates the repeated auth logic across 15+ API routes

import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export interface AuthUser {
  id: string
  email: string
  user_metadata?: any
  role?: string
}

export interface UserProfile {
  id: string
  auth_user_id: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'auditor' | 'reviewer'
  organization_id: string
  status: string
  is_active: boolean
  deleted_at?: string | null
}

export interface AuthSuccess {
  success: true;
  user: AuthUser;
  profile: UserProfile;
}

export interface AuthFailure {
  success: false;
  response: NextResponse;
}

export type AuthResult = AuthSuccess | AuthFailure

/**
 * Centralized API authentication middleware
 * Handles user auth check, profile validation, and rate limiting
 */
export async function authenticateApiRequest(
  request: NextRequest,
  options: {
    requireRole?: 'admin' | 'auditor' | 'reviewer'
    allowSelf?: boolean // For user-specific endpoints like /api/users/[id]
    targetUserId?: string // For self-access validation
    rateLimit?: number // Requests per minute, if not provided, no rate limiting is applied
  } = {}
): Promise<AuthResult> {
  try {
    // Apply rate limiting if configured
    if (options.rateLimit) {
      const rateLimiter = createRateLimitCheck(options.rateLimit)
      const rateLimitResponse = await rateLimiter(request)
      
      if (rateLimitResponse) {
        return {
          success: false,
          response: rateLimitResponse
        }
      }
    }
    
    const supabase = await createClient()

    // Check if user is authenticated
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Fetch user profile from users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', user.id)
      .eq('deleted_at', null)
      .single()

    if (profileError || !userProfile) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'User profile not found. Please contact support.' }, 
          { status: 403 }
        )
      }
    }

    // Check if user is active
    if (!userProfile.is_active || userProfile.status !== 'active') {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Account is inactive. Please contact support.' }, 
          { status: 403 }
        )
      }
    }

    // Role-based access control
    if (options.requireRole) {
      if (userProfile.role !== 'admin' && userProfile.role !== options.requireRole) {
        return {
          success: false,
          response: NextResponse.json(
            { error: `Access denied. ${options.requireRole} role required.` }, 
            { status: 403 }
          )
        }
      }
    }

    // Self-access validation for user-specific endpoints
    if (options.allowSelf && options.targetUserId) {
      const canAccess = userProfile.role === 'admin' || 
                       user.id === options.targetUserId ||
                       userProfile.id === options.targetUserId
      
      if (!canAccess) {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Access denied. You can only access your own resources.' }, 
            { status: 403 }
          )
        }
      }
    }

    return {
      success: true,
      user: user as AuthUser,
      profile: userProfile
    }

  } catch (error) {
    console.error('Authentication error:', error)
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Internal authentication error' }, 
        { status: 500 }
      )
    }
  }
}

/**
 * Utility for organization-based access control
 * Supports organization hierarchies where parent organizations can access child organizations
 */
export async function checkOrganizationAccess(
  supabase: any,
  userProfile: UserProfile,
  resourceOrganizationId: string
): Promise<boolean> {
  // Admin can access any organization
  if (userProfile.role === 'admin') {
    return true
  }

  // Direct organization match
  if (userProfile.organization_id === resourceOrganizationId) {
    return true
  }

  // Check if user's organization is a parent of the resource organization
  try {
    // Get the resource organization's hierarchy path
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('parent_organization_id, hierarchy_path')
      .eq('id', resourceOrganizationId)
      .single()

    if (orgError || !orgData) {
      console.error('Error checking organization hierarchy:', orgError)
      return false
    }

    // If organization has a hierarchy path, check if user's org is in the path
    if (orgData.hierarchy_path && Array.isArray(orgData.hierarchy_path)) {
      return orgData.hierarchy_path.includes(userProfile.organization_id)
    }

    // Check direct parent relationship
    return orgData.parent_organization_id === userProfile.organization_id
  } catch (error) {
    console.error('Error in organization access check:', error)
    // Fail closed - deny access on error
    return false
  }
}

/**
 * Rate limiting helper using Redis
 * Uses the Upstash Redis client for serverless-friendly rate limiting
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export function createRateLimitCheck(requestsPerMinute: number = 60) {
  // Create a sliding window rate limiter
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requestsPerMinute, '1 m'),
    analytics: true,
    prefix: 'api_ratelimit',
  })

  return async (request: NextRequest): Promise<NextResponse | null> => {
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                    request.headers.get('x-real-ip') || 
                    'unknown'
    
    // Add some entropy to prevent IP spoofing
    const identifier = `${clientIP}:${request.nextUrl.pathname}`
    
    try {
      const { success, limit, remaining, reset } = await ratelimit.limit(identifier)
      
      if (!success) {
        const resetTime = Math.ceil((reset - Date.now()) / 1000)
        
        return NextResponse.json(
          { 
            error: 'Too many requests. Please try again later.',
            retryAfter: resetTime
          },
          { 
            status: 429,
            headers: {
              'Retry-After': String(resetTime),
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': String(remaining),
              'X-RateLimit-Reset': String(reset)
            }
          }
        )
      }
      
      return null
    } catch (error) {
      console.error('Rate limiting error:', error)
      // Fail open - don't block requests if rate limiting fails
      return null
    }
  }
}