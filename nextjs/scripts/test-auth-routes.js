#!/usr/bin/env node

/**
 * Auth Routes Test Script
 * 
 * This script tests the authentication routes to ensure they're working correctly.
 * Run with: node scripts/test-auth-routes.js
 * 
 * Make sure your development server is running on http://localhost:3000
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function testRoute(path, method = 'GET', body = null, headers = {}) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.text();
    
    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch {
      parsedData = data;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      data: parsedData,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return {
      error: error.message,
      status: 0
    };
  }
}

async function runTests() {
  console.log('🧪 Testing EsusAuditAI Authentication Routes');
  console.log('=' .repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  const tests = [
    {
      name: 'Debug Route (GET)',
      path: '/api/auth/debug',
      method: 'GET',
      expectedStatus: [200, 401] // Could be either depending on auth state
    },
    {
      name: 'Profile Route (GET) - Should require auth',
      path: '/api/auth/profile',
      method: 'GET',
      expectedStatus: [401] // Should be unauthorized without auth
    },
    {
      name: 'Login Route (POST) - Invalid data',
      path: '/api/auth/login',
      method: 'POST',
      body: { email: 'invalid', password: '' },
      expectedStatus: [400]
    },
    {
      name: 'Reset Password Route (POST) - Invalid email',
      path: '/api/auth/reset-password',
      method: 'POST',
      body: { email: 'invalid-email' },
      expectedStatus: [400]
    },
    {
      name: 'Signup Route (POST) - Missing data',
      path: '/api/auth/signup',
      method: 'POST',
      body: { email: 'test@example.com' },
      expectedStatus: [400]
    },
    {
      name: 'Update Password Route (POST) - No auth',
      path: '/api/auth/update-password',
      method: 'POST',
      body: { password: 'newpassword' },
      expectedStatus: [401]
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`Testing: ${test.name}`);
    
    const result = await testRoute(
      test.path, 
      test.method, 
      test.body
    );

    const statusMatch = test.expectedStatus.includes(result.status);
    const success = statusMatch && !result.error;

    if (success) {
      console.log(`✅ PASS - Status: ${result.status}`);
      passed++;
    } else {
      console.log(`❌ FAIL - Status: ${result.status}, Expected: ${test.expectedStatus.join(' or ')}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.data && typeof result.data === 'object' && result.data.error) {
        console.log(`   Response: ${result.data.error}`);
      }
      failed++;
    }
    console.log('');
  }

  console.log('=' .repeat(50));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All auth routes are responding correctly!');
  } else {
    console.log('⚠️  Some routes may need attention. Check the failures above.');
  }

  console.log('');
  console.log('📝 Notes:');
  console.log('- Routes returning 401 (Unauthorized) are working correctly when not authenticated');
  console.log('- Routes returning 400 (Bad Request) for invalid data are working correctly');
  console.log('- To test successful authentication, use the frontend login form');
  console.log('- Check the AUTH_ROUTES_SUMMARY.md for complete documentation');
}

// Run the tests
runTests().catch(console.error);