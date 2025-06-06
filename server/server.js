/**
 * Esus Audit AI - Express Server
 * 
 * This is the main entry point for the Express application.
 */

const { app } = require('./app');
const { applicationInsights } = require('./shared/logging');
const { setupUncaughtHandlers } = require('./utils/errorHandler');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './.env' }); // First try server/.env
dotenv.config({ path: '../.env' }); // Fallback to root .env

// Set up global error handlers
setupUncaughtHandlers();

// Initialize server
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
    applicationInsights.trackEvent({
        name: 'ServerStarted',
        properties: {
            port,
            nodeVersion: process.version,
            environment: process.env.NODE_ENV
        }
    });
    console.log(`Server running on port ${port} in ${process.env.NODE_ENV} mode`);
});

// Handle graceful shutdown
function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    // Track shutdown event
    applicationInsights.trackEvent({
        name: 'ServerShutdown',
        properties: {
            signal,
            timestamp: new Date().toISOString()
        }
    });

    server.close(async () => {
        console.log('HTTP server closed');
        
        try {
            // Allow time for final Application Insights telemetry to be sent
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Exit process
            process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    });

    // Force shutdown after timeout
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000); // 30 second timeout
}

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;