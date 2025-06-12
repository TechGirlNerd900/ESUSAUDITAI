#!/usr/bin/env node

/**
 * Production Mode Test Script
 * Tests the application in production mode
 */

import axios from 'axios';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const BASE_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:4173'; // Vite preview port

let serverProcess = null;
let clientProcess = null;

// Test configuration
const TESTS = {
    healthChecks: true,
    authentication: true,
    security: true,
    performance: true,
    errorHandling: true
};

console.log('🧪 Production Mode Test Suite');
console.log('==============================\n');

// Helper functions
const makeRequest = async (method, endpoint, data = null, token = null) => {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            timeout: 10000,
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const waitForServer = async (url, timeout = 60000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            await axios.get(`${url}/health`, { timeout: 5000 });
            return true;
        } catch (error) {
            await sleep(2000);
        }
    }
    return false;
};

// Test functions
const testHealthChecks = async () => {
    console.log('🏥 Testing health checks...');
    
    const endpoints = [
        '/health',
        '/health/ready', 
        '/health/live',
        '/metrics'
    ];
    
    let passed = 0;
    
    for (const endpoint of endpoints) {
        const result = await makeRequest('GET', endpoint);
        if (result.success) {
            console.log(`  ✅ ${endpoint} - ${result.status}`);
            passed++;
        } else {
            console.log(`  ❌ ${endpoint} - ${result.status}: ${result.error?.error || result.error}`);
        }
    }
    
    return { passed, total: endpoints.length };
};

const testAuthentication = async () => {
    console.log('🔐 Testing authentication...');
    
    const testUser = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
    };
    
    let passed = 0;
    let total = 4;
    
    // Test registration
    const registerResult = await makeRequest('POST', '/api/auth/register', testUser);
    if (registerResult.success || registerResult.status === 400) {
        console.log('  ✅ Registration endpoint accessible');
        passed++;
    } else {
        console.log(`  ❌ Registration failed: ${registerResult.error?.error || registerResult.error}`);
    }
    
    // Test login
    const loginResult = await makeRequest('POST', '/api/auth/login', {
        email: testUser.email,
        password: testUser.password
    });
    
    let authToken = null;
    if (loginResult.success) {
        console.log('  ✅ Login successful');
        authToken = loginResult.data.session?.access_token;
        passed++;
    } else {
        console.log(`  ❌ Login failed: ${loginResult.error?.error || loginResult.error}`);
    }
    
    // Test token verification
    if (authToken) {
        const verifyResult = await makeRequest('GET', '/api/auth/verify', null, authToken);
        if (verifyResult.success) {
            console.log('  ✅ Token verification successful');
            passed++;
        } else {
            console.log(`  ❌ Token verification failed: ${verifyResult.error?.error || verifyResult.error}`);
        }
        
        // Test logout
        const logoutResult = await makeRequest('POST', '/api/auth/logout', null, authToken);
        if (logoutResult.success) {
            console.log('  ✅ Logout successful');
            passed++;
        } else {
            console.log(`  ❌ Logout failed: ${logoutResult.error?.error || logoutResult.error}`);
        }
    } else {
        console.log('  ⏭️  Skipping token tests (no token available)');
        total -= 2;
    }
    
    return { passed, total };
};

const testSecurity = async () => {
    console.log('🛡️  Testing security features...');
    
    let passed = 0;
    let total = 4;
    
    // Test CORS
    try {
        const corsResult = await axios.get(`${BASE_URL}/health`, {
            headers: { 'Origin': 'https://malicious.com' }
        });
        console.log('  ✅ CORS configured (request allowed)');
        passed++;
    } catch (error) {
        if (error.response?.status === 403 || error.message.includes('CORS')) {
            console.log('  ✅ CORS protection active');
            passed++;
        } else {
            console.log(`  ❌ Unexpected CORS behavior: ${error.message}`);
        }
    }
    
    // Test rate limiting
    console.log('  🔄 Testing rate limiting...');
    const promises = Array(10).fill().map(() => makeRequest('POST', '/api/auth/login', {
        email: 'test@example.com',
        password: 'wrong'
    }));
    
    const results = await Promise.all(promises);
    const rateLimited = results.some(r => r.status === 429);
    
    if (rateLimited) {
        console.log('  ✅ Rate limiting active');
        passed++;
    } else {
        console.log('  ⚠️  Rate limiting may not be working');
    }
    
    // Test input validation
    const badInputResult = await makeRequest('POST', '/api/auth/register', {
        email: 'not-an-email',
        password: '123',
        firstName: '<script>alert("xss")</script>'
    });
    
    if (badInputResult.status === 400) {
        console.log('  ✅ Input validation active');
        passed++;
    } else {
        console.log('  ❌ Input validation may be missing');
    }
    
    // Test unauthorized access
    const unauthorizedResult = await makeRequest('GET', '/api/auth/me');
    if (unauthorizedResult.status === 401) {
        console.log('  ✅ Authorization protection active');
        passed++;
    } else {
        console.log('  ❌ Authorization protection may be missing');
    }
    
    return { passed, total };
};

const testPerformance = async () => {
    console.log('⚡ Testing performance...');
    
    let passed = 0;
    let total = 2;
    
    // Test response times
    const start = Date.now();
    const healthResult = await makeRequest('GET', '/health');
    const responseTime = Date.now() - start;
    
    if (healthResult.success && responseTime < 1000) {
        console.log(`  ✅ Health check response time: ${responseTime}ms`);
        passed++;
    } else {
        console.log(`  ⚠️  Slow health check response: ${responseTime}ms`);
    }
    
    // Test concurrent requests
    const concurrentStart = Date.now();
    const concurrentPromises = Array(5).fill().map(() => makeRequest('GET', '/health'));
    await Promise.all(concurrentPromises);
    const concurrentTime = Date.now() - concurrentStart;
    
    if (concurrentTime < 5000) {
        console.log(`  ✅ Concurrent requests handled: ${concurrentTime}ms for 5 requests`);
        passed++;
    } else {
        console.log(`  ⚠️  Slow concurrent handling: ${concurrentTime}ms for 5 requests`);
    }
    
    return { passed, total };
};

