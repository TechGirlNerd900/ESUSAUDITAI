import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiting for demonstration
// In production, use Redis or similar
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  url: string;
  userAgent: string;
  retryCount: number;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'error';
  source: string;
  userId?: string;
  organizationId?: string;
  sessionId?: string;
  additionalContext?: Record<string, any>;
}

// Rate limiting: 10 errors per minute per IP
const RATE_LIMIT_WINDOW = 60 * 1000; // 60 seconds in milliseconds
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const clientData = rateLimitMap.get(ip);

  if (!clientData) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (now > clientData.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  clientData.count++;
  return true;
}

function validateErrorReport(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.id || typeof data.id !== 'string') {
    errors.push('Missing or invalid error ID');
  }

  if (!data.message || typeof data.message !== 'string') {
    errors.push('Missing or invalid error message');
  }

  if (!data.timestamp || typeof data.timestamp !== 'string') {
    errors.push('Missing or invalid timestamp');
  }

  if (!data.severity || !['low', 'medium', 'high', 'critical', 'error'].includes(data.severity)) {
    errors.push('Missing or invalid severity level');
  }

  if (!data.source || typeof data.source !== 'string') {
    errors.push('Missing or invalid error source');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function sanitizeErrorData(data: any): ErrorReport {
  // Remove potentially sensitive information
  const sanitized: ErrorReport = {
    id: data.id,
    message: data.message,
    timestamp: data.timestamp,
    url: data.url || 'unknown',
    userAgent: data.userAgent || 'unknown',
    retryCount: Math.max(0, parseInt(data.retryCount) || 0),
    severity: data.severity,
    source: data.source,
  };

  // Only include stack trace in development or for critical errors
  if (process.env.NODE_ENV === 'development' || data.severity === 'critical') {
    if (data.stack) sanitized.stack = data.stack;
    if (data.componentStack) sanitized.componentStack = data.componentStack;
  }

  // Include user context if available (without sensitive data)
  if (data.userId && typeof data.userId === 'string') {
    sanitized.userId = data.userId;
  }

  if (data.organizationId && typeof data.organizationId === 'string') {
    sanitized.organizationId = data.organizationId;
  }

  if (data.sessionId && typeof data.sessionId === 'string') {
    sanitized.sessionId = data.sessionId;
  }

  // Include additional context (sanitized)
  if (data.additionalContext && typeof data.additionalContext === 'object') {
    sanitized.additionalContext = Object.keys(data.additionalContext)
      .filter(
        (key) =>
          !['password', 'token', 'secret', 'key'].some((sensitive) =>
            key.toLowerCase().includes(sensitive)
          )
      )
      .reduce(
        (acc, key) => {
          acc[key] = data.additionalContext[key];
          return acc;
        },
        {} as Record<string, any>
      );
  }

  return sanitized;
}

function logErrorToService(errorData: ErrorReport) {
  try {
    // Log to console for immediate visibility
    console.error('[ERROR REPORT]', {
      id: errorData.id,
      severity: errorData.severity,
      message: errorData.message,
      source: errorData.source,
      timestamp: errorData.timestamp,
      url: errorData.url,
      retryCount: errorData.retryCount,
    });

    // In production, you would send to external services like:
    // - Sentry
    // - LogRocket
    // - DataDog
    // - Custom monitoring service

    if (process.env.NODE_ENV === 'production') {
      // Example: Send to external error tracking service
      // fetch(process.env.ERROR_TRACKING_ENDPOINT!, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorData)
      // }).catch(console.error)
    }
  } catch (error) {
    console.error('Failed to log error to external service:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Check rate limit
    const isAllowed = checkRateLimit(ip);
    if (!isAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Too many error reports from this IP.',
        },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate error report
    const validation = validateErrorReport(body);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid error report',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Sanitize error data
    const sanitizedError = sanitizeErrorData(body);

    // Log error to monitoring service
    logErrorToService(sanitizedError);

    return NextResponse.json({
      success: true,
      message: 'Error report received',
      errorId: sanitizedError.id,
    });
  } catch (error) {
    console.error('Error in error reporting endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while processing error report',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for retrieving recent critical errors (admin only)
export async function GET(request: NextRequest) {
  try {
    // In a real app, you'd check authentication/authorization here
    // const user = await getUserFromRequest(request)
    // if (!user || user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const url = new URL(request.url);
    const severity = url.searchParams.get('severity') || 'critical';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

    // In a real implementation, you'd fetch from your database or logging service
    // This is just a placeholder response
    const mockErrors = [
      {
        id: 'err_1234567890_abc123',
        message: 'Sample critical error',
        severity: 'critical',
        timestamp: new Date().toISOString(),
        source: 'error_boundary',
      },
    ];

    return NextResponse.json({
      success: true,
      errors: mockErrors.slice(0, limit),
      total: mockErrors.length,
      severity,
      limit,
    });
  } catch (error) {
    console.error('Error in error retrieval endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while retrieving errors',
      },
      { status: 500 }
    );
  }
}
