import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { AuthResult } from './types/auth'


export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return {
        success: false,
        error: {
          status: 401,
          message: error?.message || 'Unauthorized'
        }
      }
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (!profile) {
      return {
        success: false,
        error: {
          status: 404,
          message: 'User profile not found'
        }
      }
    }

    return {
      success: true,
      profile
    }
  } catch (error) {
    return {
      success: false,
      error: {
        status: 500,
        message: error instanceof Error ? error.message : 'Internal server error'
      }
    }
  }
}