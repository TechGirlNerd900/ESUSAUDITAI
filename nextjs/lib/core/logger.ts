/**
 * Structured Logging Service
 *
 * This module provides a structured logging service with different log levels,
 * correlation IDs, and context tracking.
 */

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  userId?: string;
  organizationId?: string;
  requestId?: string;
  requestPath?: string;
  component?: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    type?: string;
  };
}

// Logger options
export interface LoggerOptions {
  minLevel?: LogLevel;
  defaultContext?: Record<string, any>;
  serviceName?: string;
  environment?: string;
  correlationIdProvider?: () => string | undefined;
}

// Logger interface
export interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, error?: Error, context?: Record<string, any>): void;
  fatal(message: string, error?: Error, context?: Record<string, any>): void;
  withContext(context: Record<string, any>): Logger;
  withCorrelationId(correlationId: string): Logger;
  withComponent(component: string): Logger;
  withUser(userId: string, organizationId?: string): Logger;
  withRequest(requestId: string, requestPath?: string): Logger;
}

// Log transport interface
export interface LogTransport {
  log(entry: LogEntry): void;
}

// Console log transport
export class ConsoleTransport implements LogTransport {
  log(entry: LogEntry): void {
    const { level, message, timestamp, correlationId, component, ...rest } = entry;

    // Format the log message
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const correlationPrefix = correlationId ? ` [${correlationId}]` : '';
    const componentPrefix = component ? ` [${component}]` : '';

    // Log with appropriate console method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`${prefix}${correlationPrefix}${componentPrefix} ${message}`, rest);
        break;
      case LogLevel.INFO:
        console.info(`${prefix}${correlationPrefix}${componentPrefix} ${message}`, rest);
        break;
      case LogLevel.WARN:
        console.warn(`${prefix}${correlationPrefix}${componentPrefix} ${message}`, rest);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(`${prefix}${correlationPrefix}${componentPrefix} ${message}`, rest);
        break;
    }
  }
}

// Logger implementation
export class StructuredLogger implements Logger {
  private transports: LogTransport[] = [];
  private minLevel: LogLevel;
  private context: Record<string, any>;
  private correlationId?: string;
  private component?: string;
  private userId?: string;
  private organizationId?: string;
  private requestId?: string;
  private requestPath?: string;
  private serviceName: string;
  private environment: string;
  private correlationIdProvider?: () => string | undefined;

  constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel || LogLevel.INFO;
    this.context = options.defaultContext || {};
    this.serviceName = options.serviceName || 'esusauditai';
    this.environment = options.environment || process.env.NODE_ENV || 'development';

    // Handle optional correlationIdProvider with proper type checking
    if (options.correlationIdProvider !== undefined) {
      this.correlationIdProvider = options.correlationIdProvider;
    }

