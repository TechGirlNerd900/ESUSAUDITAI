import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  message?: string
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  
  constructor(private config: RateLimitConfig) {}

  private getKey(request: NextRequest): string {
    // Use IP address as the key, with fallback to a generic key
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown'
    return ip
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key)
      }
    }
  }

  check(request: NextRequest): { allowed: boolean; resetTime?: number; remaining?: number } {
    this.cleanup()
    
    const key = this.getKey(request)
    const now = Date.now()
    const resetTime = now + this.config.windowMs
    
    const entry = this.store.get(key)
    
    if (!entry || now > entry.resetTime) {
      // First request or window has reset
      this.store.set(key, { count: 1, resetTime })
      return { allowed: true, resetTime, remaining: this.config.maxRequests - 1 }
    }
    
    if (entry.count >= this.config.maxRequests) {
      // Rate limit exceeded
      return { allowed: false, resetTime: entry.resetTime, remaining: 0 }
    }
    
    // Increment count
    entry.count++
    this.store.set(key, entry)
    
    return { allowed: true, resetTime: entry.resetTime, remaining: this.config.maxRequests - entry.count }
  }

  middleware(config?: Partial<RateLimitConfig>) {
    const finalConfig = { ...this.config, ...config }
    const limiter = new RateLimiter(finalConfig)
    
    return (request: NextRequest) => {
      const result = limiter.check(request)
      
      if (!result.allowed) {
        return NextResponse.json(
          { 
            error: finalConfig.message || 'Too many requests, please try again later.',
            retryAfter: Math.ceil((result.resetTime! - Date.now()) / 1000)
          },
          { 
            status: 429,
            headers: {
              'Retry-After': Math.ceil((result.resetTime! - Date.now()) / 1000).toString(),
              'X-RateLimit-Limit': finalConfig.maxRequests.toString(),
              'X-RateLimit-Remaining': result.remaining?.toString() || '0',
              'X-RateLimit-Reset': Math.ceil(result.resetTime! / 1000).toString()
            }
          }
        )
      }
      
      return null // Continue to next middleware/handler
    }
  }
}

// Export pre-configured rate limiters
export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts, please try again later.'
})

export const apiRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many API requests, please try again later.'
})

export const projectRateLimiter = new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 20,
  message: 'Too many project operations, please try again later.'
})