#!/usr/bin/env node

/**
 * Environment Validation Script - Critical Security Fix
 * Validates all required environment variables before deployment
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env files
config({ path: ['.env.local', '.env'] });

// Define all required environment variables with their validation rules
const REQUIRED_ENV_VARS = {
  // Database Configuration
  NEXT_PUBLIC_SUPABASE_URL: {
    required: true,
    pattern: /^https:\/\/[a-z0-9-]+\.supabase\.co$/,
    description: 'Supabase project URL'
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    required: true,
    pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    description: 'Supabase service role JWT token',
    sensitive: true
  },

  // Security Keys
  CSRF_SECRET: {
    required: true,
    minLength: 32,
    description: 'CSRF protection secret key',
    sensitive: true
  },
  ENCRYPTION_KEY: {
    required: true,
    minLength: 32,
    description: 'Data encryption key',
    sensitive: true
  },
  JWT_SECRET: {
    required: true,
    minLength: 16,
    description: 'JWT signing secret',
    sensitive: true
  },

  // Azure AI Services (Optional but recommended)
  AZURE_OPENAI_ENDPOINT: {
    required: false,
    pattern: /^https:\/\/[a-z0-9-]+\.openai\.azure\.com\/$/,
    description: 'Azure OpenAI service endpoint'
  },
  AZURE_OPENAI_API_KEY: {
    required: false,
    minLength: 20,
    description: 'Azure OpenAI API key',
    sensitive: true
  },
  AZURE_FORM_RECOGNIZER_ENDPOINT: {
    required: false,
    pattern: /^https:\/\/[a-z0-9-]+\.cognitiveservices\.azure\.com\/$/,
    description: 'Azure Form Recognizer endpoint'
  },
  AZURE_FORM_RECOGNIZER_KEY: {
    required: false,
    minLength: 20,
    description: 'Azure Form Recognizer API key',
    sensitive: true
  },

  // Redis Configuration (Optional)
  UPSTASH_REDIS_REST_URL: {
    required: false,
    pattern: /^https:\/\/[a-z0-9-]+\.upstash\.io$/,
    description: 'Upstash Redis REST URL'
  },
  UPSTASH_REDIS_REST_TOKEN: {
    required: false,
    minLength: 20,
    description: 'Upstash Redis REST token',
    sensitive: true
  },

  // Application Configuration
  NODE_ENV: {
    required: true,
    enum: ['development', 'production', 'test'],
    description: 'Node.js environment'
  },
  NEXTAUTH_URL: {
    required: true,
    pattern: /^https?:\/\/.+/,
    description: 'Application base URL'
  }
};

// Optional environment variables
const OPTIONAL_ENV_VARS = {
  NEWS_API_TOKEN: {
    required: false,
    minLength: 10,
    description: 'News API token for external data',
    sensitive: true
  },
  WEBHOOK_SECRET: {
    required: false,
    minLength: 16,
    description: 'Webhook signature verification secret',
    sensitive: true
  }
};

class EnvironmentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.validVars = [];
    this.missingVars = [];
  }

  /**
   * Validate a single environment variable
   */
  validateVariable(name, config, value) {
    if (!value) {
      if (config.required) {
        this.errors.push(`Missing required environment variable: ${name} (${config.description})`);
        this.missingVars.push(name);
      } else {
        this.warnings.push(`Optional environment variable not set: ${name} (${config.description})`);
      }
      return false;
    }

    // Check minimum length
    if (config.minLength && value.length < config.minLength) {
      this.errors.push(`${name} must be at least ${config.minLength} characters long`);
      return false;
    }

    // Check pattern
    if (config.pattern && !config.pattern.test(value)) {
      this.errors.push(`${name} does not match required format: ${config.description}`);
      return false;
    }

    // Check enum values
    if (config.enum && !config.enum.includes(value)) {
      this.errors.push(`${name} must be one of: ${config.enum.join(', ')}`);
      return false;
    }

    // Additional security checks
    if (config.sensitive) {
      // Check for common insecure values
      const insecureValues = [
        'test', 'demo', 'example', 'placeholder', 'changeme', 
        'password', '123456', 'secret', 'default'
      ];
      
      if (insecureValues.some(insecure => value.toLowerCase().includes(insecure))) {
        this.warnings.push(`${name} appears to contain placeholder or insecure values`);
      }

      // Check for development keys in production
      if (process.env.NODE_ENV === 'production' && value.includes('dev_')) {
        this.errors.push(`${name} contains development key in production environment`);
        return false;
      }
    }

    this.validVars.push(name);
    return true;
  }

  /**
   * Validate all environment variables
   */
  validateAll() {
    console.log('🔍 ESUS Audit AI - Environment Validation');
    console.log('=========================================');
    console.log('');

    // Validate required variables
    Object.entries(REQUIRED_ENV_VARS).forEach(([name, config]) => {
      this.validateVariable(name, config, process.env[name]);
    });

    // Validate optional variables
    Object.entries(OPTIONAL_ENV_VARS).forEach(([name, config]) => {
      this.validateVariable(name, config, process.env[name]);
    });

    // Check for .env files in production
    if (process.env.NODE_ENV === 'production') {
      const dangerousFiles = ['.env.local', '.env.production', '.env'];
      dangerousFiles.forEach(file => {
        if (fs.existsSync(file)) {
          this.warnings.push(`Found ${file} file in production - ensure secrets are managed securely`);
        }
      });
    }

    return this.generateReport();
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const isValid = this.errors.length === 0;

    console.log(`✅ Valid Variables: ${this.validVars.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log('');

    if (this.errors.length > 0) {
      console.log('🚨 ERRORS (Must be fixed):');
      console.log('==========================');
      this.errors.forEach(error => console.log(`  ❌ ${error}`));
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS (Recommended to fix):');
      console.log('==================================');
      this.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
      console.log('');
    }

    if (this.missingVars.length > 0) {
      console.log('📋 Missing Required Variables:');
      console.log('==============================');
      this.missingVars.forEach(varName => {
        const config = REQUIRED_ENV_VARS[varName];
        console.log(`  • ${varName}: ${config.description}`);
      });
      console.log('');
    }

    if (isValid) {
      console.log('✅ Environment validation passed!');
      console.log('');
      console.log('🚀 Your application is ready for deployment.');
    } else {
      console.log('❌ Environment validation failed!');
      console.log('');
      console.log('🔧 Please fix the errors above before deploying.');
      console.log('');
      console.log('💡 Quick fixes:');
      console.log('  1. Check your .env.local file');
      console.log('  2. Verify all API keys are correctly set');
      console.log('  3. Run: node scripts/generate-security-keys.js');
      console.log('  4. Ensure production secrets are configured in your deployment platform');
    }

    return {
      isValid,
      errors: this.errors,
      warnings: this.warnings,
      validVars: this.validVars,
      missingVars: this.missingVars
    };
  }

  /**
   * Generate environment template
   */
  generateTemplate() {
    const template = [];
    template.push('# ESUS Audit AI - Environment Configuration Template');
    template.push('# Generated by environment validator');
    template.push('');

    template.push('# Required Variables');
    template.push('# ==================');
    Object.entries(REQUIRED_ENV_VARS).forEach(([name, config]) => {
      template.push(`# ${config.description}`);
      if (config.sensitive) {
        template.push(`${name}=your-${name.toLowerCase().replace(/_/g, '-')}-here`);
      } else if (config.enum) {
        template.push(`${name}=${config.enum[0]}`);
      } else {
        template.push(`${name}=`);
      }
      template.push('');
    });

    template.push('# Optional Variables');
    template.push('# ==================');
    Object.entries(OPTIONAL_ENV_VARS).forEach(([name, config]) => {
      template.push(`# ${config.description}`);
      template.push(`# ${name}=`);
      template.push('');
    });

    return template.join('\n');
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new EnvironmentValidator();
  const result = validator.validateAll();

  // Write template if requested
  if (process.argv.includes('--template')) {
    const template = validator.generateTemplate();
    fs.writeFileSync('.env.template', template);
    console.log('📄 Generated .env.template file');
  }

  // Exit with appropriate code
  process.exit(result.isValid ? 0 : 1);
}

export { EnvironmentValidator };