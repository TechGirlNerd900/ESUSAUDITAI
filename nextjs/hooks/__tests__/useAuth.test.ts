import { renderHook, act } from '@testing-library/react';
import { waitFor } from '@testing-library/dom';
import { useAuth } from '../useAuth';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  })),
}));

// Mock Supabase client
jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      updateUser: jest.fn(),
    },
  })),
}));

describe('useAuth', () => {
  let mockSupabase: ReturnType<typeof createClient>;
  let mockRouter: ReturnType<typeof useRouter>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createClient() as any;
    mockRouter = useRouter() as any;
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('initializes with null user and session if no session found', async () => {
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('initializes with user and session if session found', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'abc' };
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('handles login successfully', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'abc' };
    (mockSupabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: { user: mockUser, session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    let loginResult;
    await act(async () => {
      loginResult = await result.current.login('test@example.com', 'password123');
    });

    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(loginResult).toEqual({ user: mockUser, session: mockSession, error: null });
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.session).toEqual(mockSession);
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it('handles login error', async () => {
    const mockError = new Error('Login failed');
    (mockSupabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: mockError,
    });

    const { result } = renderHook(() => useAuth());

    let loginResult;
    await act(async () => {
      loginResult = await result.current.login('test@example.com', 'wrongpassword');
    });

    expect(loginResult).toEqual({ user: null, session: null, error: mockError });
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it('handles signup successfully', async () => {
    const mockUser = { id: '456', email: 'new@example.com' };
    const mockSession = { user: mockUser, access_token: 'def' };
    (mockSupabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: { user: mockUser, session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    let signupResult;
    await act(async () => {
      signupResult = await result.current.signup('new@example.com', 'newpassword');
    });

    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'newpassword',
    });
    expect(signupResult).toEqual({ user: mockUser, session: mockSession, error: null });
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.session).toEqual(mockSession);
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it('handles signup error', async () => {
    const mockError = new Error('Signup failed');
    (mockSupabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: mockError,
    });

    const { result } = renderHook(() => useAuth());

    let signupResult;
    await act(async () => {
      signupResult = await result.current.signup('bad@example.com', 'badpassword');
    });

    expect(signupResult).toEqual({ user: null, session: null, error: mockError });
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it('handles logout successfully', async () => {
    // Initialize with a logged-in state
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'abc' };
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });
    (mockSupabase.auth.signOut as jest.Mock).mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toBeDefined()); // Wait for initial state

    let logoutResult;
    await act(async () => {
      logoutResult = await result.current.logout();
    });

    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    expect(logoutResult).toEqual({ error: null });
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it('handles logout error', async () => {
    const mockError = new Error('Logout failed');
    (mockSupabase.auth.signOut as jest.Mock).mockResolvedValueOnce({ error: mockError });

    // Initialize with a logged-in state
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'abc' };
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toBeDefined()); // Wait for initial state

    let logoutResult;
    await act(async () => {
      logoutResult = await result.current.logout();
    });

    expect(logoutResult).toEqual({ error: mockError });
    // State should not be cleared if logout fails
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.session).toEqual(mockSession);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it('handles update user successfully', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'abc' };
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });
    const updatedUser = { ...mockUser, email: 'updated@example.com' };
    (mockSupabase.auth.updateUser as jest.Mock).mockResolvedValueOnce({
      data: { user: updatedUser },
      error: null,
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toBeDefined()); // Wait for initial state

    let updateResult;
    await act(async () => {
      updateResult = await result.current.updateUser({ email: 'updated@example.com' });
    });

    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ email: 'updated@example.com' });
    expect(updateResult).toEqual({ user: updatedUser, error: null });
    expect(result.current.user).toEqual(updatedUser);
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it('handles update user error', async () => {
    const mockError = new Error('Update failed');
    (mockSupabase.auth.updateUser as jest.Mock).mockResolvedValueOnce({
      data: { user: null },
      error: mockError,
    });

    // Initialize with a logged-in state
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'abc' };
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toBeDefined()); // Wait for initial state

    let updateResult;
    await act(async () => {
      updateResult = await result.current.updateUser({ email: 'invalid@example.com' });
    });

    expect(updateResult).toEqual({ user: null, error: mockError });
    // State should not be updated if update fails
    expect(result.current.user).toEqual(mockUser);
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });
});
// Added a comment to trigger re-lint
