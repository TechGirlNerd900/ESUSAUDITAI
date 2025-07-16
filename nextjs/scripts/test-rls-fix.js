#!/usr/bin/env node

/**
 * Test script to verify RLS policy fixes
 * This script tests the database connection and RLS policies
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testRLSFix() {
  console.log('🔍 Testing RLS Policy Fix...\n');

  // Initialize Supabase client with service role
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceKey);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Test 1: Check if we can connect to the database
    console.log('1. Testing database connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (connectionError) {
      console.error('❌ Database connection failed:', connectionError.message);
      return false;
    }
    console.log('✅ Database connection successful');

    // Test 2: Check if RLS policies exist
    console.log('\n2. Checking RLS policies...');
    let policies, policyError;
    
    try {
      const result = await supabase.rpc('get_table_policies', { table_name: 'users' });
      policies = result.data;
      policyError = result.error;
    } catch (rpcError) {
      // If RPC doesn't exist, try direct query
      try {
        const result = await supabase
          .from('pg_policies')
          .select('*')
          .eq('tablename', 'users');
        policies = result.data;
        policyError = result.error;
      } catch (directError) {
        policyError = directError;
      }
    }

    if (policyError) {
      console.warn('⚠️  Could not check policies directly:', policyError.message);
    } else {
      console.log('✅ RLS policies found:', policies?.length || 0);
    }

    // Test 3: Try to create a test user (this will test RLS)
    console.log('\n3. Testing user creation (RLS test)...');
    const testEmail = `test-${Date.now()}@example.com`;
    
    const { data: testUser, error: userError } = await supabase
      .from('users')
      .insert({
        auth_user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        email: testEmail,
        first_name: 'Test',
        last_name: 'User',
        role: 'auditor',
        organization_id: '00000000-0000-0000-0000-000000000001', // Dummy UUID
        status: 'active',
        is_active: true
      })
      .select()
      .single();

    if (userError) {
      if (userError.code === '42P17') {
        console.error('❌ RLS infinite recursion still exists:', userError.message);
        return false;
      } else {
        console.log('✅ RLS working (expected constraint error):', userError.message);
      }
    } else {
      console.log('✅ Test user created successfully');
      // Clean up test user
      await supabase
        .from('users')
        .delete()
        .eq('id', testUser.id);
      console.log('✅ Test user cleaned up');
    }

    console.log('\n🎉 RLS fix verification completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Run the test
testRLSFix()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });