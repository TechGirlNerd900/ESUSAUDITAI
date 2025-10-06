// Admin Users Management API
// Lists all users in the organization for admin management

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/auth/apiAuth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { paginatedResponse } from '@/lib/api/apiResponse';

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request, ['admin']);
  if (!auth.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    const { count, error: countError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', auth.profile.organization_id);

    if (countError) {
      console.error('Error fetching user count:', countError);
      return NextResponse.json({ error: 'Failed to fetch user count' }, { status: 500 });
    }

    const totalUsers = count || 0;

    // Get all users in the same organization
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select(
        `
        id,
        auth_user_id,
        email,
        first_name,
        last_name,
        role,
        status,
        is_active,
        last_login_at,
        last_activity_at,
        created_at,
        updated_at
      `
      )
      .eq('organization_id', auth.profile.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Ensure users is an array and use the paginatedResponse helper
    return paginatedResponse(users || [], page, limit, totalUsers);
  } catch (error) {
    console.error('Users fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request, ['admin']);
  if (!auth.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email, firstName, lastName, role } = await request.json();

    if (!email || !firstName || !lastName || !role) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (!['auditor', 'reviewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be auditor or reviewer' },
        { status: 400 }
      );
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role,
        organization_id: auth.profile.organization_id,
      },
    });

    if (authError) {
      console.error('Error creating user:', authError);
      return NextResponse.json(
        { error: authError.message || 'Failed to create user' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'User created successfully. An invitation has been sent to their email.',
      user: {
        id: authUser.user?.id,
        email: authUser.user?.email,
        role,
      },
    });
  } catch (error) {
    console.error('User creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
