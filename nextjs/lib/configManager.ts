/**
 * Configuration Manager
 *
 * This module provides a centralized configuration management system with:
 * - Database-stored configuration with fallback to environment variables
 * - Caching with automatic refresh
 * - Encryption for sensitive values
 * - Organization-specific configuration
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import NodeCache from 'node-cache';
import { withRetry, DatabaseError, ExternalServiceError } from './errorHandler';
import { CircuitBreaker } from './errorHandler';
import logger, { Logger } from './logger';
import crypto from 'crypto';

// Configuration types
export enum ConfigCategory {
  DATABASE = 'database',
  AZURE = 'azure',
  AUTH = 'auth',
  SECURITY = 'security',
  MONITORING = 'monitoring',
  CUSTOM = 'custom',
}

// Configuration interface
export interface ConfigItem {
  key: string;
  value: string;
  description?: string;
  category: ConfigCategory;
  sensitive: boolean;
  organization_id?: string;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

// API Integration types
export enum IntegrationType {
  AZURE_OPENAI = 'azure_openai',
  AZURE_FORM_RECOGNIZER = 'azure_form_recognizer',
  AZURE_SEARCH = 'azure_search',
  CUSTOM = 'custom',
}

// API Integration interface
export interface ApiIntegration {
  id: string;
  name: string;
  type: IntegrationType;
  endpoint: string;
  api_key: string;
  config: Record<string, any>;
  enabled: boolean;
  last_test_result?: Record<string, any>;
  organization_id?: string;
}

// Configuration manager options
export interface ConfigManagerOptions {
  supabaseUrl?: string;
  supabaseKey?: string;
  cacheTTL?: number;
  refreshInterval?: number;
  encryptionKey?: string;
}

/**
 * Configuration Manager class
 * Manages application configuration from database and environment variables
 */
export class ConfigManager {
  private supabase: SupabaseClient;
  private cache: NodeCache;
  private logger: Logger;
  private refreshInterval: number;
  private refreshTimer?: NodeJS.Timeout | undefined;
  private azureCircuitBreaker: CircuitBreaker;
  private initialized: boolean = false;
  private initializing: boolean = false;
  private initPromise?: Promise<void>;

  constructor(options: ConfigManagerOptions = {}) {
    // Validate required env vars
    const supabaseUrl = options.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = options.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Service Role Key must be set in environment variables.');
    }

    // Initialize Supabase client
    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize cache
    this.cache = new NodeCache({
      stdTTL: options.cacheTTL || 3600, // 1 hour default TTL
      checkperiod: 600, // Check for expired entries every 10 minutes
    });

    // Initialize logger
    this.logger = logger.withComponent('ConfigManager');

    // Set refresh interval
    this.refreshInterval = options.refreshInterval || 3600000; // 1 hour default

