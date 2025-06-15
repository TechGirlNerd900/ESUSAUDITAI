import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import logger from '../shared/logger.js';
import { applicationInsights } from '../shared/logging.js';
import { supabase } from '../shared/supabaseClient.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Admin-only middleware
const adminOnly = requireRole(['admin', 'super_admin']);

// User management validation
const validateUserUpdate = [
    body('role')
        .isIn(['admin', 'auditor', 'reviewer'])
        .withMessage('Invalid role'),
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    body('company')
        .optional()
        .isLength({ max: 255 })
        .withMessage('Company name must not exceed 255 characters')
];

// Validation for environment variables
const validateEnvVar = [
    body('key')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Key must be 1-100 characters')
        .matches(/^[A-Z][A-Z0-9_]*$/)
        .withMessage('Key must be uppercase with underscores only'),
    body('value')
        .isLength({ max: 2000 })
        .withMessage('Value must not exceed 2000 characters'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    body('category')
        .optional()
        .isIn(['database', 'azure', 'auth', 'security', 'monitoring', 'custom'])
        .withMessage('Invalid category'),
    body('sensitive')
        .optional()
        .isBoolean()
        .withMessage('Sensitive must be a boolean')
];

// Validation for API integrations
const validateApiIntegration = [
    body('name')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Name must be 1-100 characters'),
    body('type')
        .isIn(['azure_openai', 'azure_form_recognizer', 'azure_search', 'custom'])
        .withMessage('Invalid integration type'),
    body('endpoint')
        .isURL()
        .withMessage('Endpoint must be a valid URL'),
    body('apiKey')
        .isLength({ min: 1, max: 500 })
        .withMessage('API key is required'),
    body('config')
        .optional()
        .isJSON()
        .withMessage('Config must be valid JSON')
];

// Get all environment variables (admin only)
router.get('/env', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { data: envVars, error } = await supabase
            .from('app_settings')
            .select('*')
            .eq('type', 'environment')
            .order('category', { ascending: true });

        if (error) {
            logger.error('Failed to fetch environment variables', { error, userId: req.user.id });
            return res.status(500).json({ 
                error: 'Failed to fetch environment variables',
                code: 'ENV_FETCH_ERROR'
            });
        }

        // Mask sensitive values
        const maskedEnvVars = envVars.map(env => ({
            ...env,
            value: env.sensitive ? '********' : env.value,
            actualLength: env.value ? env.value.length : 0
        }));

        logger.business('Environment variables accessed', {
            userId: req.user.id,
            count: envVars.length
        });

        res.json({
            envVars: maskedEnvVars,
            count: envVars.length
        });
    } catch (error) {
        logger.error('Environment variables fetch failed', { error, userId: req.user.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'ENV_INTERNAL_ERROR'
        });
    }
});

// Get specific environment variable
router.get('/env/:key', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { key } = req.params;
        
        const { data: envVar, error } = await supabase
            .from('app_settings')
            .select('*')
            .eq('type', 'environment')
            .eq('key', key)
            .single();

        if (error || !envVar) {
            return res.status(404).json({ 
                error: 'Environment variable not found',
                code: 'ENV_NOT_FOUND'
            });
        }

        // Don't return sensitive values in full
        const response = {
            ...envVar,
            value: envVar.sensitive ? '********' : envVar.value,
            actualLength: envVar.value ? envVar.value.length : 0
        };

        logger.business('Environment variable accessed', {
            userId: req.user.id,
            key: key,
            sensitive: envVar.sensitive
        });

        res.json(response);
    } catch (error) {
        logger.error('Environment variable fetch failed', { error, userId: req.user.id, key: req.params.key });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'ENV_INTERNAL_ERROR'
        });
    }
});

