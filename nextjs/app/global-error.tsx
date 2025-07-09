'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the critical error to an error reporting service
    console.error('Critical Application Error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      type: 'GLOBAL_ERROR',
      severity: 'CRITICAL',
    });

    // Report to external error service if available
    if (typeof window !== 'undefined' && window.reportError) {
      window.reportError(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="max-w-lg w-full bg-white shadow-xl rounded-lg p-8">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="mt-6 text-center">
              <h1 className="text-xl font-semibold text-gray-900">Critical System Error</h1>
              <p className="mt-3 text-gray-600">
                The application has encountered a critical error and needs to be restarted. Our
                technical team has been automatically notified.
              </p>

              {process.env.NODE_ENV === 'development' && (
                <details className="mt-6 text-left bg-gray-50 p-4 rounded-lg">
                  <summary className="font-medium text-gray-700 cursor-pointer mb-2">
                    Technical Details (Development Mode)
                  </summary>
                  <div className="text-sm text-gray-600 space-y-2">
                    <div>
                      <strong>Error:</strong> {error.message}
                    </div>
                    {error.digest && (
                      <div>
                        <strong>Digest:</strong> {error.digest}
                      </div>
                    )}
                    {error.stack && (
                      <div>
                        <strong>Stack Trace:</strong>
                        <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              <div className="mt-8 space-y-3">
                <button
                  onClick={() => reset()}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-md transition-colors"
                >
                  Restart Application
                </button>
                <button
                  onClick={() => (window.location.href = '/')}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-md transition-colors"
                >
                  Return to Home
                </button>
              </div>

              <div className="mt-6 text-xs text-gray-500">
                Error ID:{' '}
                {error.digest || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`}
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
