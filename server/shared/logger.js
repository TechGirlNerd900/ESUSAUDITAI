import { applicationInsights } from './logging.js';

class Logger {
    constructor() {
        this.isProduction = process.env.NODE_ENV === 'production';
        this.logLevel = process.env.LOG_LEVEL || (this.isProduction ? 'info' : 'debug');
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    _shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    _formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            ...meta
        };

        if (this.isProduction) {
            // In production, send to Application Insights
            applicationInsights.trackTrace({
                message: `[${level.toUpperCase()}] ${message}`,
                severity: this._getAppInsightsSeverity(level),
                properties: meta
            });
        } else {
            // In development, use console with colors
            const colors = {
                error: '\x1b[31m',   // red
                warn: '\x1b[33m',    // yellow
                info: '\x1b[36m',    // cyan
                debug: '\x1b[90m'    // gray
            };
            const reset = '\x1b[0m';
            console.log(`${colors[level]}[${timestamp}] ${level.toUpperCase()}: ${message}${reset}`, meta);
        }

        return logEntry;
    }

    _getAppInsightsSeverity(level) {
        const severityMap = {
            error: 3,    // Error
            warn: 2,     // Warning
            info: 1,     // Information
            debug: 0     // Verbose
        };
        return severityMap[level] || 1;
    }

    error(message, meta = {}) {
        if (this._shouldLog('error')) {
            this._formatMessage('error', message, meta);
            
            // For errors, also track as exception if there's an error object
            if (meta.error instanceof Error) {
                applicationInsights.trackException({
                    exception: meta.error,
                    properties: { ...meta, message }
                });
            }
        }
    }

    warn(message, meta = {}) {
        if (this._shouldLog('warn')) {
            this._formatMessage('warn', message, meta);
        }
    }

    info(message, meta = {}) {
        if (this._shouldLog('info')) {
            this._formatMessage('info', message, meta);
        }
    }

    debug(message, meta = {}) {
        if (this._shouldLog('debug')) {
            this._formatMessage('debug', message, meta);
        }
    }

    // Request logging middleware
    requestLogger(req, res, next) {
        const startTime = Date.now();
        const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        req.requestId = requestId;
        req.startTime = startTime;

        // Log incoming request
        this.info('Incoming request', {
            requestId,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id
        });

        // Override res.json to log responses
        const originalJson = res.json;
        res.json = function(data) {
            const duration = Date.now() - startTime;
            
            logger.info('Request completed', {
                requestId,
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                userId: req.user?.id
            });

            return originalJson.call(this, data);
        };

        next();
    }

    // Security event logging
    security(event, meta = {}) {
        this.warn(`SECURITY: ${event}`, {
            ...meta,
            timestamp: new Date().toISOString(),
            severity: 'security'
        });

        // Also track as custom event in Application Insights
        applicationInsights.trackEvent({
            name: 'SecurityEvent',
            properties: {
                event,
                ...meta
            }
        });
    }

    // Performance logging
    performance(operation, duration, meta = {}) {
        this.info(`PERFORMANCE: ${operation} completed in ${duration}ms`, {
            ...meta,
            operation,
            duration,
            timestamp: new Date().toISOString()
        });

        // Track performance metric
        applicationInsights.trackMetric({
            name: `performance.${operation}`,
            value: duration,
            properties: meta
        });
    }

    // Business logic logging
    business(event, meta = {}) {
        this.info(`BUSINESS: ${event}`, {
            ...meta,
            timestamp: new Date().toISOString(),
            category: 'business'
        });

        applicationInsights.trackEvent({
            name: 'BusinessEvent',
            properties: {
                event,
                ...meta
            }
        });
    }
}

// Create singleton instance
const logger = new Logger();

// Helper function to replace console.log statements
export const replaceConsoleInProduction = () => {
    if (process.env.NODE_ENV === 'production') {
        console.log = (...args) => logger.debug(args.join(' '));
        console.info = (...args) => logger.info(args.join(' '));
        console.warn = (...args) => logger.warn(args.join(' '));
        console.error = (...args) => logger.error(args.join(' '));
    }
};

export default logger;