// Add or update environment variable
router.put('/env/:key', authMiddleware, adminOnly, validateEnvVar, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { key } = req.params;
        const { value, description, category = 'custom', sensitive = false } = req.body;

        // Check if variable exists
        const { data: existing } = await supabase
            .from('app_settings')
            .select('id, key')
            .eq('type', 'environment')
            .eq('key', key)
            .single();

        const settingData = {
            key,
            value,
            description,
            category,
            sensitive,
            type: 'environment',
            updated_by: req.user.id,
            updated_at: new Date().toISOString()
        };

        let result;
        if (existing) {
            // Update existing
            const { data, error } = await supabase
                .from('app_settings')
                .update(settingData)
                .eq('id', existing.id)
                .select()
                .single();
            result = { data, error };
        } else {
            // Create new
            settingData.created_by = req.user.id;
            settingData.created_at = new Date().toISOString();
            
            const { data, error } = await supabase
                .from('app_settings')
                .insert([settingData])
                .select()
                .single();
            result = { data, error };
        }

        if (result.error) {
            logger.error('Failed to save environment variable', { 
                error: result.error, 
                userId: req.user.id, 
                key 
            });
            return res.status(500).json({ 
                error: 'Failed to save environment variable',
                code: 'ENV_SAVE_ERROR'
            });
        }

        // Set the environment variable in current process (requires restart for persistence)
        process.env[key] = value;

        logger.security('Environment variable modified', {
            userId: req.user.id,
            key: key,
            action: existing ? 'updated' : 'created',
            sensitive,
            category
        });

        const response = {
            ...result.data,
            value: sensitive ? '********' : value,
            message: existing ? 'Environment variable updated' : 'Environment variable created',
            restartRequired: true
        };

        res.json(response);
    } catch (error) {
        logger.error('Environment variable save failed', { error, userId: req.user.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'ENV_INTERNAL_ERROR'
        });
    }
});

// Delete environment variable
router.delete('/env/:key', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { key } = req.params;

        // Prevent deletion of critical variables
        const criticalVars = [
            'SUPABASE_URL', 
            'SUPABASE_SERVICE_ROLE_KEY', 
            'JWT_SECRET',
            'DATABASE_URL',
            'NODE_ENV'
        ];

        if (criticalVars.includes(key)) {
            return res.status(403).json({
                error: 'Cannot delete critical environment variable',
                code: 'ENV_CRITICAL_DELETE'
            });
        }

        const { error } = await supabase
            .from('app_settings')
            .delete()
            .eq('type', 'environment')
            .eq('key', key);

        if (error) {
            logger.error('Failed to delete environment variable', { error, userId: req.user.id, key });
            return res.status(500).json({ 
                error: 'Failed to delete environment variable',
                code: 'ENV_DELETE_ERROR'
            });
        }

        // Remove from current process
        delete process.env[key];

        logger.security('Environment variable deleted', {
            userId: req.user.id,
            key: key
        });

        res.json({ 
            message: 'Environment variable deleted',
            key,
            restartRequired: true
        });
    } catch (error) {
        logger.error('Environment variable delete failed', { error, userId: req.user.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'ENV_INTERNAL_ERROR'
        });
    }
});

// Get all API integrations
router.get('/integrations', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { data: integrations, error } = await supabase
            .from('api_integrations')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            logger.error('Failed to fetch API integrations', { error, userId: req.user.id });
            return res.status(500).json({ 
                error: 'Failed to fetch API integrations',
                code: 'INTEGRATION_FETCH_ERROR'
            });
        }

        // Mask API keys
        const maskedIntegrations = integrations.map(integration => ({
            ...integration,
            apiKey: '********',
            keyLength: integration.apiKey ? integration.apiKey.length : 0
        }));

        res.json({
            integrations: maskedIntegrations,
            count: integrations.length
        });
    } catch (error) {
        logger.error('API integrations fetch failed', { error, userId: req.user.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'INTEGRATION_INTERNAL_ERROR'
        });
    }
});

