import { createClient } from '@/utils/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url)
    const supabase = await createClient()

    // Get current user before signing out for audit log
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Get user profile for audit log
      const { data: profile } = await supabase
        .from('users')
        .select('id, organization_id')
        .eq('auth_user_id', user.id)
        .single()

      // Create audit log entry for logout
      if (profile) {
        await supabase
          .from('audit_logs')
          .insert([{
            organization_id: profile.organization_id,
            user_id: profile.id,
            action: 'user_logout',
            resource_type: 'user',
            resource_id: profile.id,
            details: {
              logout_time: new Date().toISOString()
            }
          }])
      }
    }

    // Sign out of Supabase
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Logout error:', error)
      return NextResponse.json(
        { error: 'Failed to logout' },
        { status: 500 }
      )
    }

    // Return success response for API calls
    return NextResponse.json({ message: 'Logged out successfully' })

  } catch (error) {
    console.error('Logout API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Also support GET requests for direct logout links
export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url)
    const supabase = await createClient()

    // Get current user before signing out for audit log
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Get user profile for audit log
      const { data: profile } = await supabase
        .from('users')
        .select('id, organization_id')
        .eq('auth_user_id', user.id)
        .single()

      // Create audit log entry for logout
      if (profile) {
        await supabase
          .from('audit_logs')
          .insert([{
            organization_id: profile.organization_id,
            user_id: profile.id,
            action: 'user_logout',
            resource_type: 'user',
            resource_id: profile.id,
            details: {
              logout_time: new Date().toISOString()
            }
          }])
      }
    }

    // Sign out of Supabase
    await supabase.auth.signOut()

    // Redirect to login page
    return NextResponse.redirect(new URL('/login?message=Logged+out+successfully', requestUrl.origin))

  } catch (error) {
    console.error('Logout redirect error:', error)
    return NextResponse.redirect(new URL('/login?error=Logout+failed', requestUrl.origin))
  }
}