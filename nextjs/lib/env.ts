// Environment variable validation
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_FORM_RECOGNIZER_ENDPOINT',
  'AZURE_FORM_RECOGNIZER_KEY',
  'CSRF_SECRET',
  'ENCRYPTION_KEY',
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
];

export function validateEnv() {
  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env.local file and ensure all required variables are set.'
    );
  }

  // Additional security validation for critical keys
  validateSecurityKeys();

  console.log('✅ Environment variables validated successfully');
}

function validateSecurityKeys() {
  const csrfSecret = process.env.CSRF_SECRET;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Validate CSRF secret strength
  if (csrfSecret && (csrfSecret.length < 32 || csrfSecret.includes('default'))) {
    throw new Error('CSRF_SECRET must be at least 32 characters long and cannot contain "default"');
  }

  // Validate encryption key strength
  if (encryptionKey && (encryptionKey.length < 32 || encryptionKey.includes('default'))) {
    throw new Error(
      'ENCRYPTION_KEY must be at least 32 characters long and cannot contain "default"'
    );
  }

  // Validate Supabase service key format
  if (supabaseServiceKey && !supabaseServiceKey.startsWith('sbp_')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be a valid Supabase service role key');
  }

  // Validate Azure OpenAI key format
  const azureOpenAIKey = process.env.AZURE_OPENAI_API_KEY;
  if (azureOpenAIKey && azureOpenAIKey.length < 32) {
    throw new Error('AZURE_OPENAI_API_KEY must be a valid Azure OpenAI API key');
  }
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
      console.warn(
        '⚠️  Rate limiting will be DISABLED - consider configuring Redis for production use'
      );
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
export async function createRedisClient() {
  const config = validateRedisConfig();

  if (!config) {
    return null;
  }

  try {
    const { Redis } = await import('@upstash/redis');
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
