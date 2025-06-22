import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

// Define public paths that don't require auth check
const publicPaths = [
  '/_next', 
  '/static', 
  '/login', 
  '/register', 
  '/reset-password', 
  '/auth'
]

// Define public API routes that don't need authentication in middleware
const publicApiPaths = [
  '/api/auth/callback',
  '/api/auth/logout',
  '/api/auth/signup' // Updated to reflect the correct signup endpoint
]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  console.log('🛡️ Middleware running for:', pathname);

  // Skip middleware for static files
  if (pathname.includes('.') && !pathname.startsWith('/api')) {
    console.log('⏭️ Skipping middleware for static file:', pathname);
    return NextResponse.next()
  }

  // Skip middleware for public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    console.log('⏭️ Skipping middleware for public path:', pathname);
    return NextResponse.next()
  }

  // Skip middleware for specific public API routes
  if (publicApiPaths.some(path => pathname.startsWith(path))) {
    console.log('⏭️ Skipping middleware for public API path:', pathname);
    return NextResponse.next()
  }

  // For protected API routes, let them handle their own authentication
  if (pathname.startsWith('/api')) {
    console.log('⏭️ Skipping middleware for API route (handled by route):', pathname);
    return NextResponse.next()
  }

  try {
    console.log('🔍 Creating Supabase client for middleware...');
    const { supabase, response } = createClient(request)
    
    console.log('📋 Request cookies:', request.cookies.getAll().map(c => `${c.name}=${c.value.substring(0, 10)}...`));
    
    const { data: { session }, error } = await supabase.auth.getSession()
    
    console.log('🔍 Middleware session check:', {
      hasSession: !!session,
      error: error?.message,
      userId: session?.user?.id,
      expiresAt: session?.expires_at ? new Date(session.expires_at * 1000) : null
    });
    
    if (error || !session) {
      console.error('❌ Middleware auth failed:', error?.message || 'No session');
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.protocol = 'http:' // Force HTTP for local development
      url.searchParams.set('error', error?.message || 'Session expired')
      console.log('🔄 Redirecting to:', url.toString());
      return NextResponse.redirect(url)
    }

    console.log('✅ Middleware auth successful, continuing...');
    return response
  } catch (error) {
    console.error('💥 Middleware error:', error)
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.protocol = 'http:' // Force HTTP for local development
    url.searchParams.set('error', 'Authentication failed')
    console.log('🔄 Redirecting to (error):', url.toString());
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}