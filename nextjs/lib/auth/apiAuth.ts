import { createClientFromRequest } from '@/utils/supabase/server'
import { NextRequest } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * API Authentication Utilities
 * 
 * This module provides centralized authentication for API routes.
 * 
 * @example Using withAuth HOC for simple endpoints
 * ```typescript
 * export const GET = withAuth(async (request, user, supabase) => {
 *   // user and supabase are automatically provided
 *   // user.organizationId is guaranteed to be valid
 *   return NextResponse.json({ data: 'protected data' });
 * });
 * ```
 * 
 * @example Using withAuth with role requirements
 * ```typescript
 * export const GET = withAuth(async (request, user, supabase) => {
 *   // Only admins can access this endpoint
 *   return NextResponse.json({ adminData: 'sensitive' });
 * }, ['admin']);
 * ```
 * 
 * @example Using authenticateApiRequest for complex authorization
 * ```typescript
 * export const POST = async (request: NextRequest) => {
 *   const authResult = await authenticateApiRequest(request);
 *   if (!authResult.success) {
 *     return NextResponse.json({ error: authResult.error }, { status: 401 });
 *   }
 *   const { user, supabase } = authResult;
 *   // Implement custom authorization logic here
 * };
 * ```
 */

/**
 * Authenticated user information extracted from the database profile
 * This is returned by authenticateApiRequest and passed to withAuth handlers
 */
export interface AuthenticatedUser {
  id: string
  email: string
  role: 'admin' | 'super_admin' | 'auditor' | 'reviewer'
  organizationId: string
  firstName: string
  lastName: string
}

export interface AuthSuccess {
  success: true;
  user: AuthenticatedUser;
  profile: any;
  supabase: SupabaseClient;
}

export interface AuthFailure {
  success: false;
  error: string;
  supabase: SupabaseClient;
}

export type AuthResult = AuthSuccess | AuthFailure;


/**
 * Authenticates an API request and returns user profile with supabase client
 * 
 * This function:
 * - Validates the user's authentication token
 * - Fetches the user's profile from the database
 * - Checks organization status
 * - Optionally validates role requirements
 * 
 * @param request - The Next.js request object
 * @param requireRole - Optional array of roles that are allowed to access the endpoint
 * @returns AuthResult with user info and supabase client
 */
export async function authenticateApiRequest(request: NextRequest, requireRole?: string[]): Promise<AuthResult> {
  const supabase = createClientFromRequest(request)
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { success: false, error: 'Authentication required', supabase };
    }

    // Fetch user profile with organization
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        role,
        organization_id,
        status,
        organizations!inner (
          id,
          name,
          status
        )
      `)
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .single()

    if (profileError || !profile) {
      return { success: false, error: 'User profile not found', supabase };
    }

    // Check organization status
    if (!profile.organizations || (Array.isArray(profile.organizations) && profile.organizations.length === 0) || (profile.organizations as any)?.status !== 'active') {
      return { success: false, error: 'Organization inactive', supabase };
    }

    // Check role requirements
    if (requireRole && !requireRole.includes(profile.role)) {
      return { success: false, error: 'Insufficient permissions', supabase };
    }

    return {
      success: true,
      profile: profile, // Add profile here
      user: {
        id: profile.id,
        email: user.email!,
        role: profile.role,
        organizationId: profile.organization_id,
        firstName: profile.first_name,
        lastName: profile.last_name
      },
      supabase
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return { success: false, error: 'Authentication failed', supabase };
  }
}

/**
 * Higher-order function to wrap API routes with authentication
 * 
 * Use this HOC for most API endpoints. It automatically:
 * - Authenticates the request
 * - Validates user profile and organization
 * - Checks role requirements (if specified)
 * - Passes authenticated user and supabase client to your handler
 * - Handles authentication errors consistently
 * 
 * @param handler - Your API route handler function
 * @param requireRole - Optional array of roles allowed to access this endpoint
 * @returns Wrapped handler with authentication
 */
export function withAuth(
  handler: (request: NextRequest, user: AuthenticatedUser, supabase: SupabaseClient, params?: any) => Promise<Response>,
  requireRole?: string[]
) {
  return async (request: NextRequest, context?: { params: any }) => {
    const authResult = await authenticateApiRequest(request, requireRole)
    
    if (!authResult.success) {
      return new Response(
        JSON.stringify({ error: authResult.error || 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    try {
      return await handler(request, authResult.user, authResult.supabase, context?.params)
    } catch (error) {
      console.error('API handler error:', error)
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
}

export async function checkOrganizationAccess(supabase: SupabaseClient, profile: any, organizationId: string): Promise<boolean> {
  if (!profile || !organizationId) {
    return false;
  }
  return profile.organization_id === organizationId;
}