/**
 * Helper utilities for the application
 */

/**
 * Wraps a promise with a timeout
 * @param {Promise} promise The promise to wrap with a timeout
 * @param {number} timeoutMs Timeout in milliseconds
 * @param {string} errorMsg Custom error message for timeout
 * @returns {Promise} Promise that will reject if the timeout is reached
 */
function promiseWithTimeout(promise, timeoutMs, errorMsg = 'Operation timed out') {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error(errorMsg));
        }, timeoutMs);
    });

    return Promise.race([
        promise,
        timeoutPromise
    ]).finally(() => {
        clearTimeout(timeoutHandle);
    });
}

/**
 * Formats an error for consistent error handling
 * @param {Error} error The error to format
 * @param {string} context Additional context about where the error occurred
 * @returns {Object} Formatted error object
 */
function formatError(error, context = '') {
    return {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        context,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
}

/**
 * Sanitizes an object for logging by removing sensitive fields
 * @param {Object} obj The object to sanitize
 * @returns {Object} Sanitized object safe for logging
 */
function sanitizeForLogging(obj) {
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'authorization'];
    const sanitized = { ...obj };

    Object.keys(sanitized).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = sanitizeForLogging(sanitized[key]);
        }
    });

    return sanitized;
}

/**
 * Validates and sanitizes a file name for security
 * @param {string} fileName Original file name
 * @returns {string} Sanitized file name
 */
function sanitizeFileName(fileName) {
    // Remove any directory traversal attempts
    const name = fileName.replace(/^.*[\\\/]/, '');
    
    // Remove any non-alphanumeric characters except for dots, dashes, and underscores
    return name.replace(/[^a-zA-Z0-9\.\-\_]/g, '_');
}

/**
 * Checks if a given MIME type is allowed
 * @param {string} mimeType The MIME type to check
 * @returns {boolean} Whether the MIME type is allowed
 */
function isAllowedMimeType(mimeType) {
    const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/csv'
    ];

    return allowedTypes.includes(mimeType);
}

module.exports = {
    promiseWithTimeout,
    formatError,
    sanitizeForLogging,
    sanitizeFileName,
    isAllowedMimeType
};