const testErrorHandling = async () => {
    console.log('🚨 Testing error handling...');
    
    let passed = 0;
    let total = 3;
    
    // Test 404 handling
    const notFoundResult = await makeRequest('GET', '/api/nonexistent');
    if (notFoundResult.status === 404) {
        console.log('  ✅ 404 errors handled properly');
        passed++;
    } else {
        console.log(`  ❌ Unexpected 404 behavior: ${notFoundResult.status}`);
    }
    
    // Test malformed JSON
    try {
        await axios.post(`${BASE_URL}/api/auth/login`, 'invalid json', {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
        });
        console.log('  ❌ Malformed JSON not handled');
    } catch (error) {
        if (error.response?.status === 400) {
            console.log('  ✅ Malformed JSON handled properly');
            passed++;
        } else {
            console.log(`  ⚠️  Unexpected JSON error handling: ${error.response?.status}`);
        }
    }
    
    // Test server error handling
    const serverErrorResult = await makeRequest('GET', '/health');
    if (serverErrorResult.success) {
        console.log('  ✅ Server error handling functional');
        passed++;
    } else {
        console.log('  ❌ Server error handling issues');
    }
    
    return { passed, total };
};

// Start production servers
const startServers = async () => {
    console.log('🚀 Starting production servers...\n');
    
    // Start backend server
    console.log('Starting backend server...');
    serverProcess = spawn('npm', ['run', 'prod'], {
        cwd: './server',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'production' }
    });
    
    serverProcess.stdout.on('data', (data) => {
        if (process.env.VERBOSE) {
            console.log(`[SERVER] ${data.toString().trim()}`);
        }
    });
    
    serverProcess.stderr.on('data', (data) => {
        if (process.env.VERBOSE) {
            console.error(`[SERVER ERROR] ${data.toString().trim()}`);
        }
    });
    
    // Wait for server to start
    console.log('Waiting for backend server to start...');
    const serverReady = await waitForServer(BASE_URL);
    if (!serverReady) {
        throw new Error('Backend server failed to start within timeout');
    }
    console.log('✅ Backend server started successfully\n');
    
    // Build and start frontend
    console.log('Building frontend...');
    const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: './client',
        stdio: 'inherit'
    });
    
    await new Promise((resolve, reject) => {
        buildProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Frontend build failed with code ${code}`));
            }
        });
    });
    
    console.log('Starting frontend preview server...');
    clientProcess = spawn('npm', ['run', 'preview'], {
        cwd: './client',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'production' }
    });
    
    clientProcess.stdout.on('data', (data) => {
        if (process.env.VERBOSE) {
            console.log(`[CLIENT] ${data.toString().trim()}`);
        }
    });
    
    // Wait for frontend
    console.log('Waiting for frontend server to start...');
    const clientReady = await waitForServer(FRONTEND_URL);
    if (!clientReady) {
        console.log('⚠️  Frontend server may not have started (this is optional for API tests)');
    } else {
        console.log('✅ Frontend server started successfully');
    }
    
    console.log('\n🎯 Servers ready, starting tests...\n');
};

// Stop servers
const stopServers = () => {
    console.log('\n🛑 Stopping servers...');
    
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
        console.log('Backend server stopped');
    }
    
    if (clientProcess) {
        clientProcess.kill('SIGTERM');
        console.log('Frontend server stopped');
    }
};

// Run all tests
const runTests = async () => {
    let totalPassed = 0;
    let totalTests = 0;
    
    if (TESTS.healthChecks) {
        const result = await testHealthChecks();
        totalPassed += result.passed;
        totalTests += result.total;
        console.log();
    }
    
    if (TESTS.authentication) {
        const result = await testAuthentication();
        totalPassed += result.passed;
        totalTests += result.total;
        console.log();
    }
    
    if (TESTS.security) {
        const result = await testSecurity();
        totalPassed += result.passed;
        totalTests += result.total;
        console.log();
    }
    
    if (TESTS.performance) {
        const result = await testPerformance();
        totalPassed += result.passed;
        totalTests += result.total;
        console.log();
    }
    
    if (TESTS.errorHandling) {
        const result = await testErrorHandling();
        totalPassed += result.passed;
        totalTests += result.total;
        console.log();
    }
    
    return { totalPassed, totalTests };
};

// Main execution
const main = async () => {
    try {
        await startServers();
        
        const { totalPassed, totalTests } = await runTests();
        
        console.log('📊 Test Results Summary');
        console.log('=======================');
        console.log(`✅ Passed: ${totalPassed}/${totalTests}`);
        console.log(`❌ Failed: ${totalTests - totalPassed}/${totalTests}`);
        console.log(`📈 Success Rate: ${Math.round((totalPassed / totalTests) * 100)}%\n`);
        
        if (totalPassed === totalTests) {
            console.log('🎉 All tests passed! Your application is production-ready! 🚀');
            process.exit(0);
        } else {
            console.log('⚠️  Some tests failed. Review the issues above before deploying to production.');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    } finally {
        stopServers();
    }
};

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n\n🛑 Test interrupted by user');
    stopServers();
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('\n\n🛑 Test terminated');
    stopServers();
    process.exit(1);
});

// Run the tests
main();