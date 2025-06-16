// Environment variable validation
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_FORM_RECOGNIZER_ENDPOINT',
  'AZURE_FORM_RECOGNIZER_KEY'
] as const

const optionalEnvVars = [
  'SUPABASE_SERVICE_KEY',
  'AZURE_OPENAI_DEPLOYMENT_NAME',
  'AZURE_SEARCH_ENDPOINT',
  'AZURE_SEARCH_API_KEY',
  'AZURE_SEARCH_INDEX_NAME',
  'APPLICATIONINSIGHTS_CONNECTION_STRING',
  'MAX_FILE_SIZE',
  'SUPABASE_STORAGE_BUCKET',
  'DEFAULT_ANALYSIS_TIMEOUT_SECONDS'
] as const

export function validateEnv() {
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar])
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env.local file and ensure all required variables are set.'
    )
  }
  
  console.log('✅ Environment variables validated successfully')
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
    app: {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
      storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'documents',
      analysisTimeout: parseInt(process.env.DEFAULT_ANALYSIS_TIMEOUT_SECONDS || '300', 10) * 1000,
    },
  }
}

// Validate environment on module load in production
if (process.env.NODE_ENV === 'production') {
  validateEnv()
}