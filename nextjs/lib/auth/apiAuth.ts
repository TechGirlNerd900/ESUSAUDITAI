import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export interface AuthSuccess {
  success: true;
  user: any;
  profile: any;
}

export interface AuthFailure {
  success: false;
  response: NextResponse;
}

export type AuthResult = AuthSuccess | AuthFailure;

export async function authenticateApiRequest(
  request: NextRequest,
  options?: { requireRole?: string }
): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      response: NextResponse.json({ error: 'User profile not found' }, { status: 401 }),
    };
  }

  if (options?.requireRole) {
    const isAuthorized = authorize(profile, options.requireRole);
    if (!isAuthorized) {
      return {
        success: false,
        response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      };
    }
  }

  return {
    success: true,
    user,
    profile,
  };
}

/**
 * Role-based authorization function
 */
export function authorize(profile: any, requiredRole: string): boolean {
  const roleHierarchy = {
    admin: 3,
    auditor: 2,
    reviewer: 1,
  };

  const userRoleLevel = roleHierarchy[profile.role as keyof typeof roleHierarchy] || 0;
  const requiredRoleLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

  return userRoleLevel >= requiredRoleLevel;
}

export async function checkOrganizationAccess(
  supabase: any,
  profile: any,
  organizationId: string
): Promise<boolean> {
  if (profile.role === 'admin' || profile.organization_id === organizationId) {
    return true;
  }
  return false;
}

export async function getUserProfile(userId: string): Promise<any> {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    return null;
  }

  return profile;
}
