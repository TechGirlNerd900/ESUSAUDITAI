'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ReactNode } from 'react'

interface LogoutButtonProps {
  children?: ReactNode
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link'
}

export default function LogoutButton({ children, className, variant = 'default' }: LogoutButtonProps) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()

    // Call the logout API endpoint
    await fetch('/api/auth/logout', {
      method: 'POST',
    })

    // Clear local auth state
    await supabase.auth.signOut()

    // Refresh router state and redirect
    router.refresh()
    router.push('/login')
  }

  return (
    <Button
      onClick={handleLogout}
      className={className}
      variant={variant}
    >
      {children || 'Sign out'}
    </Button>
  )
}
