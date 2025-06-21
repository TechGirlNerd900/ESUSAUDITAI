const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

// Set production environment
process.env.NODE_ENV = 'production';
console.log('🚀 Running Vercel deployment in production mode');

// Load environment variables from root directory
if (fs.existsSync(path.join(__dirname, '../.env.production'))) {
  dotenv.config({ path: path.join(__dirname, '../.env.production') });
  console.log('✅ Loaded .env.production');
} else if (fs.existsSync(path.join(__dirname, '../.env.local'))) {
  dotenv.config({ path: path.join(__dirname, '../.env.local') });
  console.log('✅ Loaded .env.local');
} else if (fs.existsSync(path.join(__dirname, '../.env'))) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
  console.log('✅ Loaded .env');
} else {
  console.log('⚠️  No local environment file found - using Vercel environment variables');
}

function validateEnvironment() {
    // Core required variables for Vercel deployment
    const requiredVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY'
    ];

    // Optional variables for enhanced features
    const optionalVars = [
        'UPSTASH_REDIS_REST_URL',
        'UPSTASH_REDIS_REST_TOKEN',
        'OPENAI_API_KEY'
    ];

    // Azure variables (only warn if missing since they may be disabled)
    const azureVars = [
        'AZURE_FORM_RECOGNIZER_KEY',
        'AZURE_FORM_RECOGNIZER_ENDPOINT',
        'AZURE_SEARCH_ENDPOINT',
        'AZURE_SEARCH_API_KEY'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(varName => console.error(`- ${varName}`));
        process.exit(1);
    }

    // Check optional variables
    const missingOptional = optionalVars.filter(varName => !process.env[varName]);
    if (missingOptional.length > 0) {
        console.warn('⚠️  Missing optional environment variables (some features may be disabled):');
        missingOptional.forEach(varName => console.warn(`- ${varName}`));
    }

    // Check Azure variables
    const missingAzure = azureVars.filter(varName => !process.env[varName]);
    if (missingAzure.length > 0) {
        console.warn('⚠️  Missing Azure environment variables (Azure features will be disabled):');
        missingAzure.forEach(varName => console.warn(`- ${varName}`));
    }

    console.log('✅ Environment validation completed');
}

function setupDatabase() {
    console.log('📊 Setting up Supabase database...');
    try {
        // For Vercel deployment, database setup should be done via Supabase migrations
        // Check if we have Supabase CLI available
        try {
            execSync('supabase --version', { stdio: 'ignore' });
            console.log('✅ Supabase CLI found');
            
            // Run Supabase migrations
            console.log('Running Supabase migrations...');
            execSync('supabase db push', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
            
            console.log('✅ Database migrations completed');
        } catch (cliError) {
            console.warn('⚠️  Supabase CLI not available. Database setup should be done manually via Supabase dashboard.');
            console.warn('   - Upload migrations from database/supabase/migrations/ folder');
            console.warn('   - Or run migrations locally with: supabase db push');
        }
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        console.log('💡 For Vercel deployment, ensure database is set up via:');
        console.log('   1. Supabase dashboard (recommended)');
        console.log('   2. Local supabase CLI: supabase db push');
        console.log('   3. Manual SQL execution in Supabase SQL editor');
    }
}

function setupSupabaseStorage() {
    console.log('Setting up Supabase storage...');
    try {
        require('./supabase-setup');
    } catch (error) {
        console.error('Supabase storage setup failed:', error);
        process.exit(1);
    }
}

function setupSearchIndex() {
    console.log('Setting up Azure Search index...');
    try {
        const { SearchIndexClient, AzureKeyCredential } = require('@azure/search-documents');
        
        const client = new SearchIndexClient(
            process.env.AZURE_SEARCH_ENDPOINT,
            new AzureKeyCredential(process.env.AZURE_SEARCH_API_KEY)
        );

        const indexDefinition = {
            name: process.env.AZURE_SEARCH_INDEX_NAME,
            fields: [
                {
                    name: 'id',
                    type: 'Edm.String',
                    key: true,
                    searchable: false
                },
                {
                    name: 'content',
                    type: 'Edm.String',
                    searchable: true,
                    filterable: false,
                    sortable: false,
                    facetable: false
                },
                {
                    name: 'metadata',
                    type: 'Edm.String',
                    searchable: true,
                    filterable: true,
                    sortable: false,
                    facetable: false
                },
                {
                    name: 'timestamp',
                    type: 'Edm.DateTimeOffset',
                    searchable: false,
                    filterable: true,
                    sortable: true,
                    facetable: false
                }
            ]
        };

        return client.createIndex(indexDefinition);
    } catch (error) {
        console.error('Search index setup failed:', error);
        process.exit(1);
    }
}

async function main() {
    console.log('Starting deployment process...');
    
    // Validate environment
    validateEnvironment();
    
    // Setup steps
    await setupDatabase();
    await setupSupabaseStorage();
    await setupSearchIndex();
    
    console.log('Deployment setup completed successfully!');
}

// Run deployment
main().catch(error => {
    console.error('Deployment failed:', error);
    process.exit(1);
});
