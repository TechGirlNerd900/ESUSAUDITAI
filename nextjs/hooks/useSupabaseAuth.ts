/**
 * Supabase Authentication Hook - Phase 2.2 (Multi-tenant SaaS)
 * Purpose-driven hook for Supabase authentication with multi-tenancy
 */

import { useState, useEffect, useCallback } from 'react';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { User as AppUser, UserProfile } from '@/types/components';

interface AuthState {
  user: AppUser | null;
  supabaseUser: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  organizationId: string | null;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

export function useSupabaseAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    user: null,
    supabaseUser: null,
    isLoading: true,
    error: null,
    isAuthenticated: false,
    organizationId: null,
  });

  const supabase = createClient();

  // Load user and profile on mount
  useEffect(() => {
    getSession();

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN' && session) {
        await loadUserProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          supabaseUser: null,
          isLoading: false,
          error: null,
          isAuthenticated: false,
          organizationId: null,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const getSession = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setState(prev => ({
          ...prev,
          user: null,
          supabaseUser: null,
          isAuthenticated: false,
          isLoading: false,
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Session error',
        isLoading: false,
      }));
    }
  }, []);

  const loadUserProfile = useCallback(async (supabaseUser: User) => {
    try {
      // Get user profile from our custom users table (multi-tenant)
      const { data: userProfile, error } = await supabase
        .from('users')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('auth_user_id', supabaseUser.id)
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        user: userProfile,
        supabaseUser,
        isAuthenticated: true,
        organizationId: userProfile.organization_id,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Profile load error',
        isLoading: false,
      }));
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      if (data.user) {
        await loadUserProfile(data.user);
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Sign in failed',
        isLoading: false,
      }));
      throw error;
    }
  }, [loadUserProfile]);

  const signOut = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      setState({
        user: null,
        supabaseUser: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        organizationId: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Sign out failed',
        isLoading: false,
      }));
    }
  }, []);

  const refreshSession = useCallback(async () => {
    await getSession();
  }, [getSession]);

  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    try {
      if (!state.user) throw new Error('No user logged in');
      
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Update in our custom users table (with organization context)
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update(data)
        .eq('auth_user_id', state.supabaseUser?.id)
        .eq('organization_id', state.organizationId) // Multi-tenant safety
        .select()
        .single();

      if (error) throw error;
      
      setState(prev => ({
        ...prev,
        user: updatedUser,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Profile update failed',
        isLoading: false,
      }));
      throw error;
    }
  }, [state.user, state.supabaseUser, state.organizationId]);

  return {
    ...state,
    signIn,
    signOut,
    refreshSession,
    updateProfile,
  };
}