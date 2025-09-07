/**
 * Utility helper functions for the Next.js backend
 */

/**
 * Executes a promise with a timeout
 */
export function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMsg: string = 'Operation timed out'
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  });
}

/**
 * Error object interface for consistent error handling
 */
export interface FormattedError {
  message: string;
  code: string;
  context: string;
  stack?: string | undefined;
}

/**
 * Formats an error object for consistent error handling
 */
export function formatError(error: Error, context: string = ''): FormattedError {
  return {
    message: error.message,
    code: (error as any).code || 'UNKNOWN_ERROR',
    context,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  };
}

/**
 * Sanitizes objects for logging by removing sensitive information
 */
export function sanitizeForLogging(obj: Record<string, any>): Record<string, any> {
  const sensitiveFields = ['password', 'token', 'key', 'secret', 'authorization'];
  const sanitized = { ...obj };

  Object.keys(sanitized).forEach((key) => {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  });

  return sanitized;
}

/**
 * Sanitizes filenames to prevent path traversal attacks
 */
export function sanitizeFileName(fileName: string): string {
  const name = fileName.replace(/^.*[\\/]/, '');
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

/**
 * Checks if a MIME type is in the allowed list
 */
export function isAllowedMimeType(mimeType: string): boolean {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
  ];

  return allowedTypes.includes(mimeType);
}
