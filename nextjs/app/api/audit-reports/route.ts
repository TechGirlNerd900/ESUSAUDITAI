import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedUser } from '@/lib/auth/apiAuth';
import { createClient } from '@/utils/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser, supabase: SupabaseClient) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status');
    const report_type = searchParams.get('report_type');
    const project_id = searchParams.get('project_id');

    const organizationId = user.organizationId;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('audit_reports')
      .select(
        `*, 
        projects!inner(id, name, client_name), 
        created_by:users!audit_reports_created_by_fkey(id, first_name, last_name)`,
        { count: 'exact' }
      )
      .eq('organization_id', organizationId)
      .is('deleted_at', null);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (report_type && report_type !== 'all') {
      query = query.eq('report_type', report_type);
    }
    if (project_id) {
      query = query.eq('project_id', project_id);
    }

    const { data: reports, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching audit reports:', error);
      return NextResponse.json({ error: 'Failed to fetch audit reports', success: false }, { status: 500 });
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      data: {
        reports: reports || [],
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: totalPages,
        },
      },
    });
  } catch (error) {
    console.error('Unhandled error in GET /api/audit-reports:', error);
    return NextResponse.json({ error: 'Internal server error', success: false }, { status: 500 });
  }
});
