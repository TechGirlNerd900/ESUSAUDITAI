export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Development mode fallbacks
export const DEV_DUMMY_VALUES = {
  GEMINI_API_KEY: 'dummy-key-for-dev',
  UPSTASH_REDIS_REST_URL: 'http://localhost:6379',
  UPSTASH_REDIS_REST_TOKEN: 'dummy-token-for-dev',
};