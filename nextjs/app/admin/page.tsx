import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminPanel from '@/app/components/AdminPanel'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Check if user is authenticated and is an admin
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's role from correct table
  const { data: profile } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('auth_user_id', user.id)
    .single()

  // Redirect non-admin users
  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Admin Dashboard</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <AdminPanel />
      </div>
    </div>
  )
}