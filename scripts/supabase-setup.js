/**
 * Supabase Setup Script
 * 
 * This script initializes Supabase resources:
 * 1. Creates storage buckets for documents and reports
 * 2. Sets up bucket policies
 * 3. Verifies database schema
 * 
 * Usage: node scripts/supabase-setup.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
// Load from config directory
dotenv.config({ path: path.join(__dirname, '../config/dev.env') });
dotenv.config({ path: path.join(__dirname, '../config/prod.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Storage bucket names
const DOCUMENT_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'documents';
const REPORT_BUCKET = 'reports';

/**
 * Main setup function
 */
async function setupSupabase() {
  console.log('🚀 Starting Supabase setup...');
  
  try {
    // Create storage buckets
    await createBuckets();
    
    // Set up bucket policies
    await setupBucketPolicies();
    
    // Verify database schema
    await verifyDatabaseSchema();
    
    console.log('✅ Supabase setup completed successfully!');
  } catch (error) {
    console.error('❌ Supabase setup failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

/**
 * Create storage buckets if they don't exist
 */
async function createBuckets() {
  console.log('📁 Setting up storage buckets...');
  
  // Get existing buckets
  const { data: buckets, error: getBucketsError } = await supabase.storage.listBuckets();
  
  if (getBucketsError) {
    throw new Error(`Failed to list buckets: ${getBucketsError.message}`);
  }
  
  const existingBuckets = buckets.map(bucket => bucket.name);
  
  // Create documents bucket if it doesn't exist
  if (!existingBuckets.includes(DOCUMENT_BUCKET)) {
    console.log(`Creating '${DOCUMENT_BUCKET}' bucket...`);
    const { error: createDocBucketError } = await supabase.storage.createBucket(DOCUMENT_BUCKET, {
      public: false,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/csv'
      ]
    });
    
    if (createDocBucketError) {
      throw new Error(`Failed to create documents bucket: ${createDocBucketError.message}`);
    }
    console.log(`✅ '${DOCUMENT_BUCKET}' bucket created successfully`);
  } else {
    console.log(`✅ '${DOCUMENT_BUCKET}' bucket already exists`);
  }
  
  // Create reports bucket if it doesn't exist
  if (!existingBuckets.includes(REPORT_BUCKET)) {
    console.log(`Creating '${REPORT_BUCKET}' bucket...`);
    const { error: createReportBucketError } = await supabase.storage.createBucket(REPORT_BUCKET, {
      public: false,
      fileSizeLimit: 20971520, // 20MB
      allowedMimeTypes: ['application/pdf']
    });
    
    if (createReportBucketError) {
      throw new Error(`Failed to create reports bucket: ${createReportBucketError.message}`);
    }
    console.log(`✅ '${REPORT_BUCKET}' bucket created successfully`);
  } else {
    console.log(`✅ '${REPORT_BUCKET}' bucket already exists`);
  }
}

/**
 * Set up bucket policies
 */
async function setupBucketPolicies() {
  console.log('🔒 Setting up bucket policies...');
  
  // Documents bucket policy - only authenticated users can access their project documents
  const documentPolicy = {
    name: 'Authenticated users can access their project documents',
    definition: {
      type: 'storage',
      match: {
        bucket: DOCUMENT_BUCKET,
        owner: 'authenticated'
      },
      statements: [
        {
          effect: 'allow',
          action: 'select',
          condition: {
            user_id: '$.auth.uid'
          }
        }
      ]
    }
  };
  
  // Reports bucket policy - only authenticated users can access their project reports
  const reportPolicy = {
    name: 'Authenticated users can access their project reports',
    definition: {
      type: 'storage',
      match: {
        bucket: REPORT_BUCKET,
        owner: 'authenticated'
      },
      statements: [
        {
          effect: 'allow',
          action: 'select',
          condition: {
            user_id: '$.auth.uid'
          }
        }
      ]
    }
  };
  
  // Apply policies
  try {
    console.log('Applying document bucket policy...');
    await supabase.storage.from(DOCUMENT_BUCKET).updateBucketPolicy(documentPolicy);
    console.log('✅ Document bucket policy applied');
    
    console.log('Applying report bucket policy...');
    await supabase.storage.from(REPORT_BUCKET).updateBucketPolicy(reportPolicy);
    console.log('✅ Report bucket policy applied');
  } catch (error) {
    console.warn('⚠️ Could not apply bucket policies:', error.message);
    console.warn('You may need to set these policies manually in the Supabase dashboard');
  }
}

/**
 * Verify database schema
 */
async function verifyDatabaseSchema() {
  console.log('🔍 Verifying database schema...');
  
  // Check if required tables exist
  const requiredTables = [
    'users',
    'projects',
    'documents',
    'analysis_results',
    'chat_history',
    'audit_reports',
    'audit_logs',
    'app_settings'
  ];
  
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
  
  if (tablesError) {
    throw new Error(`Failed to query database schema: ${tablesError.message}`);
  }
  
  const existingTables = tables.map(t => t.table_name);
  const missingTables = requiredTables.filter(t => !existingTables.includes(t));
  
  if (missingTables.length > 0) {
    console.warn('⚠️ Missing tables detected:', missingTables.join(', '));
    console.warn('Please run the database setup script: npm run db:setup');
  } else {
    console.log('✅ All required tables exist');
  }
  
  // Check if UUID extension is enabled
  const { data: extensions, error: extensionsError } = await supabase
    .from('pg_extension')
    .select('extname')
    .eq('extname', 'uuid-ossp');
  
  if (extensionsError) {
    console.warn('⚠️ Could not verify UUID extension:', extensionsError.message);
  } else if (!extensions || extensions.length === 0) {
    console.warn('⚠️ UUID extension not enabled. Some features may not work correctly.');
    console.warn('Run the following SQL command: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  } else {
    console.log('✅ UUID extension is enabled');
  }
}

// Run the setup
setupSupabase();
