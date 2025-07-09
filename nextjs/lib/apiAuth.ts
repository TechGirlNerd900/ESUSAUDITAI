// Shared API Authentication Middleware
// Consolidates the repeated auth logic across 15+ API routes

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export interface AuthUser {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  user_metadata: Record<string, any>;
  app_metadata: {
    provider_id: string;
    role: string;
    providers: Array<{
      domain: string | null;
      provider_id: string;
      provider_type: string;
    }>;
  };
}

// Add more specific error types
export interface AuthError {
  code: string;
  message: string;
  status: number;
}

export interface UserProfile {
  id: string;
  auth_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'auditor' | 'reviewer';
  organization_id: string;
  status: string;
  is_active: boolean;
  company?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface AuthSuccess {
  success: true;
  user: AuthUser;
  profile: UserProfile;
}

export interface AuthFailure {
  success: false;
  response: NextResponse;
  error?: {
    status: number;
    message: string;
  };
}

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Centralized API authentication middleware
 * Handles user auth check, profile validation, and rate limiting
 */
export async function authenticateApiRequest(
  request: NextRequest,
  options: {
    requireRole?: 'admin' | 'auditor' | 'reviewer';
    allowSelf?: boolean; // For user-specific endpoints like /api/users/[id]
    targetUserId?: string; // For self-access validation
    rateLimit?: number; // Requests per minute, if not provided, no rate limiting is applied
  } = {}
): Promise<AuthResult> {
  try {
    // Apply rate limiting if configured
    if (options.rateLimit) {
      const rateLimiter = await createRateLimitCheck(options.rateLimit);
      const rateLimitResponse = await rateLimiter(request);

      if (rateLimitResponse) {
        return {
          success: false,
          response: rateLimitResponse,
        };
      }
    }

    // Use the Supabase middleware client
    const client = await createClient();

    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return {
        success: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    // Transform the Supabase User object into AuthUser
    const authUser: AuthUser = {
      id: user.id,
      email: user.email ?? null,
      user_metadata: user.user_metadata || {},
      app_metadata: {
        provider_id: (user.app_metadata?.provider as string) || '', // Use 'provider' from Supabase app_metadata
        role: (user.app_metadata?.role as string) || 'auditor', // Assume 'role' is a custom claim in app_metadata
        providers:
          (user.app_metadata?.providers as Array<{
            domain: string | null;
            provider_id: string;
            provider_type: string;
          }>) || [], // Assume 'providers' is a custom claim
      },
    };

    // Fetch user profile with organization_id for multi-tenant security
    const { data: userProfile, error: profileError } = await client
      .from('users')
      .select('*')
      .eq('auth_user_id', user.id)
      .eq('deleted_at', null)
      .single();

    if (profileError || !userProfile) {
      console.error(
        profileError ? 'Profile fetch error:' : 'User profile not found:',
        profileError || user.id
      );
      // SECURITY: Do not auto-create profiles from unvalidated metadata
      // Profile creation should only happen through proper signup flow
      console.error('Profile creation attempted without proper validation - blocking for security');
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'User profile not found. Please complete proper signup process.',
          },
          { status: 403 }
        ),
      };
    }

    // Validate organization access - CRITICAL for multi-tenant security
    if (options.requireRole && userProfile.role !== options.requireRole) {
      console.error(
        `Required role ${options.requireRole} does not match user role ${userProfile.role}`
      );
      return {
        success: false,
        response: NextResponse.json(
          { error: `Forbidden: ${options.requireRole} access required` },
          { status: 403 }
        ),
      };
    }

    // Self-access validation for user-specific endpoints
    if (options.allowSelf && options.targetUserId) {
      const canAccess =
        userProfile.role === 'admin' ||
        userProfile.auth_user_id === options.targetUserId ||
        userProfile.id === options.targetUserId;

      if (!canAccess) {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Access denied. You can only access your own resources.' },
            { status: 403 }
          ),
        };
      }
    }

    return {
      success: true,
      user: authUser, // Use the transformed authUser
      profile: userProfile as UserProfile,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      response: NextResponse.json({ error: 'Internal authentication error' }, { status: 500 }),
    };
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
    return true;
  }

  // Direct organization match
  if (userProfile.organization_id === resourceOrganizationId) {
    return true;
  }

  // Check if user's organization is a parent of the resource organization
  try {
    // Get the resource organization's hierarchy path
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('parent_organization_id, hierarchy_path')
      .eq('id', resourceOrganizationId)
      .single();

    if (orgError || !orgData) {
      console.error('Error checking organization hierarchy:', orgError);
      return false;
    }

    // If organization has a hierarchy path, check if user's org is in the path
    if (orgData.hierarchy_path && Array.isArray(orgData.hierarchy_path)) {
      return orgData.hierarchy_path.includes(userProfile.organization_id);
    }

    // Check direct parent relationship
    return orgData.parent_organization_id === userProfile.organization_id;
  } catch (error) {
    console.error('Error in organization access check:', error);
    // Fail closed - deny access on error
    return false;
  }
}

/**
 * Rate limiting helper using Redis
 * Uses the Upstash Redis client for serverless-friendly rate limiting
 */
import { Ratelimit } from '@upstash/ratelimit';
import { createRedisClient } from '@/lib/env';

export async function createRateLimitCheck(requestsPerMinute: number = 60) {
  // Create a sliding window rate limiter if Redis is available
  let ratelimit: Ratelimit | null = null;

  try {
    const redis = await createRedisClient();
    if (redis) {
      ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requestsPerMinute, '1 m'),
        analytics: true,
        prefix: 'api_ratelimit',
      });
    } else {
      console.warn('Rate limiting disabled: Redis not available');
    }
  } catch (error) {
    console.warn('Rate limiting disabled: Ratelimit initialization failed', error);
  }

  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Skip rate limiting if not configured
    if (!ratelimit) {
      return null;
    }

    const clientIP =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Add some entropy to prevent IP spoofing
    const identifier = `${clientIP}:${request.nextUrl.pathname}`;

    try {
      const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

      if (!success) {
        const resetTime = Math.ceil((reset - Date.now()) / 1000);

        return NextResponse.json(
          {
            error: 'Too many requests. Please try again later.',
            retryAfter: resetTime,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(resetTime),
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': String(remaining),
              'X-RateLimit-Reset': String(reset),
            },
          }
        );
      }

      return null;
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open - don't block requests if rate limiting fails
      return null;
    }
  };
}
