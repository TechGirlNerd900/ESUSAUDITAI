import express from 'express';
import { supabase } from '../shared/supabaseClient.js';
import { applicationInsights } from '../shared/logging.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
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
router.post('/login', async (req, res) => {
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

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
    try {
        // User data is already attached by authMiddleware
        res.json({ user: req.user });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error fetching user data' });
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
router.post('/reset-password', async (req, res) => {
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
router.post('/change-password', authMiddleware, async (req, res) => {
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

export default router;