    // Initialize circuit breaker
    this.azureCircuitBreaker = new CircuitBreaker(3, 60000, 2);
  }

  /**
   * Initialize the configuration manager
   * Loads all configuration from the database
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializing) {
      return this.initPromise;
    }

    this.initializing = true;
    this.initPromise = this.loadAllConfig();

    try {
      await this.initPromise;
      this.initialized = true;
      this.initializing = false;

      // Start refresh timer
      this.startRefreshTimer();

      this.logger.info('Configuration manager initialized');
    } catch (error) {
      this.initializing = false;
      // Ensure error is an Error object
      this.logger.error(
        'Failed to initialize configuration manager',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Start the refresh timer
   */
  private startRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      this.loadAllConfig().catch((error) => {
        this.logger.error('Failed to refresh configuration', error);
      });
    }, this.refreshInterval);
  }

  /**
   * Stop the refresh timer
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Load all configuration from the database
   */
  private async loadAllConfig(): Promise<void> {
    try {
      // Load app settings
      const { data: appSettings, error: settingsError } = await this.supabase
        .from('app_settings')
        .select('*');

      if (settingsError) {
        throw new DatabaseError('select', settingsError.message, { table: 'app_settings' });
      }

      // Load API integrations
      const { data: apiIntegrations, error: integrationsError } = await this.supabase
        .from('api_integrations')
        .select('*');

      if (integrationsError) {
        throw new DatabaseError('select', integrationsError.message, { table: 'api_integrations' });
      }

      // Cache app settings
      if (appSettings) {
        for (const setting of appSettings) {
          const cacheKey = `config:${setting.key}`;
          this.cache.set(cacheKey, setting);
        }
      }

      // Cache API integrations
      if (apiIntegrations) {
        for (const integration of apiIntegrations) {
          const cacheKey = `integration:${integration.id}`;
          this.cache.set(cacheKey, integration);

          // Cache by type for quick lookup
          const typeKey = `integration_type:${integration.type}`;
          const typeIntegrations = this.cache.get<ApiIntegration[]>(typeKey) || [];

          // Prevent duplicates
          if (!typeIntegrations.some((i) => i.id === integration.id)) {
            typeIntegrations.push(integration);
            this.cache.set(typeKey, typeIntegrations);
          }
        }
      }

      this.logger.info('Configuration loaded', {
        settingsCount: appSettings?.length || 0,
        integrationsCount: apiIntegrations?.length || 0,
      });
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Failed to load configuration', error);
      } else {
        this.logger.error('Failed to load configuration', new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * Get a configuration value
   * @param key Configuration key
   * @param defaultValue Default value if not found
   * @param organizationId Optional organization ID for organization-specific config
   * @returns Configuration value
   */
  async getConfig(
    key: string,
    defaultValue?: string,
    organizationId?: string
  ): Promise<string | undefined> {
    await this.ensureInitialized();

    // Try to get from cache first
    const cacheKey = `config:${key}`;
    const cachedConfig = this.cache.get<ConfigItem>(cacheKey);

    if (cachedConfig) {
      // If organization-specific config is requested, check if it matches
      if (
        organizationId &&
        cachedConfig.organization_id &&
        cachedConfig.organization_id !== organizationId
      ) {
        // Organization mismatch, try to get from database
        return this.getConfigFromDatabase(key, defaultValue, organizationId);
      }

      return this.decryptIfNeeded(cachedConfig);
    }

    // Not in cache, try to get from database
    return this.getConfigFromDatabase(key, defaultValue, organizationId);
  }

  /**
   * Get a configuration value from the database
   * @param key Configuration key
   * @param defaultValue Default value if not found
   * @param organizationId Optional organization ID for organization-specific config
   * @returns Configuration value
   */
  private async getConfigFromDatabase(
    key: string,
    defaultValue?: string,
    organizationId?: string
  ): Promise<string | undefined> {
    try {
      let query = this.supabase.from('app_settings').select('*').eq('key', key);

      // If organization ID is provided, filter by it
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        throw new DatabaseError('select', error.message, { table: 'app_settings', key });
      }

      if (data) {
        // Cache the result
        const cacheKey = `config:${key}`;
        this.cache.set(cacheKey, data);

        return this.decryptIfNeeded(data);
      }

      // Not found in database, try environment variable
      const envValue = process.env[key];
      if (envValue !== undefined) {
        return envValue;
      }

      // Return default value
      return defaultValue;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to get config: ${key}`, error);
      } else {
        this.logger.error(`Failed to get config: ${key}`, new Error(String(error)));
      }
      // Fallback to environment variable
      const envValue = process.env[key];
      if (envValue !== undefined) {
        return envValue;
      }
      // Return default value
      return defaultValue;
    }
  }

  /**
   * Set a configuration value
   * @param key Configuration key
   * @param value Configuration value
   * @param options Configuration options
   * @returns The updated configuration item
   */
  async setConfig(
    key: string,
    value: string,
    options: {
      description?: string;
      category?: ConfigCategory;
      sensitive?: boolean;
      organizationId?: string;
      userId?: string;
    } = {}
  ): Promise<ConfigItem> {
    await this.ensureInitialized();

    const {
      description,
      category = ConfigCategory.CUSTOM,
      sensitive = false,
      organizationId,
      userId,
    } = options;

    try {
      // Encrypt sensitive values
      const finalValue = sensitive ? this.encrypt(value) : value;

      // Check if config already exists
      const { data: existingConfig, error: checkError } = await this.supabase
        .from('app_settings')
        .select('*')
        .eq('key', key)
        .maybeSingle();

      if (checkError) {
        throw new DatabaseError('select', checkError.message, { table: 'app_settings', key });
      }

      let result;

      if (existingConfig) {
        // Update existing config
        const { data, error } = await this.supabase
          .from('app_settings')
          .update({
            value: finalValue,
            description: description || existingConfig.description,
            category: category || existingConfig.category,
            sensitive: sensitive !== undefined ? sensitive : existingConfig.sensitive,
            organization_id: organizationId || existingConfig.organization_id,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('key', key)
          .select()
          .single();

        if (error) {
          throw new DatabaseError('update', error.message, { table: 'app_settings', key });
        }

        result = data;
      } else {
        // Insert new config
        const { data, error } = await this.supabase
          .from('app_settings')
          .insert({
            key,
            value: finalValue,
            description,
            category,
            sensitive,
            organization_id: organizationId,
            created_by: userId,
            updated_by: userId,
          })
          .select()
          .single();

        if (error) {
          throw new DatabaseError('insert', error.message, { table: 'app_settings', key });
        }

        result = data;
      }

      // Update cache
      const cacheKey = `config:${key}`;
      this.cache.set(cacheKey, result);

      return {
        ...result,
        value: sensitive ? value : result.value, // Return original value for sensitive data
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to set config: ${key}`, error);
      } else {
        this.logger.error(`Failed to set config: ${key}`, new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * Delete a configuration value
   * @param key Configuration key
   * @returns Whether the deletion was successful
   */
  async deleteConfig(key: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const { error } = await this.supabase.from('app_settings').delete().eq('key', key);

      if (error) {
        throw new DatabaseError('delete', error.message, { table: 'app_settings', key });
      }

      // Remove from cache
      const cacheKey = `config:${key}`;
      this.cache.del(cacheKey);

      return true;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to delete config: ${key}`, error);
      } else {
        this.logger.error(`Failed to delete config: ${key}`, new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * Get all configuration values
   * @param category Optional category filter
   * @param organizationId Optional organization ID filter
   * @returns Array of configuration items
   */
  async getAllConfig(category?: ConfigCategory, organizationId?: string): Promise<ConfigItem[]> {
    await this.ensureInitialized();

    try {
      let query = this.supabase.from('app_settings').select('*');

      // Apply filters
      if (category) {
        query = query.eq('category', category);
      }

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError('select', error.message, { table: 'app_settings' });
      }

      // Mask sensitive values
      return data.map((item: any) => ({
        ...item,
        value: item.sensitive ? '********' : item.value,
      }));
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Failed to get all config', error);
      } else {
        this.logger.error('Failed to get all config', new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * Get an API integration by ID
   * @param id Integration ID
   * @returns API integration
   */
  async getIntegration(id: string): Promise<ApiIntegration | undefined> {
    await this.ensureInitialized();

    // Try to get from cache first
    const cacheKey = `integration:${id}`;
    const cachedIntegration = this.cache.get<ApiIntegration>(cacheKey);

    if (cachedIntegration) {
      return {
        ...cachedIntegration,
        api_key: '********', // Mask API key
      };
    }

    // Not in cache, try to get from database
    try {
      const { data, error } = await this.supabase
        .from('api_integrations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new DatabaseError('select', error.message, { table: 'api_integrations', id });
      }

      if (data) {
        // Cache the result
        this.cache.set(cacheKey, data);

        return {
          ...data,
          api_key: '********', // Mask API key
        };
      }

      return undefined;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to get integration: ${id}`, error);
      } else {
        this.logger.error(`Failed to get integration: ${id}`, new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * Get API integrations by type
   * @param type Integration type
   * @param organizationId Optional organization ID filter
   * @returns Array of API integrations
   */
  async getIntegrationsByType(
    type: IntegrationType,
    organizationId?: string
  ): Promise<ApiIntegration[]> {
    await this.ensureInitialized();

    // Try to get from cache first
    const cacheKey = `integration_type:${type}`;
    const cachedIntegrations = this.cache.get<ApiIntegration[]>(cacheKey);

    if (cachedIntegrations) {
      // Filter by organization ID if provided
      const filtered = organizationId
        ? cachedIntegrations.filter(
            (i) => !i.organization_id || i.organization_id === organizationId
          )
        : cachedIntegrations;

      // Mask API keys
      return filtered.map((integration) => ({
        ...integration,
        api_key: '********', // Mask API key
      }));
    }

    // Not in cache, try to get from database
    try {
      let query = this.supabase.from('api_integrations').select('*').eq('type', type);

      // Apply organization filter
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError('select', error.message, { table: 'api_integrations', type });
      }

      // Cache the result
      this.cache.set(cacheKey, data);

      // Mask API keys
      return data.map((integration: any) => ({
        ...integration,
        api_key: '********', // Mask API key
      }));
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to get integrations by type: ${type}`, error);
      } else {
        this.logger.error(`Failed to get integrations by type: ${type}`, new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * Set an API integration
   * @param integration API integration
   * @param userId User ID for audit
   * @returns The updated API integration
   */
  async setIntegration(integration: ApiIntegration, userId?: string): Promise<ApiIntegration> {
    await this.ensureInitialized();

    try {
      // Check if integration already exists
      const { data: existingIntegration, error: checkError } = await this.supabase
        .from('api_integrations')
        .select('*')
        .eq('id', integration.id)
        .maybeSingle();

      if (checkError) {
        throw new DatabaseError('select', checkError.message, {
          table: 'api_integrations',
          id: integration.id,
        });
      }

      // Encrypt API key
      const encryptedApiKey = this.encrypt(integration.api_key);

      let result;

      if (existingIntegration) {
        // Update existing integration
        const { data, error } = await this.supabase
          .from('api_integrations')
          .update({
            name: integration.name,
            type: integration.type,
            endpoint: integration.endpoint,
            api_key: encryptedApiKey,
            config: integration.config,
            enabled: integration.enabled,
            organization_id: integration.organization_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', integration.id)
          .select()
          .single();

        if (error) {
          throw new DatabaseError('update', error.message, {
            table: 'api_integrations',
            id: integration.id,
          });
        }

        result = data;
      } else {
        // Insert new integration
        const { data, error } = await this.supabase
          .from('api_integrations')
          .insert({
            id: integration.id,
            name: integration.name,
            type: integration.type,
            endpoint: integration.endpoint,
            api_key: encryptedApiKey,
            config: integration.config,
            enabled: integration.enabled,
            organization_id: integration.organization_id,
          })
          .select()
          .single();

        if (error) {
          throw new DatabaseError('insert', error.message, {
            table: 'api_integrations',
            id: integration.id,
          });
        }

        result = data;
      }

      // Update cache
      const cacheKey = `integration:${integration.id}`;
      this.cache.set(cacheKey, result);

      // Update type cache
      const typeKey = `integration_type:${integration.type}`;
      const typeIntegrations = this.cache.get<ApiIntegration[]>(typeKey) || [];
      const typeIndex = typeIntegrations.findIndex((i) => i.id === integration.id);

      if (typeIndex >= 0) {
        typeIntegrations[typeIndex] = result;
      } else {
        typeIntegrations.push(result);
      }

      this.cache.set(typeKey, typeIntegrations);

      // Log audit event if userId provided
      if (userId) {
        try {
          await this.supabase.from('audit_logs').insert({
            user_id: userId,
            action: existingIntegration ? 'update' : 'create',
            resource_type: 'api_integration',
            resource_id: integration.id,
            details: {
              name: integration.name,
              type: integration.type,
              endpoint: integration.endpoint,
            },
          });
        } catch (error: any) {
          this.logger.error(
            'Failed to log audit event',
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }

      return {
        ...result,
        api_key: integration.api_key, // Return original API key
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to set integration: ${integration.id}`, error);
      } else {
        this.logger.error(`Failed to set integration: ${integration.id}`, new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * Delete an API integration
   * @param id Integration ID
   * @param userId User ID for audit
   * @returns Whether the deletion was successful
   */
  async deleteIntegration(id: string, userId?: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      // Get integration type for cache update
      const { data: integration, error: getError } = await this.supabase
        .from('api_integrations')
        .select('type')
        .eq('id', id)
        .maybeSingle();

      if (getError) {
        throw new DatabaseError('select', getError.message, { table: 'api_integrations', id });
      }

      if (!integration) {
        return false; // Integration not found
      }

      // Delete integration
      const { error } = await this.supabase.from('api_integrations').delete().eq('id', id);

      if (error) {
        throw new DatabaseError('delete', error.message, { table: 'api_integrations', id });
      }

      // Remove from cache
      const cacheKey = `integration:${id}`;
      this.cache.del(cacheKey);

      // Update type cache
      const typeKey = `integration_type:${integration.type}`;
      const typeIntegrations = this.cache.get<ApiIntegration[]>(typeKey) || [];
      const updatedTypeIntegrations = typeIntegrations.filter((i) => i.id !== id);
      this.cache.set(typeKey, updatedTypeIntegrations);

      // Log audit event if userId provided
      if (userId) {
        try {
          await this.supabase.from('audit_logs').insert({
            user_id: userId,
            action: 'delete',
            resource_type: 'api_integration',
            resource_id: id,
            details: {
              type: integration.type,
            },
          });
        } catch (error: any) {
          this.logger.error(
            'Failed to log audit event',
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }

      return true;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to delete integration: ${id}`, error);
      } else {
        this.logger.error(`Failed to delete integration: ${id}`, new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * Test an API integration
   * @param id Integration ID
   * @returns Test result
   */
  async testIntegration(id: string): Promise<Record<string, any>> {
    await this.ensureInitialized();

    try {
      // Get integration
      const { data: integration, error: getError } = await this.supabase
        .from('api_integrations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (getError) {
        throw new DatabaseError('select', getError.message, { table: 'api_integrations', id });
      }

      if (!integration) {
        throw new Error(`Integration not found: ${id}`);
      }

      // Decrypt API key
      const apiKey = this.decrypt(integration.api_key);

      // Test integration based on type
      let testResult;

      switch (integration.type) {
        case IntegrationType.AZURE_OPENAI:
          testResult = await this.testAzureOpenAI(integration.endpoint, apiKey, integration.config);
          break;
        case IntegrationType.AZURE_FORM_RECOGNIZER:
          testResult = await this.testAzureFormRecognizer(integration.endpoint, apiKey);
          break;
        case IntegrationType.AZURE_SEARCH:
          testResult = await this.testAzureSearch(integration.endpoint, apiKey, integration.config);
          break;
        case IntegrationType.CUSTOM:
          testResult = await this.testCustomIntegration(
            integration.endpoint,
            apiKey,
            integration.config
          );
          break;
        default:
          throw new Error(`Unsupported integration type: ${integration.type}`);
      }

      // Update last test result
      const { error: updateError } = await this.supabase
        .from('api_integrations')
        .update({
          last_test_result: {
            ...testResult,
            timestamp: new Date().toISOString(),
          },
        })
        .eq('id', id);

      if (updateError) {
        this.logger.error(`Failed to update test result: ${id}`, updateError);
      }

      return testResult;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to test integration: ${id}`, error);
      } else {
        this.logger.error(`Failed to test integration: ${id}`, new Error(String(error)));
      }
      // Update last test result with error
      try {
        await this.supabase
          .from('api_integrations')
          .update({
            last_test_result: {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            },
          })
          .eq('id', id);
      } catch (updateError: unknown) {
        this.logger.error(
          `Failed to update test result: ${id}`,
          updateError instanceof Error ? updateError : new Error(String(updateError))
        );
      }
      throw error;
    }
  }

  /**
   * Test Azure OpenAI integration
   * @param endpoint Azure OpenAI endpoint
   * @param apiKey Azure OpenAI API key
   * @param config Azure OpenAI configuration
   * @returns Test result
   */
  private async testAzureOpenAI(
    endpoint: string,
    apiKey: string,
    config: Record<string, any>
  ): Promise<Record<string, any>> {
    return await this.azureCircuitBreaker.execute(async () => {
      const start = Date.now();
      const url = `${endpoint}/openai/deployments?api-version=${config.apiVersion || '2023-05-15'}&limit=1`;
      const res = await fetch(url, {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });
      const responseTime = Date.now() - start;
      if (!res.ok) {
        return { success: false, error: await res.text(), responseTime };
      }
      const data = await res.json();
      return {
        success: true,
        models: Array.isArray(data.value) ? data.value.map((m: any) => m.model) : [],
        responseTime,
      };
    });
  }

  /**
   * Test Azure Form Recognizer integration
   * @param endpoint Azure Form Recognizer endpoint
   * @param apiKey Azure Form Recognizer API key
   * @returns Test result
   */
  private async testAzureFormRecognizer(
    endpoint: string,
    apiKey: string
  ): Promise<Record<string, any>> {
    return await this.azureCircuitBreaker.execute(async () => {
      const start = Date.now();
      const url = `${endpoint}/formrecognizer/documentModels?api-version=2023-07-31`;
      const res = await fetch(url, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });
      const responseTime = Date.now() - start;
      if (!res.ok) {
        return { success: false, error: await res.text(), responseTime };
      }
      const data = await res.json();
      return {
        success: true,
        models: Array.isArray(data.value) ? data.value.map((m: any) => m.modelId) : [],
        responseTime,
      };
    });
  }

  /**
   * Test Azure Search integration
   * @param endpoint Azure Search endpoint
   * @param apiKey Azure Search API key
   * @param config Azure Search configuration
   * @returns Test result
   */
  private async testAzureSearch(
    endpoint: string,
    apiKey: string,
    config: Record<string, any>
  ): Promise<Record<string, any>> {
    return await this.azureCircuitBreaker.execute(async () => {
      const start = Date.now();
      const url = `${endpoint}/indexes?api-version=${config.apiVersion || '2023-11-01'}`;
      const res = await fetch(url, {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });
      const responseTime = Date.now() - start;
      if (!res.ok) {
        return { success: false, error: await res.text(), responseTime };
      }
      const data = await res.json();
      return {
        success: true,
        indexes: Array.isArray(data.value) ? data.value.map((i: any) => i.name) : [],
        responseTime,
      };
    });
  }

  /**
   * Test custom integration
   * @param endpoint Custom endpoint
   * @param apiKey Custom API key
   * @param config Custom configuration
   * @returns Test result
   */
  private async testCustomIntegration(
    endpoint: string,
    apiKey: string,
    config: Record<string, any>
  ): Promise<Record<string, any>> {
    const start = Date.now();
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    const responseTime = Date.now() - start;
    if (!res.ok) {
      return { success: false, error: await res.text(), responseTime };
    }
    const data = await res.json();
    return {
      success: true,
      data,
      responseTime,
    };
  }

  /**
   * Get Azure OpenAI configuration
   * @param organizationId Optional organization ID
   * @returns Azure OpenAI configuration
   */
  async getAzureOpenAIConfig(organizationId?: string): Promise<Record<string, any>> {
    await this.ensureInitialized();

    try {
      // Get Azure OpenAI integration
      const integrations = await this.getIntegrationsByType(
        IntegrationType.AZURE_OPENAI,
        organizationId
      );

      // Find enabled integration
      const integration = integrations.find((i) => i.enabled);

      if (!integration) {
        // Fallback to environment variables
        return {
          endpoint: process.env.AZURE_OPENAI_ENDPOINT,
          apiKey: process.env.AZURE_OPENAI_API_KEY,
          deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
          apiVersion: process.env.AZURE_OPENAI_API_VERSION,
        };
      }

      // Get decrypted API key
      const apiKey = await this.getDecryptedApiKey(integration.id);

      return {
        endpoint: integration.endpoint,
        apiKey,
        ...integration.config,
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Failed to get Azure OpenAI configuration', error);
      } else {
        this.logger.error('Failed to get Azure OpenAI configuration', new Error(String(error)));
      }
      // Fallback to environment variables
      return {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      };
    }
  }

  /**
   * Get Azure Form Recognizer configuration
   * @param organizationId Optional organization ID
   * @returns Azure Form Recognizer configuration
   */
  async getAzureFormRecognizerConfig(organizationId?: string): Promise<Record<string, any>> {
    await this.ensureInitialized();

    try {
      // Get Azure Form Recognizer integration
      const integrations = await this.getIntegrationsByType(
        IntegrationType.AZURE_FORM_RECOGNIZER,
        organizationId
      );

      // Find enabled integration
      const integration = integrations.find((i) => i.enabled);

      if (!integration) {
        // Fallback to environment variables
        return {
          endpoint: process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
          apiKey: process.env.AZURE_FORM_RECOGNIZER_KEY,
        };
      }

      // Get decrypted API key
      const apiKey = await this.getDecryptedApiKey(integration.id);

      return {
        endpoint: integration.endpoint,
        apiKey,
        ...integration.config,
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Failed to get Azure Form Recognizer configuration', error);
      } else {
        this.logger.error(
          'Failed to get Azure Form Recognizer configuration',
          new Error(String(error))
        );
      }
      // Fallback to environment variables
      return {
        endpoint: process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
        apiKey: process.env.AZURE_FORM_RECOGNIZER_KEY,
      };
    }
  }

  /**
   * Get decrypted API key for an integration
   * @param integrationId Integration ID
   * @returns Decrypted API key
   */
  private async getDecryptedApiKey(integrationId: string): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('api_integrations')
        .select('api_key')
        .eq('id', integrationId)
        .single();

      if (error) {
        throw new DatabaseError('select', error.message, {
          table: 'api_integrations',
          id: integrationId,
        });
      }

      return this.decrypt(data.api_key);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to get decrypted API key: ${integrationId}`, error);
      } else {
        this.logger.error(
          `Failed to get decrypted API key: ${integrationId}`,
          new Error(String(error))
        );
      }
      throw error;
    }
  }

  /**
   * Reload all configuration
   */
  async reloadAll(): Promise<void> {
    this.logger.info('Reloading all configuration');

    // Clear cache
    this.cache.flushAll();

    // Load all configuration
    await this.loadAllConfig();

    this.logger.info('Configuration reloaded');
  }

  /**
   * Ensure the configuration manager is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Decrypt a value if it's sensitive
   * @param config Configuration item
   * @returns Decrypted value
   */
  private decryptIfNeeded(config: ConfigItem): string {
    if (config.sensitive) {
      return this.decrypt(config.value);
    }
    return config.value;
  }

  /**
   * Encrypt a value
   * @param value Value to encrypt
   * @returns Encrypted value
   */
  private encrypt(value: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(value, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), encrypted].join(':');
  }

  /**
   * Decrypt a value
   * @param value Value to decrypt
   * @returns Decrypted value
   */
  private decrypt(value: string): string {
    const [ivB64, tagB64, encrypted] = value.split(':');
    if (!ivB64 || !tagB64 || !encrypted) {
      throw new Error('Malformed encrypted value');
    }
    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private getEncryptionKey(): Buffer {
    const passphrase = process.env.CONFIG_ENCRYPTION_KEY || '';
    if (!passphrase) throw new Error('CONFIG_ENCRYPTION_KEY env var is required for encryption');
    // Use PBKDF2 to derive a 32-byte key
    return crypto.pbkdf2Sync(passphrase, 'config_salt', 100000, 32, 'sha256');
  }
}

// Create a singleton instance
const configManager = new ConfigManager();

// Export the singleton instance
export default configManager;
