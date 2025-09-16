/**
 * Security Headers Configuration - Enhanced Security Implementation
 * Provides secure Content Security Policy and other security headers
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';

export interface SecurityHeadersConfig {
  nonce?: string;
  isDevelopment?: boolean;
  supabaseUrl?: string;
}

/**
 * Generate a cryptographically secure nonce for CSP
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Create a secure Content Security Policy
 */
export function createCSP(config: SecurityHeadersConfig = {}): string {
  const { nonce, isDevelopment = false, supabaseUrl } = config;

  // Base CSP directives
  const directives = {
    'default-src': ["'none'"],
    'script-src': [
      "'self'",
      nonce ? `'nonce-${nonce}'` : null,
      // Next.js requires some specific script permissions
      isDevelopment ? "'unsafe-eval'" : null, // Only for development hot reloading
      // Trusted CDNs (if needed)
    ].filter(Boolean),

    'style-src': [
      "'self'",
      nonce ? `'nonce-${nonce}'` : null,
      // Allow inline styles for Next.js components with hash validation
      "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='", // Empty string hash
    ].filter(Boolean),

    'img-src': [
      "'self'",
      'data:',
      'blob:',
      // Supabase storage
      supabaseUrl ? supabaseUrl.replace('https://', 'https://*.') : null,
      // Avatar services
      'https://i.pravatar.cc',
      'https://ui-avatars.com',
    ].filter(Boolean),

    'font-src': ["'self'", 'data:'],

    'connect-src': [
      "'self'",
      // Supabase endpoints
      supabaseUrl ? `${supabaseUrl}` : null,
      supabaseUrl ? `${supabaseUrl.replace('https://', 'wss://')}/realtime/v1/websocket` : null,
      'https://*.supabase.co',
      'wss://*.supabase.co',
      // Gemini services
      'https://generativelanguage.googleapis.com',
      // Upstash Redis
      'https://*.upstash.io',
      // Application Insights
      'https://dc.services.visualstudio.com',
      // Development only
      isDevelopment ? 'ws://localhost:*' : null,
      isDevelopment ? 'http://localhost:*' : null,
    ].filter(Boolean),

    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'base-uri': ["'none'"],
    'object-src': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'media-src': ["'self'"],
    'child-src': ["'none'"],

    // Require HTTPS
    'upgrade-insecure-requests': [],

    // Block mixed content
    'block-all-mixed-content': [],
  };

  // Convert directives to CSP string
  const cspString = Object.entries(directives)
    .map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive;
      }
      return `${directive} ${sources.join(' ')}`;
    })
    .join('; ');

  return cspString;
}

/**
 * Create comprehensive security headers
 */
export function createSecurityHeaders(
  response: NextResponse,
  config: SecurityHeadersConfig = {}
): NextResponse {
  const { isDevelopment = false, supabaseUrl } = config;

  // Generate nonce for this request
  const nonce = generateNonce();

  // Content Security Policy
  const csp = createCSP({ ...config, nonce });
  response.headers.set('Content-Security-Policy', csp);

  // HTTP Strict Transport Security (HSTS)
  if (!isDevelopment) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // X-Frame-Options
  response.headers.set('X-Frame-Options', 'DENY');

  // X-Content-Type-Options
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // X-XSS-Protection (deprecated but still useful for older browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // X-Permitted-Cross-Domain-Policies
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  // X-DNS-Prefetch-Control
  response.headers.set('X-DNS-Prefetch-Control', 'off');

  // Cache-Control for security-sensitive pages
  if (response.url && (response.url.includes('/admin') || response.url.includes('/api/'))) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  // Cross-Origin Policies
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  // Permissions Policy (Feature Policy)
  const permissionsPolicy = [
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'battery=()',
    'camera=()',
    'cross-origin-isolated=()',
    'display-capture=()',
    'document-domain=()',
    'encrypted-media=()',
    'execution-while-not-rendered=()',
    'execution-while-out-of-viewport=()',
    'fullscreen=()',
    'geolocation=()',
    'gyroscope=()',
    'keyboard-map=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'navigation-override=()',
    'payment=()',
    'picture-in-picture=()',
    'publickey-credentials-get=()',
    'screen-wake-lock=()',
    'sync-xhr=()',
    'usb=()',
    'web-share=()',
    'xr-spatial-tracking=()',
  ].join(', ');

  response.headers.set('Permissions-Policy', permissionsPolicy);

  // Add nonce to response for use in components
  response.headers.set('X-Nonce', nonce);

  return response;
}

/**
 * Create development-friendly security headers
 */
export function createDevelopmentSecurityHeaders(
  response: NextResponse,
  supabaseUrl?: string
): NextResponse {
  const config: SecurityHeadersConfig = {
    isDevelopment: true,
  };

  if (supabaseUrl) {
    config.supabaseUrl = supabaseUrl;
  }

  return createSecurityHeaders(response, config);
}

/**
 * Create production security headers
 */
export function createProductionSecurityHeaders(
  response: NextResponse,
  supabaseUrl?: string
): NextResponse {
  const config: SecurityHeadersConfig = {
    isDevelopment: false,
  };

  if (supabaseUrl) {
    config.supabaseUrl = supabaseUrl;
  }

  return createSecurityHeaders(response, config);
}

/**
 * Middleware helper to add security headers based on environment
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (isDevelopment) {
    return createDevelopmentSecurityHeaders(response, supabaseUrl);
  } else {
    return createProductionSecurityHeaders(response, supabaseUrl);
  }
}

/**
 * Get CSP nonce from response headers (for use in components)
 */
export function getNonceFromHeaders(headers: Headers): string | null {
  return headers.get('X-Nonce');
}

/**
 * Validate CSP configuration
 */
export function validateCSPConfig(): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check if running in development with production-like settings
  if (process.env.NODE_ENV === 'development') {
    recommendations.push(
      'CSP is relaxed for development. Ensure production settings are properly configured.'
    );
  }

  // Check for required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    issues.push('NEXT_PUBLIC_SUPABASE_URL not configured - Supabase connections may be blocked');
  }

  // Check CSP compatibility
  try {
    const testConfig = { isDevelopment: false };
    const testCSP = createCSP(testConfig);

    if (testCSP.includes('unsafe-inline') || testCSP.includes('unsafe-eval')) {
      issues.push('CSP contains unsafe directives');
    }
  } catch (error) {
    issues.push('Failed to generate CSP configuration');
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendations,
  };
}
