'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import LoadingSpinner from '@/app/components/LoadingSpinner'

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [notification, setNotification] = useState({
    type: '',
    message: ''
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateProfile(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(event.target as HTMLFormElement)
      const updates = {
        full_name: formData.get('fullName'),
        organization: formData.get('organization'),
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user?.id, ...updates })

      if (error) throw error

      setNotification({
        type: 'success',
        message: 'Profile updated successfully!'
      })
    } catch (error) {
      console.error('Error:', error)
      setNotification({
        type: 'error',
        message: 'Error updating profile. Please try again.'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      {notification.message && (
        <div className={`p-4 rounded-lg mb-6 ${
          notification.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-6">Profile Settings</h2>
        <form onSubmit={updateProfile} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={user?.email}
              disabled
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
            />
          </div>

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="organization" className="block text-sm font-medium text-gray-700">
              Organization
            </label>
            <input
              type="text"
              id="organization"
              name="organization"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}