// Add or update API integration
router.put('/integrations/:id', authMiddleware, adminOnly, validateApiIntegration, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { id } = req.params;
        const { name, type, endpoint, apiKey, config = {}, enabled = true } = req.body;

        // Validate endpoint accessibility
        try {
            const testResponse = await fetch(endpoint, { 
                method: 'HEAD',
                timeout: 5000
            });
            if (!testResponse.ok && testResponse.status !== 405) { // 405 Method Not Allowed is OK
                logger.warn('API integration endpoint may be unreachable', {
                    endpoint,
                    status: testResponse.status,
                    userId: req.user.id
                });
            }
        } catch (fetchError) {
            logger.warn('API integration endpoint test failed', {
                endpoint,
                error: fetchError.message,
                userId: req.user.id
            });
        }

        const integrationData = {
            name,
            type,
            endpoint,
            apiKey,
            config: typeof config === 'string' ? JSON.parse(config) : config,
            enabled,
            updated_by: req.user.id,
            updated_at: new Date().toISOString()
        };

        // Check if integration exists
        const { data: existing } = await supabase
            .from('api_integrations')
            .select('id, name')
            .eq('id', id)
            .single();

        let result;
        if (existing) {
            const { data, error } = await supabase
                .from('api_integrations')
                .update(integrationData)
                .eq('id', id)
                .select()
                .single();
            result = { data, error };
        } else {
            integrationData.id = id;
            integrationData.created_by = req.user.id;
            integrationData.created_at = new Date().toISOString();
            
            const { data, error } = await supabase
                .from('api_integrations')
                .insert([integrationData])
                .select()
                .single();
            result = { data, error };
        }

        if (result.error) {
            logger.error('Failed to save API integration', { 
                error: result.error, 
                userId: req.user.id, 
                integrationId: id 
            });
            return res.status(500).json({ 
                error: 'Failed to save API integration',
                code: 'INTEGRATION_SAVE_ERROR'
            });
        }

        logger.security('API integration modified', {
            userId: req.user.id,
            integrationId: id,
            name,
            type,
            action: existing ? 'updated' : 'created'
        });

        const response = {
            ...result.data,
            apiKey: '********',
            message: existing ? 'API integration updated' : 'API integration created'
        };

        res.json(response);
    } catch (error) {
        logger.error('API integration save failed', { error, userId: req.user.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'INTEGRATION_INTERNAL_ERROR'
        });
    }
});

// Test API integration
router.post('/integrations/:id/test', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: integration, error } = await supabase
            .from('api_integrations')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !integration) {
            return res.status(404).json({ 
                error: 'API integration not found',
                code: 'INTEGRATION_NOT_FOUND'
            });
        }

        // Test the integration based on type
        let testResult = { success: false, message: 'Unknown integration type' };

        try {
            switch (integration.type) {
                case 'azure_openai':
                    // Test Azure OpenAI
                    const openaiResponse = await fetch(`${integration.endpoint}/openai/deployments`, {
                        method: 'GET',
                        headers: {
                            'api-key': integration.apiKey,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    });
                    testResult = {
                        success: openaiResponse.ok,
                        message: openaiResponse.ok ? 'Azure OpenAI connection successful' : `HTTP ${openaiResponse.status}`,
                        responseTime: Date.now()
                    };
                    break;

                case 'azure_form_recognizer':
                    // Test Azure Form Recognizer
                    const formResponse = await fetch(`${integration.endpoint}/formrecognizer/documentModels`, {
                        method: 'GET',
                        headers: {
                            'Ocp-Apim-Subscription-Key': integration.apiKey
                        },
                        timeout: 10000
                    });
                    testResult = {
                        success: formResponse.ok,
                        message: formResponse.ok ? 'Azure Form Recognizer connection successful' : `HTTP ${formResponse.status}`,
                        responseTime: Date.now()
                    };
                    break;

                case 'azure_search':
                    // Test Azure Search
                    const searchResponse = await fetch(`${integration.endpoint}/indexes`, {
                        method: 'GET',
                        headers: {
                            'api-key': integration.apiKey,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    });
                    testResult = {
                        success: searchResponse.ok,
                        message: searchResponse.ok ? 'Azure Search connection successful' : `HTTP ${searchResponse.status}`,
                        responseTime: Date.now()
                    };
                    break;

                default:
                    // Generic HTTP test
                    const genericResponse = await fetch(integration.endpoint, {
                        method: 'HEAD',
                        timeout: 10000
                    });
                    testResult = {
                        success: genericResponse.ok || genericResponse.status === 405,
                        message: genericResponse.ok ? 'Endpoint accessible' : `HTTP ${genericResponse.status}`,
                        responseTime: Date.now()
                    };
            }
        } catch (fetchError) {
            testResult = {
                success: false,
                message: `Connection failed: ${fetchError.message}`,
                error: fetchError.message
            };
        }

        logger.business('API integration tested', {
            userId: req.user.id,
            integrationId: id,
            type: integration.type,
            success: testResult.success
        });

        res.json({
            integration: {
                id: integration.id,
                name: integration.name,
                type: integration.type,
                endpoint: integration.endpoint
            },
            test: testResult
        });

    } catch (error) {
        logger.error('API integration test failed', { error, userId: req.user.id, integrationId: req.params.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'INTEGRATION_TEST_ERROR'
        });
    }
});

