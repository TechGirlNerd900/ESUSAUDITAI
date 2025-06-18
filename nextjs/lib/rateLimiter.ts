import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

function getKey(request: NextRequest): string {
  // Use IP address as the key, with fallback to a generic key
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown'
  return ip
}

function createRateLimiter({ windowSec, max, message }: { windowSec: number, max: number, message: string }) {
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
    analytics: true,
  })
  return async (request: NextRequest) => {
    const key = getKey(request)
    const { success, reset, remaining } = await ratelimit.limit(key)
    if (!success) {
      const retryAfter = Math.ceil((reset * 1000 - Date.now()) / 1000)
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
      )
    }
    return null // Continue to next middleware/handler
  }
}

export const authRateLimiter = createRateLimiter({
  windowSec: 15 * 60, // 15 minutes
  max: 5,
  message: 'Too many authentication attempts, please try again later.'
})

export const apiRateLimiter = createRateLimiter({
  windowSec: 15 * 60, // 15 minutes
  max: 100,
  message: 'Too many API requests, please try again later.'
})

export const projectRateLimiter = createRateLimiter({
  windowSec: 5 * 60, // 5 minutes
  max: 20,
  message: 'Too many project operations, please try again later.'
})