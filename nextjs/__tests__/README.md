# Next.js Middleware Tests

This directory contains unit tests for the Next.js middleware functionality.

## Middleware Tests

The middleware tests (`middleware.test.ts`) verify that the authentication middleware correctly:

1. Skips middleware processing for:
   - Static files (e.g., images, CSS)
   - Public paths (login, register, etc.)
   - Public API paths (auth callbacks, etc.)
   - API routes (which handle their own authentication)

2. Handles authentication:
   - Redirects to login when no session exists
   - Redirects to login when an authentication error occurs
   - Continues to the requested page when a valid session exists
   - Handles unexpected errors by redirecting to login

## Running Tests

To run the tests:

```bash
# From the nextjs directory
npm test

# To run tests in watch mode
npm run test:watch
```

## Test Structure

The tests use Jest and mock the Next.js server components and Supabase client to isolate the middleware functionality.

Each test focuses on a specific scenario to ensure the middleware behaves correctly under different conditions.