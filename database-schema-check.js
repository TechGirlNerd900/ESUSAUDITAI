#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.production' });

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Starting Supabase Database Schema Verification...');
console.log(`📍 Connecting to: ${process.env.SUPABASE_URL}`);

async function checkDatabaseSchema() {
    const report = {
        connectionStatus: 'unknown',
        tables: [],
        missingTables: [],
        rlsStatus: {},
        functions: [],
        triggers: [],
        extensions: [],
        healthCheck: false,
        errors: []
    };

    try {
        // 1. Test basic connection with health check
        console.log('\n📊 Testing database connection...');
        try {
            const { data: healthData, error: healthError } = await supabase
                .from('health_check')
                .select('*')
                .limit(1);
            
            if (healthError) {
                console.log('⚠️  health_check table not found or not accessible');
                report.healthCheck = false;
                report.errors.push(`Health check failed: ${healthError.message}`);
            } else {
                console.log('✅ health_check table exists and accessible');
                report.healthCheck = true;
            }
        } catch (e) {
            console.log('❌ Database connection failed:', e.message);
            report.errors.push(`Connection failed: ${e.message}`);
            return report;
        }

        report.connectionStatus = 'connected';

        // 2. List all tables in public schema using direct table queries
        console.log('\n📋 Checking public schema tables...');
        const expectedTables = [
            'users', 'projects', 'documents', 'analysis_results', 
            'chat_history', 'audit_reports', 'audit_logs', 
            'app_settings', 'health_check'
        ];

        for (const table of expectedTables) {
            try {
                const { data, error } = await supabase
                    .from(table)
                    .select('*')
                    .limit(0);
                
                if (!error) {
                    report.tables.push(table);
                    console.log(`✅ ${table} - exists and accessible`);
                } else {
                    report.missingTables.push(table);
                    console.log(`❌ ${table} - ${error.message}`);
                    report.errors.push(`${table}: ${error.message}`);
                }
            } catch (e) {
                report.missingTables.push(table);
                console.log(`❌ ${table} - exception: ${e.message}`);
                report.errors.push(`${table}: ${e.message}`);
            }
        }

        // 3. Check users table structure for auth_user_id
        console.log('\n👤 Checking users table structure...');
        try {
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('*')
                .limit(0);

            if (usersError) {
                console.log('❌ users table not accessible:', usersError.message);
                report.errors.push(`Users table error: ${usersError.message}`);
            } else {
                console.log('✅ users table is accessible');
                
                // Try to check for auth_user_id column by selecting it
                try {
                    const { data: testData, error: testError } = await supabase
                        .from('users')
                        .select('auth_user_id')
                        .limit(0);

                    if (!testError) {
                        console.log('✅ auth_user_id column found in users table');
                    } else {
                        console.log('⚠️  auth_user_id column NOT found in users table');
                    }
                } catch (e) {
                    console.log('⚠️  Could not check users table columns');
                }
            }
        } catch (e) {
            report.errors.push(`Users table check failed: ${e.message}`);
        }

        // 4. Check RLS status on key tables (simplified - just note that we can't check without RPC)
        console.log('\n🔒 Checking Row Level Security (RLS) status...');
        const keyTables = ['users', 'projects', 'documents', 'analysis_results', 'audit_logs'];
        
        console.log('⚠️  RLS status cannot be verified without administrative database access');
        for (const table of keyTables) {
            report.rlsStatus[table] = 'unknown';
            console.log(`⚠️  ${table} - RLS status requires admin access to verify`);
        }

        // 5. Check for custom functions - requires admin access
        console.log('\n⚙️  Checking custom functions...');
        console.log('⚠️  Function verification requires administrative database access');

        // 6. Check for triggers - requires admin access  
        console.log('\n🔔 Checking triggers...');
        console.log('⚠️  Trigger verification requires administrative database access');

        // 7. Check extensions - requires admin access
        console.log('\n🔧 Checking extensions...');
        console.log('⚠️  Extension verification requires administrative database access');

    } catch (error) {
        console.error('❌ Overall check failed:', error.message);
        report.errors.push(`Overall check failed: ${error.message}`);
    }

    return report;
}

// Expected schema comparison
function compareWithExpectedSchema(report) {
    console.log('\n📊 SCHEMA COMPARISON REPORT');
    console.log('=' .repeat(50));

    const expectedTables = [
        'users', 'projects', 'documents', 'analysis_results', 
        'chat_history', 'audit_reports', 'audit_logs', 
        'app_settings', 'health_check'
    ];

    const expectedFunctions = [
        'update_updated_at_column',
        'track_password_change',
        'handle_new_user',
        'handle_user_update',
        'ping_health_check',
        'update_health_check_timestamp'
    ];

    const expectedRLSTables = ['users', 'projects', 'documents', 'analysis_results', 'audit_logs'];

    // Table comparison
    console.log('\n📋 TABLE STATUS:');
    const missingTables = expectedTables.filter(table => !report.tables.includes(table));
    const extraTables = report.tables.filter(table => !expectedTables.includes(table));

    expectedTables.forEach(table => {
        const exists = report.tables.includes(table);
        console.log(`${exists ? '✅' : '❌'} ${table}`);
    });

    if (missingTables.length > 0) {
        console.log(`\n❌ Missing tables: ${missingTables.join(', ')}`);
    }

    if (extraTables.length > 0) {
        console.log(`\n📋 Extra tables: ${extraTables.join(', ')}`);
    }

    // RLS comparison
    console.log('\n🔒 ROW LEVEL SECURITY STATUS:');
    expectedRLSTables.forEach(table => {
        const rlsStatus = report.rlsStatus[table];
        const status = rlsStatus === true ? '✅ Enabled' : 
                      rlsStatus === false ? '❌ Disabled' : 
                      '⚠️  Unknown';
        console.log(`${table}: ${status}`);
    });

    // Function comparison
    console.log('\n⚙️  FUNCTION STATUS:');
    expectedFunctions.forEach(func => {
        const exists = report.functions.includes(func);
        console.log(`${exists ? '✅' : '❌'} ${func}`);
    });

    // Overall compatibility
    console.log('\n🎯 OVERALL COMPATIBILITY:');
    const tableScore = (report.tables.length - missingTables.length) / expectedTables.length * 100;
    const rlsScore = expectedRLSTables.filter(table => report.rlsStatus[table] === true).length / expectedRLSTables.length * 100;
    
    console.log(`Tables: ${tableScore.toFixed(1)}% (${report.tables.length - missingTables.length}/${expectedTables.length})`);
    console.log(`RLS Policies: ${rlsScore.toFixed(1)}% (${expectedRLSTables.filter(t => report.rlsStatus[t] === true).length}/${expectedRLSTables.length})`);
    
    const overallScore = (tableScore + rlsScore) / 2;
    console.log(`Overall Compatibility: ${overallScore.toFixed(1)}%`);

    if (report.errors.length > 0) {
        console.log('\n❌ ERRORS ENCOUNTERED:');
        report.errors.forEach(error => console.log(`- ${error}`));
    }

    return {
        tableScore,
        rlsScore,
        overallScore,
        missingTables,
        errors: report.errors
    };
}

// Run the check
async function main() {
    const report = await checkDatabaseSchema();
    const comparison = compareWithExpectedSchema(report);
    
    console.log('\n🏁 Schema verification completed!');
    
    if (comparison.overallScore < 80) {
        console.log('⚠️  Database schema needs attention. Please review the missing components above.');
        process.exit(1);
    } else {
        console.log('✅ Database schema is in good shape!');
        process.exit(0);
    }
}

main().catch(console.error);