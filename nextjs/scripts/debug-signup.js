#!/usr/bin/env node

/**
 * Debug Signup Process Script
 * Tests the signup process with various scenarios to identify issues
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function testSignupEndpoint() {
  console.log('🔍 Debugging Signup Process');
  console.log('='.repeat(50));

  // Test 1: Valid organization creation signup
  console.log('\n1. Testing valid organization creation signup...');
  const validOrgSignup = {
    email: 'test@example.com',
    password: 'TestPass123!',
    firstName: 'Test',
    lastName: 'User',
    organizationName: 'Test Organization',
    registrationType: 'create_org'
  };

  try {
    const response = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validOrgSignup)
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, data);
    
    if (response.ok) {
      console.log('✅ Organization creation signup works');
    } else {
      console.log('❌ Organization creation signup failed');
    }
  } catch (error) {
    console.log('❌ Connection error:', error.message);
    console.log('Make sure the dev server is running: npm run dev');
  }

  // Test 2: Invalid data scenarios
  console.log('\n2. Testing invalid data scenarios...');
  
  const invalidTests = [
    {
      name: 'Missing email',
      data: { password: 'TestPass123!', firstName: 'Test', lastName: 'User' }
    },
    {
      name: 'Invalid email format',
      data: { email: 'invalid-email', password: 'TestPass123!', firstName: 'Test', lastName: 'User' }
    },
    {
      name: 'Weak password',
      data: { email: 'test2@example.com', password: 'weak', firstName: 'Test', lastName: 'User' }
    },
    {
      name: 'Missing organization name for create_org',
      data: { 
        email: 'test3@example.com', 
        password: 'TestPass123!', 
        firstName: 'Test', 
        lastName: 'User',
        registrationType: 'create_org'
      }
    },
    {
      name: 'Missing invite token for join_invite',
      data: { 
        email: 'test4@example.com', 
        password: 'TestPass123!', 
        firstName: 'Test', 
        lastName: 'User',
        registrationType: 'join_invite'
      }
    }
  ];

  for (const test of invalidTests) {
    console.log(`\n  Testing: ${test.name}...`);
    try {
      const response = await fetch(`${BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(test.data)
      });

      const data = await response.json();
      console.log(`  Status: ${response.status}`);
      console.log(`  Error: ${data.error || 'No error message'}`);
      
      if (response.status === 400) {
        console.log('  ✅ Correctly rejected invalid data');
      } else {
        console.log('  ❌ Did not reject invalid data properly');
      }
    } catch (error) {
      console.log('  ❌ Connection error:', error.message);
    }
  }

  // Test 3: Database connection test
  console.log('\n3. Testing database connection...');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/debug`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, data);
    
    if (response.ok) {
      console.log('✅ Database connection works');
    } else {
      console.log('❌ Database connection issue');
    }
  } catch (error) {
    console.log('❌ Connection error:', error.message);
  }

  // Test 4: Environment variables check
  console.log('\n4. Checking environment variables...');
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar} is set`);
    } else {
      console.log(`❌ ${envVar} is missing`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Debug complete. Check the results above for issues.');
}

// Run the debug
testSignupEndpoint().catch(console.error);