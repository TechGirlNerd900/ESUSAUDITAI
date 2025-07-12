/**
 * Debug logging utility for production-safe console logging
 * Only logs in development environment to prevent sensitive data exposure
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

class DebugLogger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private shouldLog(): boolean {
    return this.isDevelopment;
  }

  log(...args: any[]): void {
    if (this.shouldLog()) {
      console.log(...args);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog()) {
      console.info(...args);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog()) {
      console.warn(...args);
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog()) {
      console.error(...args);
    }
  }

  debug(...args: any[]): void {
    if (this.shouldLog()) {
      console.debug(...args);
    }
  }

  /**
   * Safely log authentication attempts without exposing sensitive data
   * @param email - Email address (will be partially masked in production)
   * @param action - Action being performed
   */
  logAuth(email: string, action: string): void {
    if (this.shouldLog()) {
      console.log(`🔄 ${action} for:`, email);
    }
  }

  /**
   * Safely log session information without exposing full tokens
   * @param session - Session object (will be sanitized)
   */
  logSession(session: any): void {
    if (this.shouldLog()) {
      if (session?.access_token) {
        console.log('✅ Session created:', session.access_token.substring(0, 10) + '...');
        if (session.expires_at) {
          console.log('🍪 Session expires at:', new Date(session.expires_at * 1000));
        }
      }
    }
  }

  /**
   * Log API responses safely
   * @param response - API response object
   * @param context - Context for the log
   */
  logApiResponse(response: any, context: string): void {
    if (this.shouldLog()) {
      console.log(`🔍 ${context}:`, response);
    }
  }
}

// Create singleton instance
export const debugLog = new DebugLogger();

// Export individual methods for convenience
export const {
  log: debugLogger,
  info: debugInfo,
  warn: debugWarn,
  error: debugError,
  debug: debugDebug,
  logAuth: debugLogAuth,
  logSession: debugLogSession,
  logApiResponse: debugLogApiResponse,
} = debugLog;
