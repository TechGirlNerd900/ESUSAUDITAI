// Environment variable validation
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_FORM_RECOGNIZER_ENDPOINT',
  'AZURE_FORM_RECOGNIZER_KEY',
] as const;

const optionalEnvVars = [
  'SUPABASE_SERVICE_KEY',
  'AZURE_OPENAI_DEPLOYMENT_NAME',
  'AZURE_SEARCH_ENDPOINT',
  'AZURE_SEARCH_API_KEY',
  'AZURE_SEARCH_INDEX_NAME',
  'APPLICATIONINSIGHTS_CONNECTION_STRING',
  'MAX_FILE_SIZE',
  'SUPABASE_STORAGE_BUCKET',
  'DEFAULT_ANALYSIS_TIMEOUT_SECONDS',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const;

export function validateEnv() {
  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env.local file and ensure all required variables are set.'
    );
  }

  console.log('✅ Environment variables validated successfully');
}

export function getEnvConfig() {
  return {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      serviceKey: process.env.SUPABASE_SERVICE_KEY,
    },
    azure: {
      openai: {
        apiKey: process.env.AZURE_OPENAI_API_KEY!,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
      },
      documentIntelligence: {
        endpoint: process.env.AZURE_FORM_RECOGNIZER_ENDPOINT!,
        key: process.env.AZURE_FORM_RECOGNIZER_KEY!,
      },
      search: {
        endpoint: process.env.AZURE_SEARCH_ENDPOINT,
        apiKey: process.env.AZURE_SEARCH_API_KEY,
        indexName: process.env.AZURE_SEARCH_INDEX_NAME,
      },
      appInsights: {
        connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
      },
    },
    redis: {
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    },
    app: {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
      storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'documents',
      analysisTimeout: parseInt(process.env.DEFAULT_ANALYSIS_TIMEOUT_SECONDS || '300', 10) * 1000,
    },
  };
}

/**
 * Validate Redis configuration and provide clear feedback
 * @returns Redis config object or null if not configured
 */
export function validateRedisConfig(): { url: string; token: string } | null {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️  Redis configuration incomplete in production:', {
        hasUrl: !!redisUrl,
        hasToken: !!redisToken,
        environment: process.env.NODE_ENV,
      });
      console.warn('⚠️  Rate limiting will be DISABLED - consider configuring Redis for production use');
    } else {
      console.log('ℹ️  Redis not configured - rate limiting disabled for development');
    }
    return null;
  }

  console.log('✅ Redis configuration validated successfully');
  return { url: redisUrl, token: redisToken };
}

/**
 * Create a Redis client instance with proper error handling
 * @returns Redis client or null if configuration is missing
 */
export function createRedisClient() {
  const config = validateRedisConfig();
  
  if (!config) {
    return null;
  }

  try {
    const { Redis } = require('@upstash/redis');
    const redis = new Redis({
      url: config.url,
      token: config.token,
    });
    
    console.log('✅ Redis client initialized successfully');
    return redis;
  } catch (error) {
    console.error('❌ Redis client initialization failed:', error);
    console.error('❌ Rate limiting will be DISABLED due to configuration error');
    return null;
  }
}

// Validate environment on module load in production
if (process.env.NODE_ENV === 'production') {
  validateEnv();
}
