import { NextResponse, type NextRequest } from 'next/server'
import { authenticateApiRequest as authenticateRequest } from '@/lib/apiAuth'


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

  // Skip middleware for static files
  if (pathname.includes('.') && !pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Skip middleware for public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Skip middleware for specific public API routes
  if (publicApiPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // For protected API routes, let them handle their own authentication
  // This allows API routes to return proper JSON error responses
  if (pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'error' in auth && typeof auth.error === 'object' && auth.error !== null && 'message' in auth.error ? String((auth.error as { message: string }).message) : 'Unknown error')
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
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