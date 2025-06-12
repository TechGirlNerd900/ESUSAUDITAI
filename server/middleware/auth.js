import { supabase } from '../shared/supabaseClient.js';
import { applicationInsights } from '../shared/logging.js';

export const authMiddleware = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No valid authorization header found' });
        }

        const token = authHeader.substring(7);

        // Verify token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            applicationInsights.trackEvent({
                name: 'AuthenticationFailure',
                properties: {
                    error: error?.message || 'Invalid token',
                    path: req.path
                }
            });
            return res.status(401).json({ error: 'Invalid authentication token' });
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
                    userId: user.id
                }
            });
            return res.status(500).json({ error: 'Failed to get user data' });
        }

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
                path: req.path
            }
        });

        next();
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error during authentication' });
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