// Delete API integration
router.delete('/integrations/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('api_integrations')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error('Failed to delete API integration', { error, userId: req.user.id, integrationId: id });
            return res.status(500).json({ 
                error: 'Failed to delete API integration',
                code: 'INTEGRATION_DELETE_ERROR'
            });
        }

        logger.security('API integration deleted', {
            userId: req.user.id,
            integrationId: id
        });

        res.json({ 
            message: 'API integration deleted',
            id
        });
    } catch (error) {
        logger.error('API integration delete failed', { error, userId: req.user.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'INTEGRATION_INTERNAL_ERROR'
        });
    }
});

// Reload environment variables (requires restart)
router.post('/reload-env', authMiddleware, adminOnly, async (req, res) => {
    try {
        logger.security('Environment reload requested', {
            userId: req.user.id,
            timestamp: new Date().toISOString()
        });

        res.json({
            message: 'Environment reload requested. Server restart required for changes to take effect.',
            timestamp: new Date().toISOString(),
            restartRequired: true
        });
    } catch (error) {
        logger.error('Environment reload failed', { error, userId: req.user.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'ENV_RELOAD_ERROR'
        });
    }
});

// ===== USER MANAGEMENT ENDPOINTS =====

// Get all users with pagination and filtering
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            role, 
            status, 
            company, 
            search 
        } = req.query;

        let query = supabase
            .from('users')
            .select(`
                id,
                email,
                first_name,
                last_name,
                role,
                company,
                is_active,
                last_login_at,
                created_at,
                updated_at,
                failed_login_attempts,
                locked_until
            `, { count: 'exact' });

        // Apply filters
        if (role) {
            query = query.eq('role', role);
        }
        if (status === 'active') {
            query = query.eq('is_active', true);
        } else if (status === 'inactive') {
            query = query.eq('is_active', false);
        }
        if (company) {
            query = query.ilike('company', `%${company}%`);
        }
        if (search) {
            query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
        }

        // Apply pagination
        const offset = (page - 1) * limit;
        query = query
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });

        const { data: users, error, count } = await query;

        if (error) {
            logger.error('Failed to fetch users', { error, userId: req.user.id });
            return res.status(500).json({ 
                error: 'Failed to fetch users',
                code: 'USER_FETCH_ERROR'
            });
        }

        // Calculate pagination info
        const totalPages = Math.ceil(count / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.json({
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages,
                hasNext,
                hasPrev
            },
            filters: { role, status, company, search }
        });

        // Track admin action
        applicationInsights.trackEvent({
            name: 'AdminUserListAccessed',
            properties: {
                adminId: req.user.id,
                filters: { role, status, company, search },
                userCount: users.length
            }
        });

    } catch (error) {
        logger.error('User list fetch failed', { error, userId: req.user.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'USER_LIST_INTERNAL_ERROR'
        });
    }
});

