import { createClient } from '@/utils/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const supabase = await createClient()

  // Sign out of Supabase
  await supabase.auth.signOut()

  // Return path to redirect to after sign out
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}