    // Add console transport by default
    this.addTransport(new ConsoleTransport());
  }

  /**
   * Add a log transport
   * @param transport The transport to add
   */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param context Additional context
   */
  debug(message: string, context: Record<string, any> = {}): void {
    this.log(LogLevel.DEBUG, message, undefined, context);
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param context Additional context
   */
  info(message: string, context: Record<string, any> = {}): void {
    this.log(LogLevel.INFO, message, undefined, context);
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param context Additional context
   */
  warn(message: string, context: Record<string, any> = {}): void {
    this.log(LogLevel.WARN, message, undefined, context);
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param error The error object
   * @param context Additional context
   */
  error(message: string, error?: Error, context: Record<string, any> = {}): void {
    this.log(LogLevel.ERROR, message, error, context);
  }

  /**
   * Log a fatal message
   * @param message The message to log
   * @param error The error object
   * @param context Additional context
   */
  fatal(message: string, error?: Error, context: Record<string, any> = {}): void {
    this.log(LogLevel.FATAL, message, error, context);
  }

  /**
   * Create a new logger with additional context
   * @param context The context to add
   * @returns A new logger with the combined context
   */
  withContext(context: Record<string, any>): Logger {
    const newLogger = this.clone();
    newLogger.context = { ...this.context, ...context };
    return newLogger;
  }

  /**
   * Create a new logger with a correlation ID
   * @param correlationId The correlation ID
   * @returns A new logger with the correlation ID
   */
  withCorrelationId(correlationId: string): Logger {
    const newLogger = this.clone();
    newLogger.correlationId = correlationId;
    return newLogger;
  }

  /**
   * Create a new logger with a component name
   * @param component The component name
   * @returns A new logger with the component name
   */
  withComponent(component: string): Logger {
    const newLogger = this.clone();
    newLogger.component = component;
    return newLogger;
  }

  /**
   * Create a new logger with user information
   * @param userId The user ID
   * @param organizationId The organization ID
   * @returns A new logger with user information
   */
  withUser(userId: string, organizationId?: string): Logger {
    const newLogger = this.clone();
    newLogger.userId = userId;

    // Only set organizationId if it's defined
    if (organizationId !== undefined) {
      newLogger.organizationId = organizationId;
    }

    return newLogger;
  }

  /**
   * Create a new logger with request information
   * @param requestId The request ID
   * @param requestPath The request path
   * @returns A new logger with request information
   */
  withRequest(requestId: string, requestPath?: string): Logger {
    const newLogger = this.clone();
    newLogger.requestId = requestId;

    // Only set requestPath if it's defined
    if (requestPath !== undefined) {
      newLogger.requestPath = requestPath;
    }

    return newLogger;
  }

  /**
   * Log a message with the specified level
   * @param level The log level
   * @param message The message to log
   * @param error The error object
   * @param context Additional context
   */
  private log(
    level: LogLevel,
    message: string,
    error?: Error,
    context: Record<string, any> = {}
  ): void {
    // Skip if level is below minimum
    if (!this.shouldLog(level)) {
      return;
    }

    // Get correlation ID from provider if not set
    const correlationId =
      this.correlationId || (this.correlationIdProvider ? this.correlationIdProvider() : undefined);

    // Create log entry with required fields
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...this.context,
        ...context,
        service: this.serviceName,
        environment: this.environment,
      },
      ...(correlationId !== undefined && { correlationId }),
      ...(this.component !== undefined && { component: this.component }),
      ...(this.userId !== undefined && { userId: this.userId }),
      ...(this.organizationId !== undefined && { organizationId: this.organizationId }),
      ...(this.requestId !== undefined && { requestId: this.requestId }),
      ...(this.requestPath !== undefined && { requestPath: this.requestPath }),
    };

    // Add error information if provided
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...((error as any).code && { code: (error as any).code }),
        ...((error as any).type && { type: (error as any).type }),
      };
    }

    // Send to all transports
    for (const transport of this.transports) {
      transport.log(entry);
    }
  }

  /**
   * Check if a log level should be logged
   * @param level The log level to check
   * @returns Whether the level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];

    const minLevelIndex = levels.indexOf(this.minLevel);
    const levelIndex = levels.indexOf(level);

    return levelIndex >= minLevelIndex;
  }

  /**
   * Clone the logger
   * @returns A new logger with the same configuration
   */
  private clone(): StructuredLogger {
    // Create options object with required fields
    const options: LoggerOptions = {
      minLevel: this.minLevel,
      defaultContext: { ...this.context },
      serviceName: this.serviceName,
      environment: this.environment,
      ...(this.correlationIdProvider !== undefined && {
        correlationIdProvider: this.correlationIdProvider,
      }),
    };

    const newLogger = new StructuredLogger(options);

    newLogger.transports = [...this.transports];

    // Handle optional properties with type assertions to satisfy exactOptionalPropertyTypes
    if (this.correlationId !== undefined) {
      newLogger.correlationId = this.correlationId;
    }

    if (this.component !== undefined) {
      newLogger.component = this.component;
    }

    if (this.userId !== undefined) {
      newLogger.userId = this.userId;
    }

    if (this.organizationId !== undefined) {
      newLogger.organizationId = this.organizationId;
    }

    if (this.requestId !== undefined) {
      newLogger.requestId = this.requestId;
    }

    if (this.requestPath !== undefined) {
      newLogger.requestPath = this.requestPath;
    }

    return newLogger;
  }
}

// Create a default logger
const defaultLogger = new StructuredLogger({
  minLevel: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  defaultContext: {
    version: process.env.APP_VERSION || '1.0.0',
  },
  serviceName: 'esusauditai',
  environment: process.env.NODE_ENV || 'development',
});

// Export the default logger
export default defaultLogger;

// Export a function to get a component logger
export function getLogger(component: string): Logger {
  return defaultLogger.withComponent(component);
}
