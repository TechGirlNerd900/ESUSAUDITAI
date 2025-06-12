/**
 * Esus Audit AI - Express Server
 * 
 * This is the main entry point for the Express application.
 */

// Load environment variables first, before any imports
import dotenv from 'dotenv';

// Load environment variables - server/.env is primary, root .env is fallback
dotenv.config(); // First try server/.env (primary - in current directory)
dotenv.config({ path: '../.env' }); // Then try root .env (fallback)

import app from './app.js';
import { applicationInsights } from './shared/logging.js';
import { setupUncaughtHandlers } from './utils/errorHandler.js';
import logger, { replaceConsoleInProduction } from './shared/logger.js';
import { initializeConfig } from './utils/configManager.js';

// Replace console methods in production
replaceConsoleInProduction();

// NODE_ENV is set via package.json scripts
logger.info(`Loading application in ${process.env.NODE_ENV || 'development'} mode`);

// Set up global error handlers
setupUncaughtHandlers();

// Initialize configuration manager
await initializeConfig();

// Initialize server
const port = process.env.PORT || 3001;
const server = app.listen(port, () => {
    applicationInsights.trackEvent({
        name: 'ServerStarted',
        properties: {
            port,
            nodeVersion: process.version,
            environment: process.env.NODE_ENV
        }
    });
    logger.info(`Server running on port ${port} in ${process.env.NODE_ENV} mode`, {
        port,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV
    });
});

// Handle graceful shutdown
function gracefulShutdown(signal) {
    logger.warn(`${signal} received. Starting graceful shutdown...`, { signal });
    
    // Track shutdown event
    applicationInsights.trackEvent({
        name: 'ServerShutdown',
        properties: {
            signal,
            timestamp: new Date().toISOString()
        }
    });

    server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
            // Allow time for final Application Insights telemetry to be sent
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Exit process
            process.exit(0);
        } catch (error) {
            logger.error('Error during shutdown', { error });
            process.exit(1);
        }
    });

    // Force shutdown after timeout
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000); // 30 second timeout
}

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default server;
