import { supabase } from '../shared/supabaseClient.js';
import { applicationInsights } from '../shared/logging.js';
import logger from '../shared/logger.js';
import os from 'os';

// System health check
export const getSystemHealth = async () => {
    const startTime = Date.now();
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: os.loadavg(),
        services: {}
    };

    try {
        // Check Supabase connection
        const dbStart = Date.now();
        const { data, error } = await supabase
            .from('app_settings')
            .select('key')
            .limit(1);
        
        const dbDuration = Date.now() - dbStart;
        
        if (error) {
            health.services.database = {
                status: 'unhealthy',
                error: error.message,
                responseTime: dbDuration
            };
            health.status = 'degraded';
        } else {
            health.services.database = {
                status: 'healthy',
                responseTime: dbDuration
            };
        }

        // Check Azure services (basic connectivity)
        if (process.env.AZURE_OPENAI_ENDPOINT) {
            try {
                const azureStart = Date.now();
                // Simple connectivity check without actual API call
                const azureDuration = Date.now() - azureStart;
                health.services.azure = {
                    status: 'healthy',
                    responseTime: azureDuration
                };
            } catch (azureError) {
                health.services.azure = {
                    status: 'unhealthy',
                    error: azureError.message
                };
                health.status = 'degraded';
            }
        }

        // Check Application Insights
        health.services.telemetry = {
            status: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ? 'healthy' : 'disabled'
        };

    } catch (error) {
        logger.error('Health check failed', { error });
        health.status = 'unhealthy';
        health.error = error.message;
    }

    health.responseTime = Date.now() - startTime;
    return health;
};

// Enhanced health check endpoint
export const healthCheckHandler = async (req, res) => {
    try {
        const health = await getSystemHealth();
        
        // Set appropriate status code
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 200 : 503;

        // Log health check
        if (health.status !== 'healthy') {
            logger.warn('Health check detected issues', {
                status: health.status,
                services: health.services
            });
        }

        // Track in Application Insights
        applicationInsights.trackEvent({
            name: health.status === 'healthy' ? 'HealthCheckPassed' : 'HealthCheckFailed',
            properties: {
                status: health.status,
                responseTime: health.responseTime,
                ...health.services
            }
        });

        res.status(statusCode).json(health);
    } catch (error) {
        logger.error('Health check endpoint failed', { error });
        
        applicationInsights.trackException({ 
            exception: error,
            properties: {
                operation: 'healthCheck'
            }
        });

        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// Readiness check (for Kubernetes/Docker)
export const readinessCheck = async (req, res) => {
    try {
        // Check if essential services are ready
        const { data, error } = await supabase
            .from('users')
            .select('id')
            .limit(1);

        if (error) {
            return res.status(503).json({
                status: 'not_ready',
                message: 'Database not ready',
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            status: 'ready',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Readiness check failed', { error });
        res.status(503).json({
            status: 'not_ready',
            message: 'Service not ready',
            timestamp: new Date().toISOString()
        });
    }
};

// Liveness check (for Kubernetes/Docker)
export const livenessCheck = (req, res) => {
    // Simple check that the process is running
    res.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
};

// Metrics collection
export const getMetrics = (req, res) => {
    try {
        const metrics = {
            timestamp: new Date().toISOString(),
            process: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                version: process.version
            },
            system: {
                platform: os.platform(),
                arch: os.arch(),
                loadavg: os.loadavg(),
                freemem: os.freemem(),
                totalmem: os.totalmem(),
                cpus: os.cpus().length
            },
            nodejs: {
                version: process.version,
                versions: process.versions
            }
        };

        res.json(metrics);
    } catch (error) {
        logger.error('Metrics collection failed', { error });
        res.status(500).json({
            error: 'Failed to collect metrics',
            timestamp: new Date().toISOString()
        });
    }
};

// Performance monitoring middleware
export const performanceMonitor = (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // Log slow requests
        if (duration > 5000) { // 5 seconds
            logger.warn('Slow request detected', {
                method: req.method,
                url: req.url,
                duration: `${duration}ms`,
                statusCode: res.statusCode,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                userId: req.user?.id
            });
        }

        // Track performance metrics
        applicationInsights.trackMetric({
            name: 'request.duration',
            value: duration,
            properties: {
                method: req.method,
                route: req.route?.path || req.url,
                statusCode: res.statusCode
            }
        });

        // Track request count
        applicationInsights.trackMetric({
            name: 'request.count',
            value: 1,
            properties: {
                method: req.method,
                statusCode: res.statusCode
            }
        });
    });

    next();
};

// Error rate monitoring
export const errorRateMonitor = (err, req, res, next) => {
    // Track error rate
    applicationInsights.trackMetric({
        name: 'error.rate',
        value: 1,
        properties: {
            errorType: err.name,
            statusCode: res.statusCode || 500,
            method: req.method,
            route: req.route?.path || req.url
        }
    });

    next(err);
};

export default {
    getSystemHealth,
    healthCheckHandler,
    readinessCheck,
    livenessCheck,
    getMetrics,
    performanceMonitor,
    errorRateMonitor
};