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
  } = {}
): Promise<AuthResult> {
  try {
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

  // Users can only access resources in their organization
  return userProfile.organization_id === resourceOrganizationId
}

/**
 * Rate limiting helper - can be extended with Redis later
 */
export function createRateLimitCheck(requestsPerMinute: number = 60) {
  const requests = new Map<string, { count: number; resetTime: number }>()

  return (request: NextRequest): NextResponse | null => {
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'
    
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute
    
    const userRequests = requests.get(clientIP)
    
    if (!userRequests || now > userRequests.resetTime) {
      requests.set(clientIP, { count: 1, resetTime: now + windowMs })
      return null
    }
    
    if (userRequests.count >= requestsPerMinute) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
    
    userRequests.count++
    return null
  }
}