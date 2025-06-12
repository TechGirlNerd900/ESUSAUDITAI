import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import logger from '../shared/logger.js';
import { applicationInsights } from '../shared/logging.js';
import { supabase } from '../shared/supabaseClient.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Admin-only middleware
const adminOnly = requireRole(['admin', 'super_admin']);

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

export default router;