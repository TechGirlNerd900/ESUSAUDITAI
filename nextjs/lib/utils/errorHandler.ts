import { toast } from '@/app/components/ui/use-toast';

// Define ErrorCategory enum
export enum ErrorCategory {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Define ApiErrorResult interface
export interface ApiErrorResult {
  error: Error;
  message: string; // User-friendly message
  statusCode: number | null;
  category: ErrorCategory;
  shouldRetry: boolean;
  isEmptyState: boolean;
  retryAfter: number | null; // For rate limits
  fieldErrors?: { field: string; message: string }[];
}

// Define ApiSuccessResult interface
export interface ApiSuccessResult<T = any> {
  data: T | null;
  success: true;
  statusCode: number;
}

// Define ErrorHandlerOptions interface
export interface ErrorHandlerOptions {
  endpoint?: string;
  resourceType?: string;
  showToast?: boolean;
  customMessage?: string;
  isListEndpoint?: boolean;
}

/**
 * Classifies HTTP errors by status code and context.
 */
export function classifyError(response: Response | null, options?: ErrorHandlerOptions): { category: ErrorCategory; statusCode: number | null; shouldRetry: boolean } {
  if (!response) {
    return { category: ErrorCategory.NETWORK_ERROR, statusCode: null, shouldRetry: true };
  }

  const statusCode = response.status;
  let category: ErrorCategory = ErrorCategory.UNKNOWN_ERROR;
  let shouldRetry = false;

  if (statusCode >= 500) {
    category = ErrorCategory.SERVER_ERROR;
    shouldRetry = true;
  } else if (statusCode === 401) {
    category = ErrorCategory.AUTHENTICATION_ERROR;
  } else if (statusCode === 403) {
    category = ErrorCategory.AUTHORIZATION_ERROR;
  } else if (statusCode === 404) {
    category = ErrorCategory.NOT_FOUND;
  } else if (statusCode === 400) {
    category = ErrorCategory.VALIDATION_ERROR;
  } else if (statusCode === 429) {
    category = ErrorCategory.RATE_LIMIT;
    shouldRetry = true; // Rate limits can sometimes be retried after a delay
  }

  return { category, statusCode, shouldRetry };
}

/**
 * Generates user-friendly messages based on error type and context.
 */
export function getErrorMessage(category: ErrorCategory, statusCode: number | null, options?: ErrorHandlerOptions): string {
  if (options?.customMessage) {
    return options.customMessage;
  }

  switch (category) {
    case ErrorCategory.AUTHENTICATION_ERROR:
      return 'Your session has expired. Please log in again.';
    case ErrorCategory.AUTHORIZATION_ERROR:
      return "You don't have permission to perform this action.";
    case ErrorCategory.NOT_FOUND:
      return options?.resourceType ? `The requested ${options.resourceType} was not found.` : 'The requested resource was not found.';
    case ErrorCategory.VALIDATION_ERROR:
      return 'There was an issue with your input. Please check the details and try again.';
    case ErrorCategory.RATE_LIMIT:
      return 'Too many requests. Please try again after some time.';
    case ErrorCategory.SERVER_ERROR:
      return 'Our servers are experiencing issues. Please try again.';
    case ErrorCategory.NETWORK_ERROR:
      return 'Could not connect to the server. Please check your internet connection.';
    case ErrorCategory.UNKNOWN_ERROR:
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Determines if a 404 response should be treated as an empty state vs an actual error.
 */
export function isEmptyStateResponse(response: Response, options?: ErrorHandlerOptions): boolean {
  if (response.status === 404 && options?.isListEndpoint) {
    // For list endpoints, a 404 might mean no resources found, which is an empty state.
    // We might also check the response body if it contains an empty array or specific empty state indicator.
    // For now, we'll rely on the `isListEndpoint` flag.
    return true;
  }
  return false;
}

/**
 * Shows a toast notification.
 */
export function showToast(message: string, variant: 'default' | 'destructive' = 'destructive') {
  toast({
    title: variant === 'destructive' ? 'Error' : 'Success',
    description: message,
    variant: variant,
  });
}

/**
 * Handles API errors, classifies them, generates user-friendly messages, and optionally shows toasts.
 */
export async function handleApiError(response: Response | null, options?: ErrorHandlerOptions): Promise<ApiErrorResult> {
  const { category, statusCode, shouldRetry } = classifyError(response, options);
  let message = getErrorMessage(category, statusCode, options);
  let errorObject: Error;
  let fieldErrors: { field: string; message: string }[] | undefined;
  let retryAfter: number | null = null;

  if (response) {
    try {
      const errorBody = await response.json();
      if (errorBody.message) {
        message = errorBody.message; // Use specific error message from API if available
      }
      if (errorBody.errors && Array.isArray(errorBody.errors)) {
        fieldErrors = errorBody.errors;
      }
      if (response.headers.has('Retry-After')) {
        retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10);
      }
    } catch (e) {
      // If JSON parsing fails, use generic message
      console.error('Failed to parse error response body:', e);
    }
    errorObject = new Error(message);
  } else {
    errorObject = new Error(message); // Network error
  }

  const isEmpty = response ? isEmptyStateResponse(response, options) : false;

  if (options?.showToast && !isEmpty) {
    showToast(message, 'destructive');
  }

  return {
    error: errorObject,
    message,
    statusCode,
    category,
    shouldRetry: shouldRetry && !isEmpty, // Don't retry if it's an empty state
    isEmptyState: isEmpty,
    retryAfter,
    ...(fieldErrors && { fieldErrors }), // Conditionally include fieldErrors
  };
}

/**
 * Handles successful API responses, parses data, and returns in a consistent format.
 */
export async function handleApiSuccess<T>(response: Response): Promise<ApiSuccessResult<T>> {
  if (response.status === 204) { // No Content
    return { data: null, success: true, statusCode: 204 };
  }
  const data = await response.json();
  return { data, success: true, statusCode: response.status };
}

/**
 * Determines if an error should trigger a retry.
 */
export function shouldRetryError(category: ErrorCategory, retryCount: number): boolean {
  const MAX_RETRIES = 3; // Example max retries

  if (retryCount >= MAX_RETRIES) {
    return false;
  }

  switch (category) {
    case ErrorCategory.NETWORK_ERROR:
    case ErrorCategory.SERVER_ERROR:
    case ErrorCategory.RATE_LIMIT:
      return true;
    case ErrorCategory.AUTHENTICATION_ERROR:
    case ErrorCategory.AUTHORIZATION_ERROR:
    case ErrorCategory.NOT_FOUND:
    case ErrorCategory.VALIDATION_ERROR:
    case ErrorCategory.UNKNOWN_ERROR:
    default:
      return false;
  }
}
