import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../services/supabaseClient';
import { authService } from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    let navigate;
    try {
        navigate = useNavigate();
    } catch (err) {
        console.error('Navigate hook failed:', err);
        navigate = () => console.error('Navigation not available');
    }


    useEffect(() => {
        // Initialize from existing supabase session
        supabase.auth.getSession().then(({ data: { session: currentSession }, error: sessError }) => {
            if (sessError) {
                console.error('Error fetching session:', sessError.message);
                setError(sessError);
            } else if (currentSession) {
                setSession(currentSession);
                setUser(currentSession.user);
            }
            setLoading(false);
        }).catch((err) => {
            console.error('Failed to initialize auth:', err);
            setError(err);
            setLoading(false);
        });

        // Listen for auth changes in supabase client
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            setSession(newSession);
            setUser(newSession?.user ?? null);
            switch (event) {
                case 'SIGNED_OUT':
                    navigate('/login');
                    break;
                case 'USER_DELETED':
                    navigate('/login');
                    break;
                default:
                    break;
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    // Sign in via backend
    const signIn = async (email, password) => {
        try {
            setError(null);
            const { user: loggedUser, session: loggedSession } = await authService.login({ email, password });
            // Set session in supabase client for realtime/subscriptions
            await supabase.auth.setSession({
                access_token: loggedSession.access_token,
                refresh_token: loggedSession.refresh_token
            });
            setSession(loggedSession);
            setUser(loggedUser);
            navigate('/dashboard');
            return { user: loggedUser, session: loggedSession };
        } catch (err) {
            setError(err.error || err.message);
            throw err;
        }
    };

    // Sign up via backend
    const signUp = async (email, password, metadata) => {
        try {
            setError(null);
            if (!authService || !authService.register) {
                throw new Error('Auth service not available');
            }
            await authService.register({ email, password, ...metadata });
            // After successful registration, redirect to login
            if (navigate) {
                navigate('/login');
            }
        } catch (err) {
            setError(err.error || err.message);
            throw err;
        }
    };

    // Sign out via backend
    const signOut = async () => {
        try {
            setError(null);
            await authService.logout();
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
        } catch (err) {
            setError(err.error || err.message);
            throw err;
        }
    };

    const resetPassword = async (email) => {
        try {
            setError(null);
            const { message } = await authService.requestPasswordReset({ email });
            return message;
        } catch (err) {
            setError(err.error || err.message);
            throw err;
        }
    };

    const updatePassword = async (newPassword) => {
        try {
            setError(null);
            const result = await authService.changePassword({ newPassword });
            return result;
        } catch (err) {
            setError(err.error || err.message);
            throw err;
        }
    };

    const updateProfile = async (updates) => {
        try {
            setError(null);
            const updatedUser = await authService.updateProfile(updates);
            setUser(updatedUser);
            return updatedUser;
        } catch (err) {
            setError(err.error || err.message);
            throw err;
        }
    };

    const value = {
        user,
        session,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        updateProfile,
        isAuthenticated: !!user
    };


    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
