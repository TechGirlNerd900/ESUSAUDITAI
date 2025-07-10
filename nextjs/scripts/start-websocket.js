#!/usr/bin/env node

/**
 * Optional WebSocket Server Starter
 * This script starts the WebSocket server only if needed and properly configured
 */

const { spawn } = require('child_process');
const path = require('path');

// Check if WebSocket is explicitly disabled
if (process.env.DISABLE_WEBSOCKET === 'true') {
  console.log('🔌 WebSocket server disabled by environment variable');
  process.exit(0);
}

// Check if we're in a production-like environment where WebSocket might be needed
const needsWebSocket = process.env.NODE_ENV === 'production' || 
                      process.env.ENABLE_WEBSOCKET === 'true' ||
                      process.env.WEBSOCKET_REQUIRED === 'true';

if (!needsWebSocket && process.env.NODE_ENV === 'development') {
  console.log('🔌 WebSocket server skipped in development (optional feature)');
  console.log('   To enable: set ENABLE_WEBSOCKET=true or use npm run dev:with-ws');
  process.exit(0);
}

console.log('🔌 Starting WebSocket server...');

// Start the WebSocket server
const serverPath = path.join(__dirname, '..', 'websocket', 'server.ts');
const ws = spawn('npx', ['tsx', serverPath], {
  stdio: 'inherit',
  env: process.env
});

ws.on('error', (error) => {
  console.error('❌ WebSocket server failed to start:', error.message);
  process.exit(1);
});

ws.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ WebSocket server exited with code ${code}`);
    process.exit(code);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔌 Shutting down WebSocket server...');
  ws.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🔌 Shutting down WebSocket server...');
  ws.kill('SIGTERM');
});