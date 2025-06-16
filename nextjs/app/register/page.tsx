import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function Register() {
  const supabase = await createClient()

  // Check if user is already authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    // If user is already logged in, redirect to dashboard
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" action="/api/auth/register" method="POST">
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input-modern w-full"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="input-modern w-full"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button type="submit" className="btn-primary w-full">
              Register
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}