import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export interface AuthenticatedUser {
  id: string
  email: string
  role: 'admin' | 'auditor' | 'reviewer'
  organizationId: string
  firstName: string
  lastName: string
}

export interface AuthResult {
  success: boolean
  user?: AuthenticatedUser
  error?: string
}

export async function authenticateApiRequest(requireRole?: string[]): Promise<AuthResult> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          }
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { success: false, error: 'Authentication required' }
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
      return { success: false, error: 'User profile not found' }
    }

    // Check organization status
    if (Array.isArray(profile.organizations) && profile.organizations[0]?.status !== 'active') {
      return { success: false, error: 'Organization inactive' }
    } else if (!Array.isArray(profile.organizations) && profile.organizations?.status !== 'active') {
      return { success: false, error: 'Organization inactive' }
    }

    // Check role requirements
    if (requireRole && !requireRole.includes(profile.role)) {
      return { success: false, error: 'Insufficient permissions' }
    }

    return {
      success: true,
      user: {
        id: profile.id,
        email: user.email!,
        role: profile.role,
        organizationId: profile.organization_id,
        firstName: profile.first_name,
        lastName: profile.last_name
      }
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return { success: false, error: 'Authentication failed' }
  }
}

// Higher-order function to wrap API routes with authentication
export function withAuth(
  handler: (request: NextRequest, user: AuthenticatedUser, params?: any) => Promise<Response>,
  requireRole?: string[]
) {
  return async (request: NextRequest, context?: { params: any }) => {
    const authResult = await authenticateApiRequest(requireRole)
    
    if (!authResult.success || !authResult.user) {
      return new Response(
        JSON.stringify({ error: authResult.error || 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    try {
      return await handler(request, authResult.user, context?.params)
    } catch (error) {
      console.error('API handler error:', error)
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
}


