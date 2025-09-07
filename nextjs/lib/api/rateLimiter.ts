import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { createRedisClient } from '@/lib/env';

const redisPromise = createRedisClient();

function getKey(request: NextRequest): string {
  // Use IP address as the key, with fallback to a generic key
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';
  return ip;
}

function createRateLimiter({
  windowSec,
  max,
  message,
}: {
  windowSec: number;
  max: number;
  message: string;
}) {
  // Skip rate limiting if Redis is not available
  if (!redisPromise) {
    console.warn(`⚠️  Rate limiter "${message}" disabled - Redis not configured`);
    return async (_request: NextRequest) => null; // Always allow requests
  }

  return async (request: NextRequest) => {
    const redis = await redisPromise;
    if (!redis) {
      // This case should ideally be caught by the initial check, but as a safeguard
      console.warn(`⚠️  Rate limiter "${message}" disabled - Redis not available at runtime`);
      return null;
    }

    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      analytics: true,
    });

    try {
      const key = getKey(request);
      const { success, reset, remaining } = await ratelimit.limit(key);
      if (!success) {
        const retryAfter = Math.ceil((reset * 1000 - Date.now()) / 1000);
        const identifier = getKey(request);

        console.warn(`Rate limit exceeded for ${identifier}: ${remaining} requests remaining`);

        // Log rate limit violation for security monitoring
        try {
          const { createClient } = await import('@/utils/supabase/server');
          const supabase = await createClient();

          await supabase.from('security_events').insert({
            event_type: 'rate_limit_exceeded',
            severity: 'medium',
            details: {
              endpoint: request.nextUrl.pathname,
              identifier,
              limit: max,
              window_seconds: windowSec,
              remaining,
              reset_time: Math.ceil(reset),
              user_agent: request.headers.get('user-agent') || 'unknown',
            },
            ip_address: identifier,
            user_agent: request.headers.get('user-agent'),
            timestamp: new Date().toISOString(),
          });
        } catch (logError) {
          console.error('Failed to log rate limit violation:', logError);
        }

        return NextResponse.json(
          {
            error: message,
            retryAfter,
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': max.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': Math.ceil(reset).toString(),
            },
          }
        );
      }
      return null; // Continue to next middleware/handler
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open - don't block requests if rate limiting fails
      return null;
    }
  };
}

export const authRateLimiter = createRateLimiter({
  windowSec: 15 * 60, // 15 minutes
  max: 5,
  message: 'Too many authentication attempts, please try again later.',
});

export const apiRateLimiter = createRateLimiter({
  windowSec: 15 * 60, // 15 minutes
  max: 100,
  message: 'Too many API requests, please try again later.',
});

export const projectRateLimiter = createRateLimiter({
  windowSec: 5 * 60, // 5 minutes
  max: 20,
  message: 'Too many project operations, please try again later.',
});
