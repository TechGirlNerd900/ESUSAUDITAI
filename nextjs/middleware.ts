import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
  '/api/auth/register'
]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  console.log('[Middleware] Processing request for:', pathname)

  // Handle potential network/config fetch issues
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[Middleware] Missing required Supabase configuration')
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'System configuration error')
    return NextResponse.redirect(url)
  }

  // Skip middleware for static files
  if (pathname.includes('.') && !pathname.startsWith('/api')) {
    console.log('[Middleware] Skipping static file:', pathname)
    return NextResponse.next()
  }

  // Skip middleware for public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    console.log('[Middleware] Skipping public path:', pathname)
    return NextResponse.next()
  }

  // Skip middleware for specific public API routes
  if (publicApiPaths.some(path => pathname.startsWith(path))) {
    console.log('[Middleware] Skipping public API route:', pathname)
    return NextResponse.next()
  }

  // For protected API routes, let them handle their own authentication
  // This allows API routes to return proper JSON error responses
  if (pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Create a new response with the updated cookies
            supabaseResponse = NextResponse.next({
              request,
            })
            
            // Set all cookies with their proper options
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                supabaseResponse.cookies.set(name, value, options)
              } catch (e) {
                console.error('[Middleware] Cookie setting error:', e)
              }
            })
          },
        },
      }
    )

    // Add timeout for auth requests
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Auth request timeout')), 5000)
    )
    const authPromise = supabase.auth.getUser()
    
    const { data: { user }, error } = await Promise.race([authPromise, timeoutPromise])
      .catch(error => ({ data: { user: null }, error }))

    if (error || !user) {
      console.log('[Middleware] Auth failed:', error?.message || 'No user found')
      // Store the original URL to redirect back after login
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectTo', request.nextUrl.pathname)
      console.log('[Middleware] Redirecting to:', url.toString())
      return NextResponse.redirect(url)
    }

    console.log('[Middleware] Auth successful for user:', user.id)
    return supabaseResponse
  } catch (error) {
    console.error('[Middleware] Critical error:', error)
    // Redirect to login on error with a generic error message
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'An error occurred during authentication')
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}