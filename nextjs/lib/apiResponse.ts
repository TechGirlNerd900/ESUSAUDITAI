import { NextResponse } from 'next/server';

/**
 * Standard API response helpers to ensure consistent response formats
 * across all API endpoints.
 */

/**
 * Returns a standard success response
 */
export function successResponse(data: any, message: string = 'Success') {
  return NextResponse.json({
    success: true,
    message,
    data
  });
}

/**
 * Returns a 201 Created response
 */
export function createdResponse(data: any, message: string = 'Resource created successfully') {
  return NextResponse.json({
    success: true,
    message,
    data
  }, { status: 201 });
}

/**
 * Returns a 204 No Content response
 */
export function noContentResponse() {
  return new NextResponse(null, { status: 204 });
}

/**
 * Returns an error response with the specified status code
 */
export function errorResponse(
  message: string = 'An error occurred',
  statusCode: number = 400,
  errors: any = null
) {
  return NextResponse.json({
    success: false,
    message,
    errors
  }, { status: statusCode });
}

/**
 * Returns a 401 Unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return errorResponse(message, 401);
}

/**
 * Returns a 403 Forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden') {
  return errorResponse(message, 403);
}

/**
 * Returns a 404 Not Found response
 */
export function notFoundResponse(resource: string = 'Resource') {
  return errorResponse(`${resource} not found`, 404);
}

/**
 * Returns a 500 Internal Server Error response
 */
export function serverErrorResponse(message: string = 'Internal server error') {
  return errorResponse(message, 500);
}

/**
 * Returns a 429 Too Many Requests response
 */
export function rateLimitResponse(retryAfter: number = 60) {
  return NextResponse.json({
    success: false,
    message: 'Too many requests, please try again later',
    retryAfter
  }, {
    status: 429,
    headers: {
      'Retry-After': String(retryAfter)
    }
  });
}