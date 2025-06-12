/**
 * Environment variable validation utility
 * Validates required environment variables and provides fallbacks for non-critical ones this
 */

// Critical environment variables that must be present for the application to function
const CRITICAL_ENV_VARS = [
  // Supabase Configuration
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  
  // Azure AI Services
  'AZURE_FORM_RECOGNIZER_KEY',
  'AZURE_FORM_RECOGNIZER_ENDPOINT',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
  'AZURE_SEARCH_ENDPOINT',
  'AZURE_SEARCH_API_KEY',
  'AZURE_SEARCH_INDEX_NAME',

  // Production-specific (required in production only)
  ...(process.env.NODE_ENV === 'production' ? [
    'ALLOWED_ORIGINS',
  ] : [])
];

// Non-critical environment variables with fallback values
const NON_CRITICAL_ENV_VARS = {
  'PORT': '3001',
  'NODE_ENV': 'development',
  'AZURE_OPENAI_API_VERSION': '2024-02-15-preview',
  'AZURE_OPENAI_DEPLOYMENT_NAME': 'gpt-4-turbo',
  'AZURE_SEARCH_INDEX_NAME': 'esussearch',
  'AZURE_SERVICE_BUS_CONNECTION_STRING': '',
  'SUPABASE_STORAGE_BUCKET': 'documents',
  'LOG_LEVEL': process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  'MAX_FILE_SIZE': '52428800', // 50MB in bytes
  'ALLOWED_FILE_TYPES': 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv',
  'RATE_LIMIT_WINDOW_MS': '900000', // 15 minutes
  'RATE_LIMIT_MAX_REQUESTS': '100',
  'AUTH_RATE_LIMIT_MAX_REQUESTS': '5',
  'SESSION_TIMEOUT_HOURS': '24',
  'MAX_LOGIN_ATTEMPTS': '5',
  'ACCOUNT_LOCKOUT_MINUTES': '30'
};

// URL validation regex
const URL_REGEX = /^https?:\/\/.+/i;

/**
 * Validates the format of specific environment variables
 * @param {string} name Variable name
 * @param {string} value Variable value
 * @returns {boolean} Whether the value is valid
 */
function validateVariableFormat(name, value) {
  if (!value) return false;

  // URL format validation
  if (name.includes('URL') || name.includes('ENDPOINT')) {
    return URL_REGEX.test(value);
  }

  // Key format validation
  if (name.includes('KEY')) {
    return value.length >= 32; // Most Azure/Supabase keys are at least 32 chars
  }

  // CORS origins validation
  if (name === 'ALLOWED_ORIGINS' && process.env.NODE_ENV === 'production') {
    const origins = value.split(',');
    return origins.every(origin => URL_REGEX.test(origin));
  }

  return true;
}

/**
 * Validates Supabase configuration environment variables
 * @throws Will throw an error if a required Supabase environment variable is missing or invalid
 */
export function validateSupabaseConfig() {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_STORAGE_BUCKET'
  ];

  // Allow JWT_SECRET as a fallback for SUPABASE_JWT_SECRET
  if (!process.env.SUPABASE_JWT_SECRET && process.env.JWT_SECRET) {
    process.env.SUPABASE_JWT_SECRET = process.env.JWT_SECRET;
  }
  
  requiredVars.push('SUPABASE_JWT_SECRET');

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
      throw new Error(`Missing required Supabase environment variables: ${missing.join(', ')}`);
  }

  // Validate URL format
  try {
      new URL(process.env.SUPABASE_URL);
  } catch (e) {
      throw new Error('Invalid SUPABASE_URL format');
  }

  // Validate key formats
  const keyVars = ['SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_JWT_SECRET'];
  keyVars.forEach(key => {
      if (process.env[key]?.length < 30) {
          throw new Error(`${key} appears to be invalid (too short)`);
      }
  });
}

/**
 * Validates all required environment variables
 * @returns {Object} Object containing validation result and any missing or invalid variables
 */
export function validateEnv() {
  const missing = [];
  const invalid = [];
  
  // Check critical environment variables
  CRITICAL_ENV_VARS.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
      missing.push(varName);
    } else if (!validateVariableFormat(varName, value)) {
      invalid.push(varName);
    }
  });
  
  // Validate Supabase configuration
  validateSupabaseConfig();
  
  // Apply fallbacks for non-critical variables
  Object.entries(NON_CRITICAL_ENV_VARS).forEach(([varName, fallbackValue]) => {
    if (!process.env[varName]) {
      console.warn(`Environment variable ${varName} not set, using fallback value`);
      process.env[varName] = fallbackValue;
    }
  });
  
  return {
    isValid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid
  };
}

/**
 * Validates environment variables and exits the process if critical variables are missing or invalid
 */
export function validateEnvOrExit() {
  const { isValid, missing, invalid } = validateEnv();
  
  if (!isValid) {
    console.error('\nEnvironment validation failed!');
    
    if (missing.length > 0) {
      console.error('\nMissing required environment variables:');
      missing.forEach(varName => {
        console.error(`  - ${varName}`);
      });
    }
    
    if (invalid.length > 0) {
      console.error('\nInvalid environment variables:');
      invalid.forEach(varName => {
        console.error(`  - ${varName}: Invalid format`);
      });
    }
    
    console.error('\nApplication cannot start. Please check your .env file and documentation.');
    
    if (process.env.NODE_ENV === 'production') {
      console.error('Note: Additional environment variables are required in production mode.');
    }
    
    process.exit(1);
  }
  
  console.log('✓ Environment validation successful');
  return true;
}
