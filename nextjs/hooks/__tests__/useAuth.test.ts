import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';

// Mock Next.js navigation
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterRefresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
  }),
}));

// Mock Supabase client
const mockAuthSession = jest.fn().mockResolvedValue({ data: { session: null }, error: null });
const mockAuthSignInWithPassword = jest.fn();
const mockAuthSignUp = jest.fn();
const mockAuthSignOut = jest.fn();
const mockAuthUpdateUser = jest.fn();

const createMockSupabaseClient = () => ({
  auth: {
    getSession: mockAuthSession,
    signInWithPassword: mockAuthSignInWithPassword,
    signUp: mockAuthSignUp,
    signOut: mockAuthSignOut,
    updateUser: mockAuthUpdateUser,
  },
});

jest.mock('@/utils/supabase/client', () => ({
  createClient: createMockSupabaseClient,
}));


describe('useAuth', () => {
  // beforeEach(() => {
  //   // Clear mock calls before each test if needed, though Jest often handles this
  //   jest.clearAllMocks();
  // });

  it('should be defined', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current).toBeDefined();
  });

  it('handles logout successfully', async () => {
    // Arrange
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'abc' };

    mockAuthSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    mockAuthSignOut.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: null,
    });

    // Act & Assert
    const { result } = renderHook(() => useAuth());

    // Wait for the hook to initialize with the mock session
    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    let logoutResult;
    await act(async () => {
      logoutResult = await result.current.logout();
    });

    expect(logoutResult).toEqual({ error: null, data: { session: null, user: null } });
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(mockRouterPush).toHaveBeenCalledTimes(1); // Assuming redirectToLogin calls push
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
  });

  it('handles logout error', async () => {
    // Arrange
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'abc' };
    const mockError = new Error('Logout failed');

    mockAuthSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    mockAuthSignOut.mockResolvedValueOnce({
      data: null,
      error: mockError,
    });

    // Act & Assert
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.user).toEqual(mockUser)); // Wait for initial state

    let logoutResult;
    await act(async () => {
      logoutResult = await result.current.logout();
    });

    expect(logoutResult).toEqual({ error: mockError, data: null });
    // State should not be cleared if logout fails
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.session).toEqual(mockSession);
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(mockRouterRefresh).not.toHaveBeenCalled();
  });

  it('handles update user successfully', async () => {
    // Arrange
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'abc' };
    const updatedUserDetails = { email: 'updated@example.com' };
    const updatedUserFromSupabase = { ...mockUser, email: 'updated@example.com' };

    mockAuthSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    mockAuthUpdateUser.mockResolvedValueOnce({
      data: { user: updatedUserFromSupabase },
      error: null,
    });

    // Act & Assert
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.user).toEqual(mockUser)); // Wait for initial state

    let updateResult;
    await act(async () => {
      updateResult = await result.current.updateUser(updatedUserDetails);
    });

    expect(mockAuthUpdateUser).toHaveBeenCalledWith(updatedUserDetails);
    expect(updateResult).toEqual({ user: updatedUserFromSupabase, error: null });
    expect(result.current.user).toEqual(updatedUserFromSupabase);
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it('handles update user error', async () => {
    // Arrange
    const mockUser = { id: '123', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'abc' };
    const mockError = new Error('Update failed');
    const updateUserDetails = { email: 'invalid@example.com' };

    mockAuthSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    mockAuthUpdateUser.mockResolvedValueOnce({
      data: { user: null }, // Supabase might return user: null on error
      error: mockError,
    });

    // Act & Assert
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.user).toEqual(mockUser)); // Wait for initial state

    let updateResult;
    await act(async () => {
      updateResult = await result.current.updateUser(updateUserDetails);
    });

    expect(mockAuthUpdateUser).toHaveBeenCalledWith(updateUserDetails);
    expect(updateResult).toEqual({ user: null, error: mockError });
    // State should not be updated if update fails
    expect(result.current.user).toEqual(mockUser); // Remains the original user
    expect(mockRouterRefresh).not.toHaveBeenCalled();
  });
// Added a comment to trigger re-lint
});
