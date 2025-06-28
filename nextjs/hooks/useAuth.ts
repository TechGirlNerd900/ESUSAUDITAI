/**
 * Authentication Hook - Phase 2.2
 * Purpose-driven hook for authentication state management
 */

import { useState, useEffect, useCallback } from 'react';
import { User, UserProfile } from '@/types/components';
import { Session } from '@supabase/supabase-js'; // Import Session type

interface AuthState {
  user: User | null;
  session: Session | null; // Add session to AuthState
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<{ user: User | null; session: Session | null; error: Error | null }>;
  signup: (email: string, password: string) => Promise<{ user: User | null; session: Session | null; error: Error | null }>; // Add signup
  logout: () => Promise<{ error: Error | null }>;
  refreshUser: () => Promise<void>;
  updateUser: (data: Partial<UserProfile>) => Promise<{ user: User | null; error: Error | null }>; // Rename updateProfile to updateUser
}

export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null, // Initialize session
    isLoading: true,
    error: null,
    isAuthenticated: false,
  });

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/auth/profile');
      if (response.ok) {
        const { user, session } = await response.json(); // Destructure session
        setState(prev => ({
          ...prev,
          user,
          session, // Set session
          isAuthenticated: true,
          isLoading: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          user: null,
          session: null, // Clear session
          isAuthenticated: false,
          isLoading: false,
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Authentication failed',
        isLoading: false,
        isAuthenticated: false,
      }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const { user, session } = await response.json();
        setState(prev => ({
          ...prev,
          user,
          session,
          isAuthenticated: true,
          isLoading: false,
        }));
        return { user, session, error: null };
      } else {
        const errorData = await response.json();
        const error = new Error(errorData.error || 'Login failed');
        setState(prev => ({
          ...prev,
          error: error.message,
          isLoading: false,
        }));
        return { user: null, session: null, error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return { user: null, session: null, error: error instanceof Error ? error : new Error(errorMessage) };
    }
  }, []); // Removed loadUser from dependency array as it's not needed after direct state update

  const signup = useCallback(async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const { user, session } = await response.json();
        setState(prev => ({
          ...prev,
          user,
          session,
          isAuthenticated: true,
          isLoading: false,
        }));
        return { user, session, error: null };
      } else {
        const errorData = await response.json();
        const error = new Error(errorData.error || 'Signup failed');
        setState(prev => ({
          ...prev,
          error: error.message,
          isLoading: false,
        }));
        return { user: null, session: null, error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Signup failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return { user: null, session: null, error: error instanceof Error ? error : new Error(errorMessage) };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/auth/logout', { method: 'POST' });

      if (response.ok) {
        setState({
          user: null,
          session: null, // Clear session on logout
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        // Redirect to login page
        window.location.href = '/login';
        return { error: null };
      } else {
        const errorData = await response.json();
        const error = new Error(errorData.error || 'Logout failed');
        setState(prev => ({
          ...prev,
          error: error.message,
          isLoading: false,
        }));
        return { error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return { error: error instanceof Error ? error : new Error(errorMessage) };
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  const updateUser = useCallback(async (data: Partial<UserProfile>) => { // Renamed to updateUser
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setState(prev => ({
          ...prev,
          user: updatedUser,
          isLoading: false,
        }));
        return { user: updatedUser, error: null };
      } else {
        const errorData = await response.json();
        const error = new Error(errorData.error || 'User update failed');
        setState(prev => ({
          ...prev,
          error: error.message,
          isLoading: false,
        }));
        return { user: null, error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'User update failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return { user: null, error: error instanceof Error ? error : new Error(errorMessage) };
    }
  }, []);

  return {
    ...state,
    login,
    signup, // Add signup to returned object
    logout,
    refreshUser,
    updateUser, // Rename updateProfile to updateUser
  };
}