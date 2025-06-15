import appInsights from 'applicationinsights';
import { sanitizeForLogging } from '../utils/helpers.js';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Environment variables are already loaded by the time this module is imported

class LoggingService {
    constructor() {
        this.client = null;
        this.setupApplicationInsights();
    }

    static getConnectionString() {
        // Check for connection string first, then fall back to instrumentation key
        let connectionString = process.env.APPINSIGHTS_CONNECTION_STRING;
        
        // If we have an instrumentation key but no connection string, construct one
        if (!connectionString && process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
            connectionString = `InstrumentationKey=${process.env.APPINSIGHTS_INSTRUMENTATIONKEY}`;
            console.log('Using APPINSIGHTS_INSTRUMENTATIONKEY to create connection string');
        }
        
        return connectionString;
    }

    setupApplicationInsights() {
        const connectionString = LoggingService.getConnectionString();
        if (!connectionString) {
            console.warn('Application Insights connection string is not defined. Using mock client');
            this.client = this.createMockClient();
            return;
        }
        try {

            if (!appInsights.defaultClient) {
                appInsights.setup(connectionString)
                    .setAutoDependencyCorrelation(true)
                    .setAutoCollectRequests(true)
                    .setAutoCollectPerformance(true)
                    .setAutoCollectExceptions(true)
                    .setAutoCollectDependencies(true)
                    .setAutoCollectConsole(true)
                    .setUseDiskRetryCaching(true)
                    .setSendLiveMetrics(true)
                    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C);

                // Custom settings for production
                if (process.env.NODE_ENV === 'production') {
                    appInsights.defaultClient.config.maxBatchSize = 250;
                    appInsights.defaultClient.config.maxBatchIntervalMs = 15000;
                    appInsights.defaultClient.config.disableAppInsights = false;
                }

                appInsights.start();
            }

            this.client = appInsights.defaultClient;
            
            if (!this.client) {
                throw new Error('Failed to initialize Application Insights client');
            }
        } catch (error) {
            console.error('Failed to setup Application Insights:', error);
            // Create a mock client for graceful degradation
            this.client = this.createMockClient();
        }
    }

    // Create a mock client for when Application Insights fails to initialize
    createMockClient() {
        return {
            trackEvent: (data) => console.log('Mock trackEvent:', data),
            trackException: (data) => console.log('Mock trackException:', data),
            trackMetric: (data) => console.log('Mock trackMetric:', data),
            trackDependency: (data) => console.log('Mock trackDependency:', data),
            trackTrace: (data) => console.log('Mock trackTrace:', data)
        };
    }

    // Track custom events with context
    trackEvent(nameOrEvent, properties = {}, measurements = {}) {
        if (!this.client) {
            console.warn('Application Insights client not initialized');
            return;
        }

        try {
            // Support both signature styles: trackEvent(name, props, measurements) or trackEvent({ name, properties, measurements })
            let name;
            let props;
            let meas;
            if (typeof nameOrEvent === 'object' && nameOrEvent.name) {
                name = nameOrEvent.name;
                props = nameOrEvent.properties || {};
                meas = nameOrEvent.measurements || {};
            } else {
                name = nameOrEvent;
                props = properties;
                meas = measurements;
            }
            const sanitizedProps = sanitizeForLogging(props);
            this.client.trackEvent({
                name,
                properties: {
                    ...sanitizedProps,
                    environment: process.env.NODE_ENV,
                    timestamp: new Date().toISOString()
                },
                measurements: meas
            });
        } catch (error) {
            console.error('Error tracking event:', error);
        }
    }

    // Track exceptions with full context
    trackException(error, properties = {}) {
        if (!this.client) {
            console.warn('Application Insights client not initialized');
            return;
        }

        try {
            const sanitizedProps = sanitizeForLogging(properties);
            this.client.trackException({
                exception: error,
                properties: {
                    ...sanitizedProps,
                    environment: process.env.NODE_ENV,
                    timestamp: new Date().toISOString(),
                    stack: error.stack
                }
            });
        } catch (trackingError) {
            console.error('Error tracking exception:', trackingError);
        }
    }

    // Track API requests
    trackRequest() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            // Add correlation ID if not present
            if (!req.headers['x-correlation-id']) {
                req.headers['x-correlation-id'] = crypto.randomUUID();
            }

            // Track request start
            this.trackEvent('ApiRequest', {
                method: req.method,
                path: req.path,
                correlationId: req.headers['x-correlation-id'],
                userAgent: req.headers['user-agent'],
                clientIp: req.ip
            });

            // Track response
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                this.trackEvent('ApiResponse', {
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    duration,
                    correlationId: req.headers['x-correlation-id']
                });
            });

            next();
        };
    }

    // Track Azure AI operations
    trackAzureOperation(operationType, properties = {}, measurements = {}) {
        if (!this.client) {
            console.warn('Application Insights client not initialized');
            return;
        }

        try {
            const sanitizedProps = sanitizeForLogging(properties);
            this.client.trackEvent({
                name: `Azure${operationType}`,
                properties: {
                    ...sanitizedProps,
                    operationType,
                    environment: process.env.NODE_ENV,
                    timestamp: new Date().toISOString()
                },
                measurements
            });
        } catch (error) {
            console.error('Error tracking Azure operation:', error);
        }
    }

    // Track performance metrics
    trackMetric(name, value, properties = {}) {
        if (!this.client) {
            console.warn('Application Insights client not initialized');
            return;
        }

        try {
            this.client.trackMetric({
                name,
                value,
                properties: {
                    ...properties,
                    environment: process.env.NODE_ENV,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error tracking metric:', error);
        }
    }

    // Track dependency calls (Supabase, Azure, etc.)
    trackDependency(name, data, duration, success = true, properties = {}) {
        if (!this.client) {
            console.warn('Application Insights client not initialized');
            return;
        }

        try {
            this.client.trackDependency({
                target: name,
                name: data.operation,
                data: JSON.stringify(sanitizeForLogging(data)),
                duration,
                success,
                resultCode: success ? '200' : '500',
                properties: {
                    ...properties,
                    environment: process.env.NODE_ENV,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error tracking dependency:', error);
        }
    }
}

// Export singleton instance
export const applicationInsights = new LoggingService();
