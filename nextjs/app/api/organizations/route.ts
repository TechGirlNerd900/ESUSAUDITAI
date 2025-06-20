// Organization Management API
// Handles creation, management, and invitation of organizations for SaaS multi-tenancy

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { authenticateApiRequest } from '@/lib/apiAuth'

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.success) {
    return auth.response
  }

  const supabase = createClient()

  try {
    // Get user's organization
    const { data: organization, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', auth.profile.organization_id)
      .single()

    if (error) {
      console.error('Error fetching organization:', error)
      return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 })
    }

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Organization fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, adminEmail, adminFirstName, adminLastName } = await request.json()

    if (!name || !adminEmail || !adminFirstName || !adminLastName) {
      return NextResponse.json(
        { error: 'Organization name and admin details are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Create organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert([{
        name: name.trim()
      }])
      .select()
      .single()

    if (orgError) {
      console.error('Error creating organization:', orgError)
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
    }

    // Create admin user for the organization
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email: adminEmail,
      password: 'TempPassword123!', // They'll be prompted to change this
      options: {
        data: {
          first_name: adminFirstName,
          last_name: adminLastName,
          role: 'admin',
          organization_id: organization.id
        }
      }
    })

    if (authError) {
      console.error('Error creating admin user:', authError)
      // Cleanup organization if user creation fails
      await supabase.from('organizations').delete().eq('id', organization.id)
      return NextResponse.json({ error: 'Failed to create admin user' }, { status: 500 })
    }

    return NextResponse.json({
      organization,
      message: 'Organization created successfully. Admin user will receive setup instructions via email.'
    })

  } catch (error) {
    console.error('Organization creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = await authenticateApiRequest(request, { requireRole: 'admin' })
  if (!auth.success) {
    return auth.response
  }

  try {
    const { name, logo_url } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
    }

    const supabase = createClient()

    const { data: organization, error } = await supabase
      .from('organizations')
      .update({
        name: name.trim(),
        logo_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', auth.profile.organization_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating organization:', error)
      return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
    }

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Organization update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}