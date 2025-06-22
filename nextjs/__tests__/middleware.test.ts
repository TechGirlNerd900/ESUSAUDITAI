import { middleware } from '../middleware';
import { createClient } from '@/utils/supabase/middleware';

// Mock the next/server module
jest.mock('next/server', () => {
  return {
    NextResponse: {
      next: jest.fn(() => ({ cookies: { set: jest.fn() } })),
      redirect: jest.fn(() => ({ cookies: { set: jest.fn() } })),
    },
  };
});

// Get the mocked NextResponse
const mockNextResponse = jest.requireMock('next/server').NextResponse;

// Mock the createClient function
jest.mock('@/utils/supabase/middleware', () => ({
  createClient: jest.fn(),
}));

// Mock console methods to prevent noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
};

describe('Middleware', () => {
  let mockRequest;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock NextRequest
    mockRequest = {
      nextUrl: {
        pathname: '/dashboard',
        clone: jest.fn().mockReturnValue({
          pathname: '/login',
          searchParams: {
            set: jest.fn(),
          },
          toString: jest.fn().mockReturnValue('http://localhost/login'),
          protocol: 'http:',
        }),
      },
      cookies: {
        getAll: jest.fn().mockReturnValue([]),
        set: jest.fn(),
      },
    };
  });

  // Test 1: Skip middleware for static files
  test('should skip middleware for static files', async () => {
    mockRequest.nextUrl.pathname = '/image.png';
    
    await middleware(mockRequest);
    
    expect(mockNextResponse.next).toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  // Test 2: Skip middleware for public paths
  test('should skip middleware for public paths', async () => {
    mockRequest.nextUrl.pathname = '/login';
    
    await middleware(mockRequest);
    
    expect(mockNextResponse.next).toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  // Test 3: Skip middleware for public API paths
  test('should skip middleware for public API paths', async () => {
    mockRequest.nextUrl.pathname = '/api/auth/callback';
    
    await middleware(mockRequest);
    
    expect(mockNextResponse.next).toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  // Test 4: Skip middleware for API routes
  test('should skip middleware for API routes', async () => {
    mockRequest.nextUrl.pathname = '/api/some-endpoint';
    
    await middleware(mockRequest);
    
    expect(mockNextResponse.next).toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  // Test 5: Redirect when no session exists
  test('should redirect to login when no session exists', async () => {
    mockRequest.nextUrl.pathname = '/dashboard';
    
    const mockSupabaseClient = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
    };
    
    const mockResponse = { cookies: { set: jest.fn() } };
    (createClient).mockReturnValue({
      supabase: mockSupabaseClient,
      response: mockResponse,
    });
    
    await middleware(mockRequest);
    
    expect(createClient).toHaveBeenCalledWith(mockRequest);
    expect(mockSupabaseClient.auth.getSession).toHaveBeenCalled();
    expect(mockNextResponse.redirect).toHaveBeenCalled();
  });

  // Test 6: Redirect when auth error occurs
  test('should redirect to login when auth error occurs', async () => {
    mockRequest.nextUrl.pathname = '/dashboard';
    
    const mockSupabaseClient = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: null },
          error: { message: 'Auth error' },
        }),
      },
    };
    
    const mockResponse = { cookies: { set: jest.fn() } };
    (createClient).mockReturnValue({
      supabase: mockSupabaseClient,
      response: mockResponse,
    });
    
    await middleware(mockRequest);
    
    expect(createClient).toHaveBeenCalledWith(mockRequest);
    expect(mockSupabaseClient.auth.getSession).toHaveBeenCalled();
    expect(mockNextResponse.redirect).toHaveBeenCalled();
  });

  // Test 7: Continue when session is valid
  test('should continue when session is valid', async () => {
    mockRequest.nextUrl.pathname = '/dashboard';
    
    const mockSession = {
      user: { id: 'user-123' },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    
    const mockSupabaseClient = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: mockSession },
          error: null,
        }),
      },
    };
    
    const mockResponse = { cookies: { set: jest.fn() } };
    (createClient).mockReturnValue({
      supabase: mockSupabaseClient,
      response: mockResponse,
    });
    
    const result = await middleware(mockRequest);
    
    expect(createClient).toHaveBeenCalledWith(mockRequest);
    expect(mockSupabaseClient.auth.getSession).toHaveBeenCalled();
    expect(result).toBe(mockResponse);
  });

  // Test 8: Handle unexpected errors in middleware
  test('should redirect to login when unexpected error occurs', async () => {
    mockRequest.nextUrl.pathname = '/dashboard';
    
    (createClient).mockImplementation(() => {
      throw new Error('Unexpected error');
    });
    
    await middleware(mockRequest);
    
    expect(createClient).toHaveBeenCalledWith(mockRequest);
    expect(mockNextResponse.redirect).toHaveBeenCalled();
  });
});