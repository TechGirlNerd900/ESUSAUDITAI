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
  constructor(message: string = 'Validation failed') {
    super(message, 400);
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
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
      
      // Handle Prisma or database errors
      if (error.code && error.code.startsWith('P')) {
        return NextResponse.json(
          { error: 'Database error', details: error.message },
          { status: 500 }
        );
      }
      
      // Handle validation errors from Zod or other validators
      if (error.errors && Array.isArray(error.errors)) {
        return NextResponse.json(
          { 
            error: 'Validation error', 
            details: error.errors.map((e: any) => e.message || e).join(', ')
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