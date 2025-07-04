import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/middleware';

// Define public paths that don't require auth check
const publicPaths = ['/_next', '/static', '/login', '/register', '/reset-password', '/auth'];

// Define public API routes that don't need authentication in middleware
const publicApiPaths = [
  '/api/auth/callback',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/signup',
  '/api/auth/admin-signup',
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
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'"
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
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('auth_user_id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.role === 'admin' || data.role === 'super_admin';
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
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';

      // Add return URL as a query parameter for redirect after login
      url.searchParams.set('returnUrl', request.nextUrl.pathname);

      if (error) {
        url.searchParams.set('error', error.message);
      }

      return NextResponse.redirect(url);
    }

    // Check for admin-only paths
    if (adminPaths.some((path) => pathname.startsWith(path))) {
      const isAdmin = await isUserAdmin(supabase, session.user.id);

      if (!isAdmin) {
        // Redirect non-admin users trying to access admin pages
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        url.searchParams.set('error', 'Access denied: Admin privileges required');
        return NextResponse.redirect(url);
      }
    }

    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0; // Convert to milliseconds if defined
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresAt && expiresAt - now < fiveMinutes) {
      // Token is about to expire, refresh it
      // This happens automatically in the Supabase client
      // but we log it for monitoring
      console.log('Session token is about to expire, refreshing...');
    }

    // Add audit logging for authenticated requests
    try {
      // Skip audit logging for certain paths
      if (
        !pathname.startsWith('/_next') &&
        !pathname.startsWith('/static') &&
        !pathname.startsWith('/api/health') &&
        !pathname.startsWith('/api/metrics') &&
        !pathname.includes('favicon.ico')
      ) {
        // Get request details
        const method = request.method;
        const url = request.url;
        const referer = request.headers.get('referer') || '';
        const userAgent = request.headers.get('user-agent') || '';
        const ip = request.headers.get('x-forwarded-for') || '';

        // Determine action based on HTTP method
        let action = 'view';
        if (method === 'POST') action = 'create';
        if (method === 'PUT' || method === 'PATCH') action = 'update';
        if (method === 'DELETE') action = 'delete';

        // Determine resource type from path
        const pathParts = pathname.split('/').filter(Boolean);
        let resourceType = pathParts[0] || 'page';
        let resourceId = pathParts[1] || 'unknown';

        // For API routes, use more specific resource type
        if (resourceType === 'api' && pathParts.length > 1) {
          const newResourceType = pathParts[1];
          if (newResourceType) {
            resourceType = newResourceType;
          }
          resourceId = pathParts[2] || 'unknown';
        }

        // Get user profile to get the actual user ID (not auth user ID)
        const { data: userProfile, error: userProfileError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', session.user.id)
          .single();

        if (userProfileError) {
          console.error('Middleware: Error fetching user profile for audit logging:', userProfileError);
        } else if (userProfile) {
          // Log the action
          try {
            await supabase.rpc('log_action', {
              p_user_id: userProfile.id,
              p_action: action,
              p_resource_type: resourceType,
              p_resource_id: resourceId,
              p_details: {
                method,
                url,
                referer,
                path: pathname,
              },
              p_ip_address: ip,
              p_user_agent: userAgent,
            });
          } catch (rpcError) {
            console.error('Middleware: Error calling log_action RPC:', rpcError);
          }
        }
      }
    } catch (auditError) {
      // Log error but don't block the request
      console.error('Audit logging error:', auditError);
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
