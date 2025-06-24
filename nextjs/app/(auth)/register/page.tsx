'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function Register() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Redirect to /signup with any query parameters
  useEffect(() => {
    const invite = searchParams.get('invite')
    const redirectUrl = invite ? `/signup?invite=${invite}` : '/signup'
    router.replace(redirectUrl)
  }, [router, searchParams])

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Redirecting to signup...</p>
      </div>
    </div>
  )
}