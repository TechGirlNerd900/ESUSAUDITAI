import { withAuth } from '@/lib/auth/apiAuth'
import { NextRequest } from 'next/server'

export const GET = withAuth(async (request: NextRequest, user, supabase) => {
  return new Response(
    JSON.stringify({ 
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId
      }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
