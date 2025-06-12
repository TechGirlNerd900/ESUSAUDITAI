const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');
const { AzureKeyCredential } = require('@azure/core-auth');


// Set production environment
process.env.NODE_ENV = 'production';
console.log('Running deployment in production mode');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../server/.env') }); // First try server/.env (primary)
dotenv.config({ path: path.join(__dirname, '../.env') }); // Then try root .env (fallback)

function validateEnvironment() {
    const requiredVars = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'AZURE_FORM_RECOGNIZER_KEY',
        'AZURE_FORM_RECOGNIZER_ENDPOINT',
        'AZURE_OPENAI_ENDPOINT',
        'AZURE_OPENAI_API_KEY',
        'AZURE_SEARCH_ENDPOINT',
        'AZURE_SEARCH_API_KEY',
        'APPINSIGHTS_INSTRUMENTATIONKEY'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
        console.error('Missing required environment variables:');
        missing.forEach(varName => console.error(`- ${varName}`));
        process.exit(1);
    }
}

function setupDatabase() {
    console.log('Setting up database...');
    try {
        // Run schema and migrations
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const migrationsPath = path.join(__dirname, '../database/migrations');
        
        console.log('Running schema...');
        execSync(`psql "${process.env.DATABASE_URL}" -f ${schemaPath}`);
        
        // Run all migrations in order
        const migrations = fs.readdirSync(migrationsPath)
            .filter(file => file.endsWith('.sql'))
            .sort();
            
        for (const migration of migrations) {
            console.log(`Running migration: ${migration}`);
            execSync(`psql "${process.env.DATABASE_URL}" -f ${path.join(migrationsPath, migration)}`);
        }
    } catch (error) {
        console.error('Database setup failed:', error);
        process.exit(1);
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
