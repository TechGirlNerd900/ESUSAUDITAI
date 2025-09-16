// Centralized environment variable loader for Next.js
// Add all required environment variables here and export them

import { Redis } from '@upstash/redis';

export const env = {
  NODE_ENV: process.env.NODE_ENV,

  // Google Cloud Configuration
  GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,
  GOOGLE_LOCATION: process.env.GOOGLE_LOCATION,
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,

  // Document AI Configuration
  DOCUMENT_AI_PROCESSOR_ID: process.env.DOCUMENT_AI_PROCESSOR_ID,
  DOCUMENT_AI_LOCATION: process.env.DOCUMENT_AI_LOCATION,

  // Vertex AI Configuration
  VERTEX_AI_MODEL_NAME: process.env.VERTEX_AI_MODEL_NAME || 'gemini-1.5-pro-001',

  // Vertex AI Search Configuration
  VERTEX_AI_SEARCH_DATA_STORE_ID: process.env.VERTEX_AI_SEARCH_DATA_STORE_ID,
  VERTEX_AI_SEARCH_LOCATION: process.env.VERTEX_AI_SEARCH_LOCATION || 'global',

  DATABASE_URL: process.env.DATABASE_URL,
  // Add more as needed
};

export const createRedisClient = () => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return null;
};
