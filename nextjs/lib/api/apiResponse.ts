import { NextResponse } from 'next/server';

/**
 * Standard API response helpers to ensure consistent response formats
 * across all API endpoints.
 *
 * These helpers should return HTTP 200 status for empty lists, not 404.
 * A 404 status is reserved for when a specific, singular resource is not found.
 */

/**
 * Returns a standard success response
 */
export function successResponse(data: any, message: string = 'Success') {
  return NextResponse.json({
    success: true,
    message,
    data,
  });
}

/**
 * Returns a 201 Created response
 */
export function createdResponse(data: any, message: string = 'Resource created successfully') {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status: 201 }
  );
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
  return NextResponse.json(
    {
      success: false,
      message,
      errors,
    },
    { status: statusCode }
  );
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
 * Returns a paginated success response.
 * Use this for list endpoints that support pagination.
 * Always returns 200 OK, even if the data array is empty.
 *
 * @param data The array of results (will be coerced to empty array if null/undefined).
 * @param page Current page number.
 * @param limit Items per page.
 * @param total Total count of items.
 * @param message Optional success message.
 * @returns A standardized paginated response.
 */
export function paginatedResponse(
  data: any[] | null | undefined,
  page: number,
  limit: number,
  total: number,
  message: string = 'Success'
) {
  const actualData = data || [];
  const totalPages = Math.ceil(total / limit);
  return NextResponse.json({
    success: true,
    message,
    data: actualData,
    pagination: {
      page,
      limit,
      total,
      pages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
}

/**
 * Returns a list success response for non-paginated lists.
 * Always returns 200 OK, even if the data array is empty.
 *
 * @param data The array of results (will be coerced to empty array if null/undefined).
 * @param message Optional success message.
 * @returns A standardized list response.
 */
export function listResponse(data: any[] | null | undefined, message: string = 'Success') {
  const actualData = data || [];
  return NextResponse.json({
    success: true,
    message,
    data: actualData,
    total: actualData.length,
  });
}

/**
 * Returns a 429 Too Many Requests response
 */
export function rateLimitResponse(retryAfter: number = 60) {
  return NextResponse.json(
    {
      success: false,
      message: 'Too many requests, please try again later',
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
      },
    }
  );
}
