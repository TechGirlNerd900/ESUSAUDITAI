import { createClient } from '@supabase/supabase-js';
import { applicationInsights } from '../shared/logging.js';
import logger from '../shared/logger.js';
import { getAuthTokensFromCookies, clearAuthTokens, updateRefreshedTokens } from '../utils/cookieHelpers.js';

export const protectRoute = async (req, res, next) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Use anon key for user-facing auth checks

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false, // Ensure server client does not persist sessions
        },
    });

    // Extract tokens from HTTP-only cookies using helper
    const { access_token: accessToken, refresh_token: refreshToken, hasTokens } = getAuthTokensFromCookies(req);

    if (!hasTokens) {
        // Return 401 and let the client handle redirection
        return res.status(401).json({ error: 'Unauthorized', message: 'No session tokens found.' });
    }

    try {
        // Manually set the session for the server-side Supabase client
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        });

        if (sessionError || !sessionData?.session) {
            // If session is invalid or expired, clear cookies and return 401
            clearAuthTokens(res);
            logger.error('Session error in protectRoute middleware', { 
                error: sessionError?.message,
                userId: req.user?.id,
                path: req.path,
                ip: req.ip
            });
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session.' });
        }

        // Refresh the session if needed and update cookies
        if (sessionData.session.access_token !== accessToken) {
            updateRefreshedTokens(res, { access_token: accessToken }, sessionData.session);
        }

        // Attach user and Supabase client to the request object for downstream use
        const { data: { user } } = await supabase.auth.getUser(); // Get the user from the current session
        if (!user) {
            clearAuthTokens(res);
            return res.status(401).json({ error: 'Unauthorized', message: 'User not found in session.' });
        }

        // Get additional user data from our users table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', user.id)
            .single();

        if (userError) {
            applicationInsights.trackEvent({
                name: 'UserDataFetchFailure',
                properties: {
                    error: userError.message,
                    userId: user.id,
                    path: req.path,
                },
            });
            return res.status(500).json({ error: 'Failed to get user data', code: 'USER_DATA_ERROR' });
        }

        // Check if user account is active
        if (userData.status !== 'active') {
            return res.status(403).json({ error: 'Account is not active', code: 'ACCOUNT_INACTIVE' });
        }

        // Update last activity
        await supabase
            .from('users')
            .update({
                last_login_at: new Date().toISOString(),
                last_activity_at: new Date().toISOString(),
            })
            .eq('id', userData.id);

        req.user = {
            ...userData,
            auth: user,
        };
        req.supabase = supabase; // Use this client for RLS-enabled operations on behalf of the user
        next();

    } catch (error) {
        logger.error('Authentication middleware error in protectRoute', {
            error: error.message,
            stack: error.stack,
            path: req.path,
            ip: req.ip
        });
        clearAuthTokens(res);
        return res.status(500).json({ error: 'Internal Server Error', message: 'Authentication process failed.' });
    }
};

// Legacy middleware for backward compatibility - convert Bearer token auth to cookie auth
export const authMiddleware = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'No valid authorization header found',
                code: 'MISSING_AUTH_HEADER'
            });
        }

        const token = authHeader.substring(7);

        // Basic token validation
        if (!token || token.length < 10) {
            return res.status(401).json({ 
                error: 'Invalid token format',
                code: 'INVALID_TOKEN_FORMAT'
            });
        }

        // Create authenticated supabase client with the user's token
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: false
                },
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            }
        );

        // Verify token by calling getUser() - this validates the JWT
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            applicationInsights.trackEvent({
                name: 'AuthenticationFailure',
                properties: {
                    error: error?.message || 'Invalid token',
                    path: req.path,
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });
            return res.status(401).json({ 
                error: 'Invalid or expired authentication token',
                code: 'INVALID_TOKEN'
            });
        }

        // Check if user is confirmed/active
        if (!user.email_confirmed_at) {
            return res.status(401).json({ 
                error: 'Email not confirmed',
                code: 'EMAIL_NOT_CONFIRMED'
            });
        }

        // Get additional user data from our users table using the authenticated client
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', user.id)
            .single();

        if (userError) {
            applicationInsights.trackEvent({
                name: 'UserDataFetchFailure',
                properties: {
                    error: userError.message,
                    userId: user.id,
                    path: req.path
                }
            });
            return res.status(500).json({ 
                error: 'Failed to get user data',
                code: 'USER_DATA_ERROR'
            });
        }

        // Check if user account is active (optional field)
        if (userData.status && userData.status !== 'active') {
            return res.status(403).json({ 
                error: 'Account is not active',
                code: 'ACCOUNT_INACTIVE'
            });
        }

        // Check is_active field if it exists
        if (userData.is_active !== undefined && !userData.is_active) {
            return res.status(403).json({ 
                error: 'Account is not active',
                code: 'ACCOUNT_INACTIVE'
            });
        }

        // Update last activity (only update fields that exist)
        const updateData = {
            last_login_at: new Date().toISOString()
        };
        
        // Only add last_activity_at if the column exists
        if (userData.last_activity_at !== undefined) {
            updateData.last_activity_at = new Date().toISOString();
        }
        
        await supabase
            .from('users')
            .update(updateData)
            .eq('id', userData.id);

        // Attach user data to request object
        req.user = {
            ...userData,
            auth: user
        };

        // Track successful authentication
        applicationInsights.trackEvent({
            name: 'AuthenticationSuccess',
            properties: {
                userId: user.id,
                path: req.path,
                ip: req.ip
            }
        });

        next();
    } catch (error) {
        applicationInsights.trackException({ 
            exception: error,
            properties: {
                operation: 'authMiddleware',
                path: req.path,
                ip: req.ip
            }
        });
        res.status(500).json({ 
            error: 'Internal server error during authentication',
            code: 'AUTH_INTERNAL_ERROR'
        });
    }
};

// Optional middleware to check specific roles
export const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!Array.isArray(allowedRoles)) {
            allowedRoles = [allowedRoles];
        }

        if (!allowedRoles.includes(req.user.role)) {
            applicationInsights.trackEvent({
                name: 'UnauthorizedAccess',
                properties: {
                    userId: req.user.id,
                    requiredRoles: allowedRoles,
                    userRole: req.user.role,
                    path: req.path
                }
            });
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

// Project access middleware
export const requireProjectAccess = async (req, res, next) => {
    try {
        const projectId = req.params.projectId || req.body.projectId;
        
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        const { data: project, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (error || !project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user has access to the project
        const hasAccess = 
            project.created_by === req.user.id || 
            project.assigned_to.includes(req.user.id) ||
            req.user.role === 'admin';

        if (!hasAccess) {
            applicationInsights.trackEvent({
                name: 'UnauthorizedProjectAccess',
                properties: {
                    userId: req.user.id,
                    projectId,
                    path: req.path
                }
            });
            return res.status(403).json({ error: 'Access denied to this project' });
        }

        // Attach project to request object
        req.project = project;
        next();
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error checking project access' });
    }
};

