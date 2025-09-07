// Centralized environment variable loader for Next.js
// Add all required environment variables here and export them

import { Redis } from '@upstash/redis';

export const env = {
  NODE_ENV: process.env.NODE_ENV,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,

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
