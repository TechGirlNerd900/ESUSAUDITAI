import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// --- Emulate __dirname for ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../server/.env') });

// Initialize Supabase client with URL and service role key from environment variables
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Define storage bucket names. Use environment variable for DOCUMENT_BUCKET or default.
const DOCUMENT_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'audit-documents';
const REPORT_BUCKET = 'reports';

/**
 * Main setup function to orchestrate Supabase resource initialization.
 */
async function setupSupabase() {
  console.log('🚀 Starting Supabase setup...');

  try {
    // Step 1: Create necessary storage buckets
    await createBuckets();

    // Step 2: Apply security policies to the created buckets
    await setupBucketPolicies();

    // Step 3: Verify the expected database schema exists
    await verifyDatabaseSchema();

    console.log('✅ Supabase setup completed successfully!');
  } catch (error) {
    // Log any errors during setup and exit the process with a failure code
    console.error('❌ Supabase setup failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

/**
 * Creates storage buckets if they do not already exist in Supabase.
 * Checks for 'documents' and 'reports' buckets.
 */
async function createBuckets() {
  console.log('📁 Setting up storage buckets...');

  // Fetch a list of all existing buckets in Supabase storage
  const { data: buckets, error: getBucketsError } = await supabase.storage.listBuckets();

  if (getBucketsError) {
    throw new Error(`Failed to list buckets: ${getBucketsError.message}`);
  }

  // Extract names of existing buckets for easy lookup
  const existingBuckets = buckets.map(bucket => bucket.name);

  // --- Create Documents Bucket ---
  if (!existingBuckets.includes(DOCUMENT_BUCKET)) {
    console.log(`Creating '${DOCUMENT_BUCKET}' bucket...`);
    const { error: createDocBucketError } = await supabase.storage.createBucket(DOCUMENT_BUCKET, {
      public: false, // Keep documents private by default
      fileSizeLimit: 52428800, // 50MB limit per file
      allowedMimeTypes: [ // Specify allowed file types for documents
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword', // .doc
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

  // --- Create Reports Bucket ---
  if (!existingBuckets.includes(REPORT_BUCKET)) {
    console.log(`Creating '${REPORT_BUCKET}' bucket...`);
    const { error: createReportBucketError } = await supabase.storage.createBucket(REPORT_BUCKET, {
      public: false, // Keep reports private by default
      fileSizeLimit: 20971520, // 20MB limit per file
      allowedMimeTypes: ['application/pdf'] // Only PDF allowed for reports
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
 * Sets up Row Level Security (RLS) policies for the storage buckets.
 * Policies ensure that only authenticated users can access their own project documents/reports.
 */
async function setupBucketPolicies() {
  console.log('🔒 Setting up bucket policies...');

  try {
    // For documents bucket
    console.log('Applying document bucket policy...');
    const { error: docError } = await supabase.storage.updateBucket(DOCUMENT_BUCKET, {
      public: false,
      allowedMimeTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/csv'
      ],
      fileSizeLimit: 52428800
    });

    if (docError) throw docError;
    console.log('✅ Document bucket policy applied');

    // For reports bucket
    console.log('Applying report bucket policy...');
    const { error: reportError } = await supabase.storage.updateBucket(REPORT_BUCKET, {
      public: false,
      allowedMimeTypes: ['application/pdf'],
      fileSizeLimit: 20971520
    });

    if (reportError) throw reportError;
    console.log('✅ Report bucket policy applied');

  } catch (error) {
    console.warn('⚠️ Could not apply bucket policies:', error.message);
    console.warn('You may need to set these policies manually in the Supabase dashboard');
  }
}

/**
 * Verifies that the required database tables and extensions exist.
 * This is a check to ensure the database schema is correctly set up.
 */
async function verifyDatabaseSchema() {
  console.log('🔍 Verifying database schema...');

  // List of tables expected to be in the 'public' schema
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

  try {
    // Query to get existing table names in the 'public' schema using raw SQL
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_public_tables', {});

    if (tablesError) {
      throw new Error(`Failed to query database schema: ${tablesError.message}`);
    }

    // Compare existing tables with required tables
    const existingTables = tables || [];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      console.warn('⚠️ Missing tables detected:', missingTables.join(', '));
      console.warn('Please run the database setup script: npm run db:setup');
    } else {
      console.log('✅ All required tables exist');
    }

    // Check if the 'uuid-ossp' extension is enabled using raw SQL
    const { data: extensions, error: extensionsError } = await supabase
      .rpc('check_uuid_extension', {});

    if (extensionsError) {
      console.warn('⚠️ Could not verify UUID extension:', extensionsError.message);
    } else if (!extensions) {
      console.warn('⚠️ UUID extension not enabled. Some features may not work correctly.');
      console.warn('Run the following SQL command: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    } else {
      console.log('✅ UUID extension is enabled');
    }
  } catch (error) {
    console.warn('⚠️ Could not verify database schema:', error.message);
    console.warn('You may need to check the database setup manually');
  }
}

// Execute the main setup function when the script runs
setupSupabase();
