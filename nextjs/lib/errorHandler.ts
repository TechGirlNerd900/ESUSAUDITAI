import { NextResponse } from 'next/server';

// Custom error classes
export class AuthenticationError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message = 'Authorization failed') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends Error {
  public fields?: any;
  constructor(message = 'Validation failed', fields?: any) {
    super(message);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export class NotFoundError extends Error {
  constructor(resource = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ApiError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

export class DatabaseError extends Error {
  public operation: string | undefined;
  public details?: any;
  constructor(operation?: string, message?: string, details?: any) {
    super(message || 'Database error');
    this.name = 'DatabaseError';
    this.operation = operation;
    this.details = details;
  }
}

export class ExternalServiceError extends Error {
  public serviceName: string;
  public originalMessage: string | undefined;
  constructor(serviceName: string, message?: string) {
    super(`External service error from ${serviceName}: ${message || 'An unknown error occurred'}`);
    this.name = 'ExternalServiceError';
    this.serviceName = serviceName;
    this.originalMessage = message;
  }
}

// Error handler middleware
export const withErrorHandling =
  (handler: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
    try {
      return await handler(req, res);
    } catch (error: any) {
      console.error('[API_ERROR]', error);

      if (error instanceof AuthenticationError) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error instanceof ValidationError) {
        return NextResponse.json({ error: error.message, fields: error.fields }, { status: 400 });
      }
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
  };

// Retry utility
export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; shouldRetry?: (error: any) => boolean } = {}
): Promise<T> => {
  const { maxRetries = 3, shouldRetry = () => true } = options;
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || i === maxRetries - 1) {
        throw error;
      }
      // Optional: add a delay before retrying
      // await new Promise(res => setTimeout(res, 1000 * Math.pow(2, i)));
    }
  }

  throw lastError;
};

// Circuit Breaker utility
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF-OPEN' = 'CLOSED';

  constructor(
    private failureThreshold: number,
    private resetTimeout: number,
    private halfOpenTimeout: number
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF-OPEN';
      } else {
        throw new Error('Circuit is open');
      }
    }

    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (error) {
      this.fail();
      throw error;
    }
  }

  private fail() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastFailureTime = Date.now();
    }
  }

  private reset() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
}
