import { NextResponse } from 'next/server';

// Define CSP directives
const cspDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-inline and unsafe-eval might be needed for some libraries
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};

// Function to format CSP directives into a string
function formatCsp(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, value]) => `${key} ${value.join(' ')}`)
    .join('; ');
}

export function addSecurityHeaders(response: NextResponse): NextResponse {
  const headers = response.headers;

  // Content Security Policy
  headers.set('Content-Security-Policy', formatCsp(cspDirectives));

  // X-Content-Type-Options
  headers.set('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options
  headers.set('X-Frame-Options', 'DENY');

  // Strict-Transport-Security
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // X-XSS-Protection
  headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  return response;
}
