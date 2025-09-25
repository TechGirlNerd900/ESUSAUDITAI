import React from 'react'
import Sidebar from '../components/Sidebar'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        }
      }
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Fixed Sidebar */}
      <Sidebar />
      
      {/* Main content area */}
      <div className="flex-1 lg:ml-64 flex flex-col overflow-hidden">
        {/* Top bar for mobile */}
        <div className="lg:hidden h-16 border-b bg-white flex items-center px-4">
          <h1 className="text-lg font-semibold ml-12">EsusAuditAI</h1>
        </div>
        
        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
