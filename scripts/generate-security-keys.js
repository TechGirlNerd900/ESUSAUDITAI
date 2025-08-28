#!/usr/bin/env node

/**
 * Security Key Generator - Critical Security Fix
 * Generates cryptographically strong keys to replace weak development secrets
 */

import crypto from 'crypto';
import fs from 'fs';

function generateSecureKey(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

function generateBase64Key(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

function generateJWTSecret() {
  // Generate a 256-bit (32 byte) key for JWT signing
  return crypto.randomBytes(32).toString('base64');
}

console.log('🔐 ESUS AUDIT AI - Security Key Generator');
console.log('=========================================');
console.log('');
console.log('⚠️  CRITICAL: Store these keys securely and never commit them to version control!');
console.log('');

// Generate all required security keys
const keys = {
  CSRF_SECRET: generateSecureKey(32),
  ENCRYPTION_KEY: generateSecureKey(32), 
  JWT_SECRET: generateJWTSecret(),
  SESSION_SECRET: generateSecureKey(64),
  API_SECRET_KEY: generateSecureKey(48),
  WEBHOOK_SECRET: generateSecureKey(32)
};

console.log('🔑 Generated Security Keys:');
console.log('==========================');
console.log('');

Object.entries(keys).forEach(([name, value]) => {
  console.log(`${name}=${value}`);
});

console.log('');
console.log('📋 Deployment Instructions:');
console.log('===========================');
console.log('');
console.log('1. For Vercel deployment:');
console.log('   - Go to your Vercel project dashboard');
console.log('   - Navigate to Settings > Environment Variables');
console.log('   - Add each key as a new environment variable');
console.log('');
console.log('2. For local development:');
console.log('   - Create .env.local with these values');
console.log('   - NEVER commit .env.local to version control');
console.log('   - Add .env.local to your .gitignore file');
console.log('');
console.log('3. For production servers:');
console.log('   - Use your server\'s secret management system');
console.log('   - Consider using Azure Key Vault, AWS Secrets Manager, etc.');
console.log('');

// Generate a sample .env.local template
const envTemplate = `
# =============================================================================
# ESUS AUDIT AI - Environment Configuration Template
# Generated on: ${new Date().toISOString()}
# =============================================================================

# CRITICAL: Replace ALL placeholder values with your actual secrets
# NEVER commit this file to version control

# Database Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Security Keys (GENERATED - Use the values above)
CSRF_SECRET=${keys.CSRF_SECRET}
ENCRYPTION_KEY=${keys.ENCRYPTION_KEY}
JWT_SECRET=${keys.JWT_SECRET}
SESSION_SECRET=${keys.SESSION_SECRET}
API_SECRET_KEY=${keys.API_SECRET_KEY}

# Azure AI Services
AZURE_OPENAI_ENDPOINT=your-azure-openai-endpoint
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_FORM_RECOGNIZER_ENDPOINT=your-form-recognizer-endpoint
AZURE_FORM_RECOGNIZER_KEY=your-form-recognizer-key
AZURE_SEARCH_ENDPOINT=your-search-endpoint
AZURE_SEARCH_API_KEY=your-search-key

# Redis Configuration
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Application Configuration
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
WEBHOOK_SECRET=${keys.WEBHOOK_SECRET}

# Optional Services
NEWS_API_TOKEN=your-news-api-token

# =============================================================================
# Security Notes:
# - All keys above are generated using cryptographically secure methods
# - Replace placeholder URLs and tokens with your actual service credentials
# - Rotate these keys periodically for enhanced security
# - Monitor your services for any unauthorized access
# =============================================================================
`;

// Write the template to a file
fs.writeFileSync('.env.template', envTemplate.trim());

console.log('📄 Created .env.template file with secure configuration');
console.log('');
console.log('🚨 IMMEDIATE ACTIONS REQUIRED:');
console.log('==============================');
console.log('');
console.log('1. ROTATE ALL EXPOSED API KEYS in your external services:');
console.log('   - Supabase: Generate new service role key');
console.log('   - Azure: Regenerate all API keys');
console.log('   - Upstash: Generate new Redis token');
console.log('   - News API: Generate new token');
console.log('');
console.log('2. Remove existing .env.local files from repository');
console.log('3. Configure new secrets in your deployment environment');
console.log('4. Test all external service connections');
console.log('');
console.log('✅ Security keys generated successfully!');