// Get user details by ID
router.get('/users/:userId', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { userId } = req.params;

        const { data: user, error } = await supabase
            .from('users')
            .select(`
                *,
                projects!projects_created_by_fkey(id, name, status, created_at),
                documents!documents_uploaded_by_fkey(id, original_name, created_at)
            `)
            .eq('id', userId)
            .single();

        if (error) {
            logger.error('Failed to fetch user details', { error, userId: req.user.id, targetUserId: userId });
            return res.status(404).json({ 
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Get user statistics
        const stats = {
            projectsCreated: user.projects ? user.projects.length : 0,
            documentsUploaded: user.documents ? user.documents.length : 0,
            lastActive: user.last_login_at
        };

        res.json({
            user: {
                ...user,
                projects: user.projects ? user.projects.slice(0, 5) : [], // Latest 5 projects
                documents: user.documents ? user.documents.slice(0, 5) : [] // Latest 5 documents
            },
            stats
        });

        // Track admin action
        applicationInsights.trackEvent({
            name: 'AdminUserDetailsAccessed',
            properties: {
                adminId: req.user.id,
                targetUserId: userId
            }
        });

    } catch (error) {
        logger.error('User details fetch failed', { error, userId: req.user.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'USER_DETAILS_INTERNAL_ERROR'
        });
    }
});

// Update user role and status
router.put('/users/:userId', authMiddleware, adminOnly, validateUserUpdate, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { userId } = req.params;
        const { role, isActive, company } = req.body;

        // Prevent admin from demoting themselves
        if (userId === req.user.id && role !== 'admin') {
            return res.status(400).json({
                error: 'Cannot change your own admin role',
                code: 'SELF_ROLE_CHANGE_DENIED'
            });
        }

        // Prevent admin from deactivating themselves
        if (userId === req.user.id && isActive === false) {
            return res.status(400).json({
                error: 'Cannot deactivate your own account',
                code: 'SELF_DEACTIVATION_DENIED'
            });
        }

        const updateData = {};
        if (role !== undefined) updateData.role = role;
        if (isActive !== undefined) updateData.is_active = isActive;
        if (company !== undefined) updateData.company = company;
        updateData.updated_at = new Date().toISOString();

        const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            logger.error('Failed to update user', { error, userId: req.user.id, targetUserId: userId });
            return res.status(500).json({ 
                error: 'Failed to update user',
                code: 'USER_UPDATE_ERROR'
            });
        }

        // Log the role change in audit logs
        await supabase
            .from('audit_logs')
            .insert({
                user_id: req.user.id,
                action: 'user_role_updated',
                resource_type: 'user',
                resource_id: userId,
                details: {
                    oldRole: req.body.oldRole,
                    newRole: role,
                    isActive,
                    company,
                    adminId: req.user.id
                },
                success: true
            });

        res.json({
            message: 'User updated successfully',
            user: updatedUser
        });

        // Track admin action
        applicationInsights.trackEvent({
            name: 'AdminUserUpdated',
            properties: {
                adminId: req.user.id,
                targetUserId: userId,
                roleChanged: role !== undefined,
                newRole: role,
                statusChanged: isActive !== undefined,
                newStatus: isActive
            }
        });

    } catch (error) {
        logger.error('User update failed', { error, userId: req.user.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'USER_UPDATE_INTERNAL_ERROR'
        });
    }
});

