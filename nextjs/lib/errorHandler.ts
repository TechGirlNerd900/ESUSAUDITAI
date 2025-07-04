import { NextRequest, NextResponse } from 'next/server';

// Define error types for better categorization
export enum ErrorType {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  DATABASE = 'DATABASE',
  RATE_LIMIT = 'RATE_LIMIT',
  INTERNAL = 'INTERNAL',
}

// Enhanced base error class with additional properties
export class AppError extends Error {
  type: ErrorType;
  statusCode: number;
  details?: any;
  isOperational: boolean;

  constructor(
    message: string,
    type: ErrorType = ErrorType.INTERNAL,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational; // Helps distinguish operational vs programmer errors

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// For backward compatibility
export class ApiError extends AppError {
  constructor(message: string, statusCode: number = 500) {
    super(message, ErrorType.INTERNAL, statusCode);
  }
}

// Predefined error factories for common error scenarios
export class ValidationError extends AppError {
  constructor(
    message: string = 'Validation failed',
    public details?: Array<{ field: string; message: string }>
  ) {
    super(message, ErrorType.VALIDATION, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, ErrorType.NOT_FOUND, 404);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, ErrorType.AUTHORIZATION, 403);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, ErrorType.AUTHENTICATION, 401);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, ErrorType.RATE_LIMIT, 429);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.CONFLICT, 409, details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: any) {
    super(`${service} service error: ${message}`, ErrorType.EXTERNAL_SERVICE, 502, details);
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, message: string, details?: any) {
    super(`Database ${operation} error: ${message}`, ErrorType.DATABASE, 500, details);
  }
}

// Retry mechanism with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    shouldRetry?: (error: any) => boolean;
    onRetry?: (error: any, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 300,
    shouldRetry = (error) => true,
    onRetry = (error, attempt) => {},
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (!shouldRetry(error) || attempt === maxRetries) {
        break;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) * (0.9 + Math.random() * 0.2);

      // Call the onRetry callback
      onRetry(error, attempt);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Enhanced higher-order function to handle API errors consistently
 * Wraps API route handlers with standardized error handling
 */
export function withErrorHandling(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse | Response>
) {
  return async (req: NextRequest, context?: any) => {
    try {
      return await handler(req, context);
    } catch (error: any) {
      // Log the error with request context
      logError(error, {
        url: req.url,
        method: req.method,
        headers: Object.fromEntries(req.headers.entries()),
        timestamp: new Date().toISOString(),
      });

      // Handle AppError and ApiError instances
      if (error instanceof AppError || error instanceof ApiError) {
        return NextResponse.json(
          {
            error: error.message,
            type: error instanceof AppError ? error.type : ErrorType.INTERNAL,
            ...(error.details && { details: error.details }),
          },
          { status: error.statusCode }
        );
      }

      // Handle Supabase errors
      if (error?.code && (error?.message || error?.msg)) {
        // Map common Supabase error codes to appropriate HTTP status codes
        let statusCode = 500;
        let errorType = ErrorType.DATABASE;

        if (error.code === '23505') {
          // Unique violation
          statusCode = 409;
          errorType = ErrorType.CONFLICT;
        } else if (error.code === '23503') {
          // Foreign key violation
          statusCode = 400;
          errorType = ErrorType.VALIDATION;
        } else if (error.code === '42P01') {
          // Undefined table
          statusCode = 500;
          errorType = ErrorType.INTERNAL;
        } else if (error.code === '42703') {
          // Undefined column
          statusCode = 500;
          errorType = ErrorType.INTERNAL;
        }

        return NextResponse.json(
          {
            error: error.message || error.msg,
            type: errorType,
            code: error.code,
          },
          { status: statusCode }
        );
      }

      // Handle Prisma or database errors (assuming 'code' property exists on Prisma errors)
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'string' &&
        error.code.startsWith('P')
      ) {
        return NextResponse.json(
          {
            error: 'Database error',
            details: error.message,
            type: ErrorType.DATABASE,
          },
          { status: 500 }
        );
      }

      // Handle generic validation errors (if not a custom ValidationError)
      if (
        error &&
        typeof error === 'object' &&
        'errors' in error &&
        Array.isArray((error as any).errors)
      ) {
        return NextResponse.json(
          {
            error: 'Validation error',
            details: (error as any).errors.map((e: any) => e.message || e),
            type: ErrorType.VALIDATION,
          },
          { status: 400 }
        );
      }

      // Default error response
      return NextResponse.json(
        {
          error: 'An unexpected error occurred',
          type: ErrorType.INTERNAL,
          ...(process.env.NODE_ENV !== 'production' && {
            message: error.message,
            stack: error.stack,
          }),
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Utility to handle async/await errors in a cleaner way
 * Returns [data, error] tuple similar to Go lang pattern
 */
export async function catchAsync<T>(promise: Promise<T>): Promise<[T | null, Error | null]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

// Error logging function
export function logError(error: any, context: Record<string, any> = {}) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    type: error instanceof AppError ? error.type : 'UNKNOWN',
    isOperational: error instanceof AppError ? error.isOperational : false,
    ...context,
  };

  // In production, you would send this to a logging service
  console.error('Error Log:', JSON.stringify(errorLog));

  // Return the log for potential further processing
  return errorLog;
}

// Circuit breaker implementation
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly successThreshold: number;

  constructor(
    failureThreshold: number = 5,
    resetTimeout: number = 30000,
    successThreshold: number = 2
  ) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.successThreshold = successThreshold;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Check if it's time to try again
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new AppError('Service temporarily unavailable', ErrorType.EXTERNAL_SERVICE, 503, {
          circuitState: this.state,
        });
      }
    }

    try {
      const result = await operation();

      // Handle success
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= this.successThreshold) {
          this.reset();
        }
      }

      return result;
    } catch (error) {
      // Handle failure
      this.lastFailureTime = Date.now();

      if (this.state === 'CLOSED') {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
          this.state = 'OPEN';
        }
      } else if (this.state === 'HALF_OPEN') {
        this.state = 'OPEN';
      }

      throw error;
    }
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}
