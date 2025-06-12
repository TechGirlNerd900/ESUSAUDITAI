#!/usr/bin/env node

/**
 * Auth System Test Script
 * Tests the authentication endpoints and flow
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';
const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    company: 'Test Company'
};

let authToken = null;

// Helper function to make requests
const makeRequest = async (method, endpoint, data = null, token = null) => {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            ...(data && { data })
        };
        
        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data || error.message,
            status: error.response?.status || 0
        };
    }
};

// Test functions
const testHealthCheck = async () => {
    console.log('\n🏥 Testing health check...');
    const result = await makeRequest('GET', '/../health');
    
    if (result.success) {
        console.log('✅ Health check passed:', result.data.status);
        return true;
    } else {
        console.log('❌ Health check failed:', result.error);
        return false;
    }
};

const testRegistration = async () => {
    console.log('\n📝 Testing user registration...');
    const result = await makeRequest('POST', '/auth/register', testUser);
    
    if (result.success) {
        console.log('✅ Registration successful');
        return true;
    } else {
        console.log('❌ Registration failed:', result.error);
        // If user already exists, that's okay for testing
        if (result.error?.error?.includes('already registered') || 
            result.error?.error?.includes('already exists') ||
            result.status === 400) {
            console.log('ℹ️  User already exists, proceeding to login...');
            return true;
        }
        return false;
    }
};

const testLogin = async () => {
    console.log('\n🔐 Testing user login...');
    const result = await makeRequest('POST', '/auth/login', {
        email: testUser.email,
        password: testUser.password
    });
    
    if (result.success) {
        console.log('✅ Login successful');
        authToken = result.data.session?.access_token;
        if (authToken) {
            console.log('✅ Access token received');
            return true;
        } else {
            console.log('❌ No access token in response');
            return false;
        }
    } else {
        console.log('❌ Login failed:', result.error);
        return false;
    }
};

const testTokenVerification = async () => {
    if (!authToken) {
        console.log('\n❌ No auth token available for verification');
        return false;
    }
    
    console.log('\n🔍 Testing token verification...');
    const result = await makeRequest('GET', '/auth/verify', null, authToken);
    
    if (result.success) {
        console.log('✅ Token verification successful');
        console.log('✅ User data retrieved:', result.data.user?.email);
        return true;
    } else {
        console.log('❌ Token verification failed:', result.error);
        return false;
    }
};

const testProtectedEndpoint = async () => {
    if (!authToken) {
        console.log('\n❌ No auth token available for protected endpoint test');
        return false;
    }
    
    console.log('\n🛡️  Testing protected endpoint...');
    const result = await makeRequest('GET', '/auth/me', null, authToken);
    
    if (result.success) {
        console.log('✅ Protected endpoint accessible');
        return true;
    } else {
        console.log('❌ Protected endpoint failed:', result.error);
        return false;
    }
};

const testLogout = async () => {
    if (!authToken) {
        console.log('\n❌ No auth token available for logout');
        return false;
    }
    
    console.log('\n🚪 Testing logout...');
    const result = await makeRequest('POST', '/auth/logout', null, authToken);
    
    if (result.success) {
        console.log('✅ Logout successful');
        return true;
    } else {
        console.log('❌ Logout failed:', result.error);
        return false;
    }
};

// Run all tests
const runTests = async () => {
    console.log('🧪 Starting Authentication System Tests');
    console.log('=====================================');
    
    const tests = [
        { name: 'Health Check', fn: testHealthCheck },
        { name: 'Registration', fn: testRegistration },
        { name: 'Login', fn: testLogin },
        { name: 'Token Verification', fn: testTokenVerification },
        { name: 'Protected Endpoint', fn: testProtectedEndpoint },
        { name: 'Logout', fn: testLogout }
    ];
    
    let passed = 0;
    let total = tests.length;
    
    for (const test of tests) {
        const result = await test.fn();
        if (result) passed++;
        
        // Wait a bit between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Test Results');
    console.log('================');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);
    
    if (passed === total) {
        console.log('\n🎉 All authentication tests passed!');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed. Check the logs above.');
        process.exit(1);
    }
};

// Handle errors and run tests
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
    process.exit(1);
});

// Check if server is running first
console.log('🔍 Checking if server is running...');
makeRequest('GET', '/../health').then(result => {
    if (result.success) {
        console.log('✅ Server is running, starting tests...');
        runTests();
    } else {
        console.log('❌ Server is not running. Please start the server first:');
        console.log('   cd server && npm run dev');
        process.exit(1);
    }
});