// Reset user password (admin action)
router.post('/users/:userId/reset-password', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { userId } = req.params;

        // Get user email
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('email, first_name, last_name')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Send password reset email via Supabase Auth
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
            redirectTo: `${process.env.CLIENT_URL}/reset-password`
        });

        if (resetError) {
            logger.error('Password reset failed', { error: resetError, userId: req.user.id, targetUserId: userId });
            return res.status(500).json({
                error: 'Failed to send password reset email',
                code: 'PASSWORD_RESET_ERROR'
            });
        }

        // Log the admin action
        await supabase
            .from('audit_logs')
            .insert({
                user_id: req.user.id,
                action: 'password_reset_initiated',
                resource_type: 'user',
                resource_id: userId,
                details: {
                    targetEmail: user.email,
                    adminId: req.user.id
                },
                success: true
            });

        res.json({
            message: `Password reset email sent to ${user.email}`,
            user: {
                id: userId,
                email: user.email,
                name: `${user.first_name} ${user.last_name}`
            }
        });

        // Track admin action
        applicationInsights.trackEvent({
            name: 'AdminPasswordResetInitiated',
            properties: {
                adminId: req.user.id,
                targetUserId: userId,
                targetEmail: user.email
            }
        });

    } catch (error) {
        logger.error('Password reset initiation failed', { error, userId: req.user.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'PASSWORD_RESET_INTERNAL_ERROR'
        });
    }
});

// Get user activity summary
router.get('/users/:userId/activity', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { userId } = req.params;
        const { days = 30 } = req.query;

        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - parseInt(days));

        // Get recent audit logs for the user
        const { data: activities, error } = await supabase
            .from('audit_logs')
            .select('action, resource_type, created_at, success, details')
            .eq('user_id', userId)
            .gte('created_at', dateLimit.toISOString())
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            logger.error('Failed to fetch user activity', { error, userId: req.user.id, targetUserId: userId });
            return res.status(500).json({ 
                error: 'Failed to fetch user activity',
                code: 'ACTIVITY_FETCH_ERROR'
            });
        }

        // Get activity statistics
        const stats = {
            totalActivities: activities.length,
            successfulActions: activities.filter(a => a.success).length,
            failedActions: activities.filter(a => !a.success).length,
            actionTypes: activities.reduce((acc, activity) => {
                acc[activity.action] = (acc[activity.action] || 0) + 1;
                return acc;
            }, {}),
            resourceTypes: activities.reduce((acc, activity) => {
                acc[activity.resource_type] = (acc[activity.resource_type] || 0) + 1;
                return acc;
            }, {})
        };

        res.json({
            activities,
            stats,
            period: `${days} days`
        });

    } catch (error) {
        logger.error('User activity fetch failed', { error, userId: req.user.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'ACTIVITY_INTERNAL_ERROR'
        });
    }
});

// Get user management statistics
router.get('/users/stats/overview', authMiddleware, adminOnly, async (req, res) => {
    try {
        // Get user counts by role
        const { data: roleCounts, error: roleError } = await supabase
            .from('users')
            .select('role')
            .then(result => {
                if (result.error) return result;
                const counts = result.data.reduce((acc, user) => {
                    acc[user.role] = (acc[user.role] || 0) + 1;
                    return acc;
                }, {});
                return { data: counts, error: null };
            });

        if (roleError) {
            throw roleError;
        }

        // Get active vs inactive users
        const { data: statusCounts, error: statusError } = await supabase
            .from('users')
            .select('is_active')
            .then(result => {
                if (result.error) return result;
                const counts = result.data.reduce((acc, user) => {
                    const status = user.is_active ? 'active' : 'inactive';
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {});
                return { data: counts, error: null };
            });

        if (statusError) {
            throw statusError;
        }

        // Get recent registrations (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: recentUsers, error: recentError } = await supabase
            .from('users')
            .select('created_at')
            .gte('created_at', thirtyDaysAgo.toISOString());

        if (recentError) {
            throw recentError;
        }

        res.json({
            usersByRole: roleCounts,
            usersByStatus: statusCounts,
            recentRegistrations: recentUsers.length,
            totalUsers: Object.values(roleCounts).reduce((sum, count) => sum + count, 0)
        });

    } catch (error) {
        logger.error('User stats fetch failed', { error, userId: req.user.id });
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'USER_STATS_INTERNAL_ERROR'
        });
    }
});

export default router;