import { NextRequest, NextResponse } from 'next/server';

// Custom error classes for better error handling
export class ApiError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string = 'Validation failed', public details?: Array<{ field: string; message: string }>) {
    super(message, 400);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429);
  }
}

/**
 * Higher-order function to handle API errors consistently
 * Wraps API route handlers with standardized error handling
 */
export function withErrorHandling(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse | Response>
) {
  return async (req: NextRequest, context?: any) => {
    try {
      return await handler(req, context);
    } catch (error) {
      console.error('API Error:', error);
      
      // Handle custom API errors
      if (error instanceof ApiError) {
        // Specifically handle ValidationError to include details
        if (error instanceof ValidationError && error.details) {
          return NextResponse.json(
            { error: error.message, details: error.details },
            { status: error.statusCode }
          );
        }
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
      
      // Handle Prisma or database errors (assuming 'code' property exists on Prisma errors)
      if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && error.code.startsWith('P')) {
        return NextResponse.json(
          { error: 'Database error', details: (error as any).message },
          { status: 500 }
        );
      }
      
      // Handle generic validation errors (if not a custom ValidationError)
      if (error && typeof error === 'object' && 'errors' in error && Array.isArray((error as any).errors)) {
        return NextResponse.json(
          {
            error: 'Validation error',
            details: (error as any).errors.map((e: any) => e.message || e)
          },
          { status: 400 }
        );
      }
      
      // Default error response
      return NextResponse.json(
        { error: 'An unexpected error occurred' },
        { status: 500 }
      );
    }
  };
}

/**
 * Utility to handle async/await errors in a cleaner way
 * Returns [data, error] tuple similar to Go lang pattern
 */
export async function catchAsync<T>(
  promise: Promise<T>
): Promise<[T | null, Error | null]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}