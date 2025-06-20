// User Profile API Endpoint
// Returns current user's profile information for dashboard initialization

import { authenticateApiRequest } from '@/lib/apiAuth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Authenticate the user
  const auth = await authenticateApiRequest(request)
  if (!auth.success) {
    return auth.response
  }

  // Return user profile data
  return NextResponse.json({
    profile: {
      id: auth.profile.id,
      auth_user_id: auth.profile.auth_user_id,
      email: auth.profile.email,
      first_name: auth.profile.first_name,
      last_name: auth.profile.last_name,
      role: auth.profile.role,
      organization_id: auth.profile.organization_id,
      status: auth.profile.status,
      is_active: auth.profile.is_active
    },
    user: {
      id: auth.user.id,
      email: auth.user.email
    }
  })
}