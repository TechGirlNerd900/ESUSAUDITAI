'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    
    // Call the logout API endpoint
    await fetch('/api/auth/logout', {
      method: 'POST'
    })
    
    // Clear local auth state
    await supabase.auth.signOut()
    
    // Refresh router state and redirect
    router.refresh()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm font-medium text-gray-700 hover:text-gray-800"
    >
      Sign out
    </button>
  )
}