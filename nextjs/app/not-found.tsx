import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <div className="flex items-center justify-center w-16 h-16 mx-auto bg-blue-100 rounded-full">
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-3-3v6m-9 1V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v6.172a2 2 0 01-.586 1.414l-2 2a2 2 0 01-1.414.586H8a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        
        <h1 className="mt-6 text-2xl font-bold text-gray-900">Page Not Found</h1>
        <p className="mt-4 text-gray-600">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="mt-8 space-y-4">
          <Link
            href="/"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors"
          >
            Return Home
          </Link>
          
          <Link
            href="/dashboard"
            className="block w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-md transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Need help? <Link href="/support" className="text-blue-600 hover:text-blue-700">Contact Support</Link>
          </p>
        </div>
      </div>
    </div>
  )
}