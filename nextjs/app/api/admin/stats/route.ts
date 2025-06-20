// Admin Dashboard Statistics API
// Provides organization-level statistics for admin dashboard

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest } from '@/lib/apiAuth'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireRole: 'admin' })
  if (!auth.success) {
    return auth.response
  }

  try {
    const supabase = createClient()
    const organizationId = auth.profile.organization_id

    // Get user statistics
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('is_active')
      .eq('organization_id', organizationId)

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json({ error: 'Failed to fetch user stats' }, { status: 500 })
    }

    const totalUsers = users.length
    const activeUsers = users.filter(user => user.is_active).length

    // Get project statistics
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('status')
      .eq('organization_id', organizationId)

    if (projectsError) {
      console.error('Error fetching projects:', projectsError)
      return NextResponse.json({ error: 'Failed to fetch project stats' }, { status: 500 })
    }

    const totalProjects = projects.length
    const activeProjects = projects.filter(project => project.status === 'active').length

    // Get document statistics
    const { count: totalDocuments, error: documentsError } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    if (documentsError) {
      console.error('Error fetching documents:', documentsError)
      return NextResponse.json({ error: 'Failed to fetch document stats' }, { status: 500 })
    }

    // Get pending invitations count
    const { data: invitations, error: invitationsError } = await supabase
      .from('app_settings')
      .select('key')
      .eq('organization_id', organizationId)
      .eq('category', 'invitations')
      .like('key', 'invite_%')

    if (invitationsError) {
      console.error('Error fetching invitations:', invitationsError)
      return NextResponse.json({ error: 'Failed to fetch invitation stats' }, { status: 500 })
    }

    const pendingInvitations = invitations.length

    const stats = {
      totalUsers,
      activeUsers,
      totalProjects,
      activeProjects,
      totalDocuments: totalDocuments || 0,
      pendingInvitations
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}