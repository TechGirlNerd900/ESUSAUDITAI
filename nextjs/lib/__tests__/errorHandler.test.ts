import {
  withErrorHandling,
  ApiError,
  NotFoundError,
  AuthorizationError,
  ValidationError,
  RateLimitError,
} from '../errorHandler';
import { NextRequest, NextResponse } from 'next/server';

// Mock console.error to suppress output during tests
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('errorHandler', () => {
  // Restore console.error after all tests
  afterAll(() => {
    jest.restoreAllMocks();
  });

  // Mock a simple API handler function
  const mockHandler = async (req: NextRequest) => {
    const { action } = await req.json();
    switch (action) {
      case 'success':
        return NextResponse.json({ message: 'Success' }, { status: 200 });
      case 'api_error':
        throw new ApiError('Something went wrong with the API', 500);
      case 'not_found':
        throw new NotFoundError('Resource not found');
      case 'validation_error':
        // Pass details to ValidationError
        throw new ValidationError('Invalid input', [
          { field: 'name', message: 'Name is required' },
        ]);
      case 'authorization_error':
        throw new AuthorizationError('Unauthorized access');
      case 'rate_limit_error':
        throw new RateLimitError('Too many requests');
      case 'generic_error':
        throw new Error('Unexpected generic error');
      default:
        return NextResponse.json({ message: 'Default action' }, { status: 200 });
    }
  };

  const wrappedHandler = withErrorHandling(mockHandler);

  it('should return a successful response for valid actions', async () => {
    const req = new NextRequest('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'success' }),
    });
    const res = await wrappedHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ message: 'Success' });
  });

  it('should handle ApiError and return appropriate status and message', async () => {
    const req = new NextRequest('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'api_error' }),
    });
    const res = await wrappedHandler(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ error: 'Something went wrong with the API' });
  });

  it('should handle NotFoundError and return 404 status', async () => {
    const req = new NextRequest('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'not_found' }),
    });
    const res = await wrappedHandler(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data).toEqual({ error: 'Resource not found' });
  });

  it('should handle ValidationError and return 400 status with details', async () => {
    const req = new NextRequest('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'validation_error' }),
    });
    const res = await wrappedHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    // Expect the details property to be present and match
    expect(data).toEqual({
      error: 'Invalid input',
      details: [{ field: 'name', message: 'Name is required' }],
    });
  });

  it('should handle AuthorizationError and return 403 status', async () => {
    const req = new NextRequest('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'authorization_error' }),
    });
    const res = await wrappedHandler(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: 'Unauthorized access' });
  });

  it('should handle RateLimitError and return 429 status', async () => {
    const req = new NextRequest('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rate_limit_error' }),
    });
    const res = await wrappedHandler(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data).toEqual({ error: 'Too many requests' });
  });

  it('should handle generic errors and return 500 status', async () => {
    const req = new NextRequest('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generic_error' }),
    });
    const res = await wrappedHandler(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ error: 'An unexpected error occurred' });
  });

  it('should return 500 for non-json request body errors', async () => {
    const req = new NextRequest('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json', // Malformed JSON
    });
    const res = await wrappedHandler(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ error: 'An unexpected error occurred' });
  });

  it('should log errors to console in development mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true,
      configurable: true,
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const req = new NextRequest('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generic_error' }),
    });
    await wrappedHandler(req);

    expect(consoleErrorSpy).toHaveBeenCalled();
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
      configurable: true,
    });
    consoleErrorSpy.mockRestore();
  });

  it('should not log errors to console in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      writable: true,
      configurable: true,
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const req = new NextRequest('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generic_error' }),
    });
    await wrappedHandler(req);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
      configurable: true,
    });
    consoleErrorSpy.mockRestore();
  });
});
