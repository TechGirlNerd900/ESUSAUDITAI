import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../shared/supabaseClient.js';
import { applicationInsights } from '../shared/logging.js';
import { authMiddleware, protectRoute } from '../middleware/auth.js';
import logger from '../shared/logger.js';
import { 
    validateRegister, 
    validateLogin, 
    validatePasswordReset, 
    validatePasswordChange 
} from '../middleware/validation.js';

const router = express.Router();

// Register new user
router.post('/register', validateRegister, async (req, res) => {
    try {
        const { email, password, firstName, lastName, company } = req.body;

        // First, create the auth user in Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    first_name: firstName,
                    last_name: lastName
                }
            }
        });

        if (authError) {
            applicationInsights.trackEvent({
                name: 'RegistrationFailure',
                properties: {
                    error: authError.message,
                    email
                }
            });
            return res.status(400).json({ error: authError.message });
        }

        // The user profile will be created automatically via database trigger
        applicationInsights.trackEvent({
            name: 'UserRegistered',
            properties: {
                userId: authData.user.id,
                email
            }
        });

        res.status(201).json({
            message: 'Registration successful',
            user: authData.user
        });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error during registration' });
    }
});

// Login
router.post('/login', validateLogin, async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            applicationInsights.trackEvent({
                name: 'LoginFailure',
                properties: {
                    error: authError.message,
                    email
                }
            });
            return res.status(401).json({ error: authError.message });
        }

        // Get additional user data
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', authData.user.id)
            .single();

        if (userError) {
            applicationInsights.trackEvent({
                name: 'UserDataFetchFailure',
                properties: {
                    error: userError.message,
                    userId: authData.user.id
                }
            });
            return res.status(500).json({ error: 'Failed to get user data' });
        }

        applicationInsights.trackEvent({
            name: 'UserLoggedIn',
            properties: {
                userId: authData.user.id,
                email
            }
        });

        // Set HTTP-only cookies for access and refresh tokens
        res.cookie('sb-access-token', authData.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: authData.session.expires_in * 1000,
            path: '/',
        });
        res.cookie('sb-refresh-token', authData.session.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/',
        });

        res.json({
            user: {
                ...userData,
                auth: authData.user
            },
            session: authData.session
        });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

// Logout
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        // Clear cookies first
        res.clearCookie('sb-access-token', { path: '/' });
        res.clearCookie('sb-refresh-token', { path: '/' });

        const { error } = await supabase.auth.signOut();

        if (error) {
            applicationInsights.trackEvent({
                name: 'LogoutFailure',
                properties: {
                    error: error.message,
                    userId: req.user.id
                }
            });
            return res.status(500).json({ error: error.message });
        }

        applicationInsights.trackEvent({
            name: 'UserLoggedOut',
            properties: {
                userId: req.user.id
            }
        });

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error during logout' });
    }
});

// Get current user / verify token
router.get('/me', authMiddleware, async (req, res) => {
    try {
        // User data is already attached by authMiddleware
        res.json({ user: req.user });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error fetching user data' });
    }
});

// Verify token endpoint (alias for /me)
router.get('/verify', authMiddleware, async (req, res) => {
    try {
        res.json({ 
            user: req.user,
            valid: true
        });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error verifying token' });
    }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { firstName, lastName, company } = req.body;

        // Update auth user metadata
        const { error: authError } = await supabase.auth.updateUser({
            data: {
                first_name: firstName,
                last_name: lastName
            }
        });

        if (authError) {
            applicationInsights.trackEvent({
                name: 'ProfileUpdateFailure',
                properties: {
                    error: authError.message,
                    userId: req.user.id
                }
            });
            return res.status(400).json({ error: authError.message });
        }

        // Update user profile in our database
        const { data: userData, error: userError } = await supabase
            .from('users')
            .update({
                first_name: firstName,
                last_name: lastName,
                company,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.user.id)
            .select()
            .single();

        if (userError) {
            applicationInsights.trackEvent({
                name: 'ProfileUpdateFailure',
                properties: {
                    error: userError.message,
                    userId: req.user.id
                }
            });
            return res.status(500).json({ error: 'Failed to update user profile' });
        }

        applicationInsights.trackEvent({
            name: 'ProfileUpdated',
            properties: {
                userId: req.user.id
            }
        });

        res.json({ user: userData });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error updating profile' });
    }
});

// Request password reset
router.post('/reset-password', validatePasswordReset, async (req, res) => {
    try {
        const { email } = req.body;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: process.env.PASSWORD_RESET_URL
        });

        if (error) {
            applicationInsights.trackEvent({
                name: 'PasswordResetRequestFailure',
                properties: {
                    error: error.message,
                    email
                }
            });
            return res.status(400).json({ error: error.message });
        }

        applicationInsights.trackEvent({
            name: 'PasswordResetRequested',
            properties: { email }
        });

        res.json({ message: 'Password reset instructions sent' });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error requesting password reset' });
    }
});

// Change password (requires authentication)
router.post('/change-password', authMiddleware, validatePasswordChange, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Verify current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: req.user.auth.email,
            password: currentPassword
        });

        if (signInError) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Update password
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            applicationInsights.trackEvent({
                name: 'PasswordChangeFailure',
                properties: {
                    error: error.message,
                    userId: req.user.id
                }
            });
            return res.status(400).json({ error: error.message });
        }

        applicationInsights.trackEvent({
            name: 'PasswordChanged',
            properties: {
                userId: req.user.id
            }
        });

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error changing password' });
    }
});

// Route to handle Supabase OAuth callbacks
router.get('/auth/callback', async (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false, // Essential for server-side code exchange
        },
    });

    const code = req.query.code; // The auth code from Supabase

    if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error('Error exchanging code for session:', error.message);
            return res.status(400).json({ error: 'Authentication failed', code: 'AUTH_FAILED', message: error.message });
        }

        if (data?.session) {
            // Set HTTP-only cookies for access and refresh tokens
            // These will be sent by the browser on subsequent requests to your Express API
            res.cookie('sb-access-token', data.session.access_token, {
                httpOnly: true, // IMPORTANT: Prevent client-side JavaScript access
                secure: process.env.NODE_ENV === 'production', // Use secure in production for HTTPS
                sameSite: 'Lax', // Protect against CSRF
                maxAge: data.session.expires_in * 1000, // Supabase access token expiry (in ms)
                path: '/',
            });
            res.cookie('sb-refresh-token', data.session.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Lax',
                maxAge: 7 * 24 * 60 * 60 * 1000, // Refresh token typically lasts longer (e.g., 7 days)
                path: '/',
            });

            // Return success response for client to handle navigation
            return res.status(200).json({ message: 'Authentication successful', user: data.user });
        }
    }

    // Handle cases where no code is present
    return res.status(400).json({ error: 'No authorization code provided', code: 'NO_CODE' });
});

// Logout route with cookie clearing
router.post('/auth/logout', async (req, res) => {
    // Clear the cookies on the client side
    res.clearCookie('sb-access-token', { path: '/' });
    res.clearCookie('sb-refresh-token', { path: '/' });

    // Optionally, if the server-side Supabase client was initialized with a session,
    // you could also call `await supabase.auth.signOut()` here for server-side session invalidation.
    // For simplicity, clearing cookies is often sufficient as the server will then fail auth checks.
    res.status(200).json({ message: 'Logged out successfully.' });
});

export default router;