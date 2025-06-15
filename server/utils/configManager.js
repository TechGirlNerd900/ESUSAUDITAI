import { supabase } from '../shared/supabaseClient.js';
import logger from '../shared/logger.js';

class ConfigManager {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.integrations = new Map();
    }

    // Load environment variables from database
    async loadEnvironmentVariables() {
        try {
            const { data: envVars, error } = await supabase
                .from('app_settings')
                .select('key, value, sensitive')
                .eq('type', 'environment');

            if (error) {
                logger.error('Failed to load environment variables from database', { error });
                return false;
            }

            // Update process.env with database values
            // But don't override critical environment variables that should come from .env file
            const protectedVars = ['NODE_ENV', 'PORT', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_JWT_SECRET'];
            
            envVars.forEach(envVar => {
                // Only set if not already defined or not in protected list
                if (!protectedVars.includes(envVar.key) || !process.env[envVar.key]) {
                    process.env[envVar.key] = envVar.value;
                }
            });

            logger.info('Environment variables loaded from database', {
                count: envVars.length,
                keys: envVars.map(v => v.key)
            });

            return true;
        } catch (error) {
            logger.error('Error loading environment variables', { error });
            return false;
        }
    }

    // Get configuration value with caching
    async getConfig(key, defaultValue = null) {
        const cacheKey = `config_${key}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.value;
        }

        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', key)
                .eq('type', 'environment')
                .single();

            const value = error ? defaultValue : data.value;

            // Cache the result
            this.cache.set(cacheKey, {
                value,
                timestamp: Date.now()
            });

            return value;
        } catch (error) {
            logger.error('Error getting config value', { error, key });
            return defaultValue;
        }
    }

    // Set configuration value
    async setConfig(key, value, options = {}) {
        try {
            const {
                description = '',
                category = 'custom',
                sensitive = false,
                userId = null
            } = options;

            // Check if exists
            const { data: existing } = await supabase
                .from('app_settings')
                .select('id')
                .eq('key', key)
                .eq('type', 'environment')
                .single();

            const settingData = {
                key,
                value,
                description,
                category,
                sensitive,
                type: 'environment',
                updated_at: new Date().toISOString()
            };

            if (userId) {
                settingData.updated_by = userId;
            }

            let result;
            if (existing) {
                const { error } = await supabase
                    .from('app_settings')
                    .update(settingData)
                    .eq('id', existing.id);
                result = { error };
            } else {
                if (userId) {
                    settingData.created_by = userId;
                }
                settingData.created_at = new Date().toISOString();
                
                const { error } = await supabase
                    .from('app_settings')
                    .insert([settingData]);
                result = { error };
            }

            if (result.error) {
                logger.error('Failed to set config value', { error: result.error, key });
                return false;
            }

            // Update process.env and cache
            process.env[key] = value;
            this.cache.delete(`config_${key}`);

            logger.info('Configuration updated', { key, category, sensitive });
            return true;
        } catch (error) {
            logger.error('Error setting config value', { error, key });
            return false;
        }
    }

    // Load API integrations
    async loadApiIntegrations() {
        try {
            const { data: integrations, error } = await supabase
                .from('api_integrations')
                .select('*')
                .eq('enabled', true);

            if (error) {
                logger.error('Failed to load API integrations', { error });
                return false;
            }

            // Cache integrations
            this.integrations.clear();
            integrations.forEach(integration => {
                this.integrations.set(integration.id, integration);
                this.integrations.set(integration.type, integration); // Also cache by type
            });

            logger.info('API integrations loaded', {
                count: integrations.length,
                types: integrations.map(i => i.type)
            });

            return true;
        } catch (error) {
            logger.error('Error loading API integrations', { error });
            return false;
        }
    }

    // Get API integration
    getIntegration(idOrType) {
        return this.integrations.get(idOrType);
    }

    // Get Azure OpenAI client configuration
    getAzureOpenAIConfig() {
        const integration = this.getIntegration('azure_openai');
        if (!integration) {
            return {
                endpoint: process.env.AZURE_OPENAI_ENDPOINT,
                apiKey: process.env.AZURE_OPENAI_API_KEY,
                deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o-mini',
                apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview'
            };
        }

        return {
            endpoint: integration.endpoint,
            apiKey: integration.apiKey,
            deploymentName: integration.config?.deploymentName || 'gpt-4o-mini',
            apiVersion: integration.config?.apiVersion || '2024-02-15-preview'
        };
    }

    // Get Azure Form Recognizer configuration
    getAzureFormRecognizerConfig() {
        const integration = this.getIntegration('azure_form_recognizer');
        if (!integration) {
            return {
                endpoint: process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
                apiKey: process.env.AZURE_FORM_RECOGNIZER_KEY
            };
        }

        return {
            endpoint: integration.endpoint,
            apiKey: integration.apiKey
        };
    }

    // Get Azure Search configuration
    getAzureSearchConfig() {
        const integration = this.getIntegration('azure_search');
        if (!integration) {
            return {
                endpoint: process.env.AZURE_SEARCH_ENDPOINT,
                apiKey: process.env.AZURE_SEARCH_API_KEY,
                indexName: process.env.AZURE_SEARCH_INDEX_NAME || 'documents'
            };
        }

        return {
            endpoint: integration.endpoint,
            apiKey: integration.apiKey,
            indexName: integration.config?.indexName || 'documents'
        };
    }

    // Test API integration
    async testIntegration(idOrType) {
        const integration = this.getIntegration(idOrType);
        if (!integration) {
            return { success: false, message: 'Integration not found' };
        }

        try {
            const startTime = Date.now();
            let response;

            switch (integration.type) {
                case 'azure_openai':
                    response = await fetch(`${integration.endpoint}/openai/deployments`, {
                        method: 'GET',
                        headers: {
                            'api-key': integration.apiKey,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    });
                    break;

                case 'azure_form_recognizer':
                    response = await fetch(`${integration.endpoint}/formrecognizer/documentModels`, {
                        method: 'GET',
                        headers: {
                            'Ocp-Apim-Subscription-Key': integration.apiKey
                        },
                        timeout: 10000
                    });
                    break;

                case 'azure_search':
                    response = await fetch(`${integration.endpoint}/indexes`, {
                        method: 'GET',
                        headers: {
                            'api-key': integration.apiKey,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    });
                    break;

                default:
                    response = await fetch(integration.endpoint, {
                        method: 'HEAD',
                        timeout: 10000
                    });
            }

            const duration = Date.now() - startTime;
            const success = response.ok || response.status === 405;

            // Update test results
            await supabase
                .from('api_integrations')
                .update({
                    last_test_at: new Date().toISOString(),
                    last_test_result: {
                        success,
                        status: response.status,
                        duration,
                        message: success ? 'Test successful' : `HTTP ${response.status}`
                    }
                })
                .eq('id', integration.id);

            return {
                success,
                status: response.status,
                duration,
                message: success ? 'Test successful' : `HTTP ${response.status}`
            };

        } catch (error) {
            const result = {
                success: false,
                message: error.message,
                duration: 0
            };

            // Update test results
            await supabase
                .from('api_integrations')
                .update({
                    last_test_at: new Date().toISOString(),
                    last_test_result: result
                })
                .eq('id', integration.id);

            return result;
        }
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
        logger.info('Configuration cache cleared');
    }

    // Reload all configurations
    async reloadAll() {
        logger.info('Reloading all configurations...');
        
        this.clearCache();
        
        const [envLoaded, integrationsLoaded] = await Promise.all([
            this.loadEnvironmentVariables(),
            this.loadApiIntegrations()
        ]);

        const success = envLoaded && integrationsLoaded;
        
        logger.info('Configuration reload completed', {
            success,
            environmentVariables: envLoaded,
            apiIntegrations: integrationsLoaded
        });

        return success;
    }
}

// Create singleton instance
const configManager = new ConfigManager();

// Initialize on startup
const initializeConfig = async () => {
    try {
        await configManager.reloadAll();
        logger.info('Configuration manager initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize configuration manager', { error });
    }
};

// Auto-reload every hour
setInterval(() => {
    configManager.reloadAll().catch(error => {
        logger.error('Auto-reload configuration failed', { error });
    });
}, 60 * 60 * 1000);

export { configManager, initializeConfig };
export default configManager;