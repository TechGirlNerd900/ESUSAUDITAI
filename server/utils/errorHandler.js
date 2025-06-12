/**
 * Standardized error handling utility
 * Provides consistent error responses and logging across the application
 */

import { applicationInsights } from '../shared/logging.js';
import { formatError, sanitizeForLogging } from './helpers.js';

export const asyncHandler = fn => (req, res, next) => { 
    Promise.resolve(fn(req, res, next)).catch(next); 
};

// Error types with corresponding HTTP status codes
export const ERROR_TYPES = {
  VALIDATION: 400,
  AUTHENTICATION: 401,
  AUTHORIZATION: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503
};

/**
 * Creates a standardized API error
 * @param {string} type - Error type from ERROR_TYPES
 * @param {string} message - User-friendly error message
 * @param {Object} details - Additional error details (optional)
 * @param {Error} originalError - Original error object (optional)
 * @returns {Object} Standardized error object
 */
export function createError(type, message, details = null, originalError = null) {
  const statusCode = ERROR_TYPES[type] || 500;
  
  const error = {
    type,
    message,
    statusCode,
    timestamp: new Date().toISOString()
  };
  
  if (details) {
    error.details = details;
  }
  
  // Log the error with Application Insights
  if (originalError) {
    applicationInsights.trackException({ 
      exception: originalError,
      properties: {
        errorType: type,
        customMessage: message,
        details: details ? JSON.stringify(details) : null
      }
    });
  } else {
    applicationInsights.trackEvent({
      name: 'ApiError',
      properties: {
        errorType: type,
        message,
        details: details ? JSON.stringify(details) : null
      }
    });
  }
  
  return error;
}

/**
 * Production-ready error handler middleware
 */
export function errorMiddleware(err, req, res, next) {
    // Log the error with full context in Application Insights
    applicationInsights.trackException({
        exception: err,
        properties: {
            path: req.path,
            method: req.method,
            query: sanitizeForLogging(req.query),
            body: sanitizeForLogging(req.body),
            userId: req.user?.id,
            correlationId: req.headers['x-correlation-id']
        }
    });

    // Don't expose internal errors in production
    const error = formatError(err, 'API Request');
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
    
    if (err.name === 'UnauthorizedError' || err.status === 401) {
        return res.status(401).json({
            error: 'Authentication required'
        });
    }
    
    if (err.name === 'ForbiddenError' || err.status === 403) {
        return res.status(403).json({
            error: 'Access denied'
        });
    }
    
    // Handle Supabase errors
    if (err.status === 409) {
        return res.status(409).json({
            error: 'Resource conflict',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
    
    // Handle Azure service errors
    if (err.code === 'AzureError') {
        return res.status(502).json({
            error: 'External service error',
            retryAfter: err.retryAfter || 60
        });
    }

    // Default error response
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message,
        correlationId: req.headers['x-correlation-id']
    });
}

/**
 * Handler for unhandled rejections and exceptions
 */
export function setupUncaughtHandlers() {
    process.on('unhandledRejection', (reason, promise) => {
        applicationInsights.trackException({
            exception: reason,
            properties: {
                type: 'UnhandledRejection',
                promise: promise.toString()
            }
        });
        
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
        applicationInsights.trackException({
            exception: error,
            properties: {
                type: 'UncaughtException'
            }
        });
        
        console.error('Uncaught Exception:', error);
        
        // Give the logger time to flush, then exit
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
}

/**
 * Supabase-specific error handling utility
 */

class SupabaseError extends Error {
    constructor(message, code, originalError) {
        super(message);
        this.name = 'SupabaseError';
        this.code = code;
        this.originalError = originalError;
    }
}

export const handleSupabaseError = (error, operation) => {
    let errorMessage = 'An unexpected error occurred';
    let statusCode = 500;

    // Map Supabase error codes to appropriate HTTP status codes and messages
    if (error?.message?.includes('JWT')) {
        statusCode = 401;
        errorMessage = 'Authentication token is invalid or expired';
    } else if (error?.code === '23505') {
        statusCode = 409;
        errorMessage = 'Resource already exists';
    } else if (error?.code === '23503') {
        statusCode = 404;
        errorMessage = 'Referenced resource not found';
    } else if (error?.code === '42P01') {
        statusCode = 500;
        errorMessage = 'Database table not found';
    } else if (error?.code === '42703') {
        statusCode = 500;
        errorMessage = 'Database column not found';
    } else if (error?.message?.includes('bucket')) {
        statusCode = 500;
        errorMessage = 'Storage bucket error';
    }

    // Log the error with additional context
    applicationInsights.trackException({
        exception: new SupabaseError(errorMessage, error?.code, error),
        properties: {
            operation,
            originalError: error?.message,
            errorCode: error?.code,
            statusCode
        }
    });

    return {
        statusCode,
        error: {
            message: errorMessage,
            code: error?.code,
            operation
        }
    };
};
