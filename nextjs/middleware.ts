import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/middleware';

// Define public paths that don't require auth check
const publicPaths = ['/_next', '/static', '/login', '/register', '/signup', '/reset-password', '/auth'];

// Define public API routes that don't need authentication in middleware
const publicApiPaths = [
  '/api/auth/callback',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/signup',
  '/api/auth/adminSignup',
  '/api/auth/reset-password',
  '/api/auth/update-password',
];

// Define admin-only paths
const adminPaths = ['/admin', '/api/admin'];

// In-memory rate limit store
// In production, use Redis or another distributed store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration
const apiRateLimit = {
  standard: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
  auth: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 auth requests per minute
  sensitive: { windowMs: 60 * 1000, maxRequests: 20 }, // 20 requests per minute for sensitive operations
};

/**
 * Apply rate limiting to a request
 * @param request The incoming request
 * @param maxRequests Maximum number of requests allowed in the window
 * @param windowMs Time window in milliseconds
 * @returns NextResponse if rate limit is exceeded, undefined otherwise
 */
function applyRateLimit(
  request: NextRequest,
  maxRequests: number,
  windowMs: number
): NextResponse | undefined {
  // Skip rate limiting in development
  if (process.env.NODE_ENV === 'development') {
    return undefined;
  }

  // Get IP from headers as request.ip is not available in NextRequest
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();

  // Get current rate limit data for this key
  const rateData = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };

  // Reset count if window has expired
  if (now > rateData.resetTime) {
    rateData.count = 0;
    rateData.resetTime = now + windowMs;
  }

  // Check if rate limit is exceeded
  if (rateData.count >= maxRequests) {
    const response = NextResponse.json(
      { error: 'Too many requests, please try again later', type: 'RATE_LIMIT' },
      { status: 429 }
    );

    // Add rate limit headers
    response.headers.set('Retry-After', Math.ceil((rateData.resetTime - now) / 1000).toString());
    response.headers.set('X-RateLimit-Limit', maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', '0');
    response.headers.set('X-RateLimit-Reset', Math.ceil(rateData.resetTime / 1000).toString());

    return response;
  }

  // Increment count
  rateData.count++;
  rateLimitStore.set(key, rateData);

  return undefined;
}

/**
 * Add security headers to a response
 * @param response The response to add headers to
 * @returns The response with added security headers
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'"
  );

  // Other security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  return response;
}

/**
 * Check if a user has admin role
 * @param supabase Supabase client
 * @param userId User ID to check
 * @returns Whether the user has admin role
 */
async function isUserAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    // Temporarily disable admin check to prevent RLS recursion
    // TODO: Re-enable after fixing RLS policies
    // For now, allow access and let API routes handle authorization
    console.warn('Admin check temporarily disabled due to RLS recursion issue');
    return false; // Default to non-admin to be safe
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api');

  // Apply rate limiting for API routes
  if (isApiRoute) {
    let rateLimitConfig = apiRateLimit.standard;

    // Use stricter rate limits for auth endpoints
    if (pathname.startsWith('/api/auth/')) {
      rateLimitConfig = apiRateLimit.auth;
    }
    // Use stricter rate limits for sensitive operations
    else if (
      pathname.startsWith('/api/admin/') ||
      pathname.includes('/delete') ||
      pathname.includes('/update')
    ) {
      rateLimitConfig = apiRateLimit.sensitive;
    }

    const rateLimitResponse = applyRateLimit(
      request,
      rateLimitConfig.maxRequests,
      rateLimitConfig.windowMs
    );

    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  // Skip middleware for static files
  if (pathname.includes('.') && !isApiRoute) {
    return NextResponse.next();
  }

  // Skip middleware for public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Skip middleware for specific public API routes
  if (publicApiPaths.some((path) => pathname.startsWith(path))) {
    // Add security headers even for public API routes
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  // For protected API routes, let them handle their own authentication
  // but still apply security headers
  if (isApiRoute) {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  try {
    const { supabase, response } = createClient(request);

    // Add security headers to the response
    const secureResponse = addSecurityHeaders(response);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Handle refresh token errors by clearing session
    if (error && error.message?.includes('refresh_token_not_found')) {
      // Clear the session and redirect to login
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('message', 'Session expired. Please sign in again.');
      return NextResponse.redirect(url);
    }

    if (error || !user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';

      // Add return URL as a query parameter for redirect after login
      url.searchParams.set('returnUrl', request.nextUrl.pathname);

      if (error && !error.message?.includes('refresh_token_not_found')) {
        url.searchParams.set('error', error.message);
      }

      return NextResponse.redirect(url);
    }

    // Check for admin-only paths
    if (adminPaths.some((path) => pathname.startsWith(path))) {
      const isAdmin = await isUserAdmin(supabase, user.id);

      if (!isAdmin) {
        // Redirect non-admin users trying to access admin pages
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        url.searchParams.set('error', 'Access denied: Admin privileges required');
        return NextResponse.redirect(url);
      }
    }

    // Temporarily disable audit logging in middleware to prevent RLS recursion
    // TODO: Re-enable after fixing RLS policies
    // Audit logging will be handled at the API route level instead
    if (process.env.NODE_ENV === 'development') {
      console.log(`Middleware: Authenticated request to ${pathname} by user ${user.id}`);
    }

    return secureResponse;
  } catch (error) {
    console.error('Middleware error:', error);
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'Authentication failed');
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
