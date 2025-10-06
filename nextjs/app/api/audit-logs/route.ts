import { createClient } from '@/utils/supabase/server'; // Re-add for POST handler
import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/errorHandler';
import { SupabaseClient } from '@supabase/supabase-js';
import { paginatedResponse } from '@/lib/api/apiResponse';
import { withAuth, AuthenticatedUser } from '@/lib/auth/apiAuth';

// Function to insert an audit log (can be called internally or via a POST endpoint)
async function insertAuditLog(
  supabase: SupabaseClient,
  logData: {
    user_id: string;
    organization_id: string;
    action: string;
    details?: object;
    ip_address?: string;
    user_agent?: string;
    resource_type?: string;
    resource_id?: string;
    severity?: string;
    tags?: string[];
  }
) {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert([
      {
        user_id: logData.user_id,
        organization_id: logData.organization_id,
        action: logData.action,
        details: logData.details,
        ip_address: logData.ip_address,
        user_agent: logData.user_agent,
        resource_type: logData.resource_type,
        resource_id: logData.resource_id,
        severity: logData.severity,
        tags: logData.tags,
      },
    ])
    .select();

  if (error) {
    console.error('Error inserting audit log:', error);
    throw new Error('Failed to insert audit log');
  }
  return data;
}

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser, supabase: SupabaseClient) => {
  const { searchParams } = new URL(request.url);
  const organization_id = user.organizationId; // Use organizationId from authenticated user

  const event_type = searchParams.get('event_type');
  const severity = searchParams.get('severity');
  const tag = searchParams.get('tag');
  const resource_type = searchParams.get('resource_type');
  const resource_id = searchParams.get('resource_id');

  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const offset = (page - 1) * pageSize;

  let countQuery = supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organization_id);

  if (event_type) {
    countQuery = countQuery.eq('event_type', event_type);
  }
  if (severity) {
    countQuery = countQuery.eq('severity', severity);
  }
  if (tag) {
    countQuery = countQuery.contains('tags', [tag]);
  }
  if (resource_type) {
    countQuery = countQuery.eq('resource_type', resource_type);
  }
  if (resource_id) {
    countQuery = countQuery.eq('resource_id', resource_id);
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    console.error('Error fetching audit logs count:', countError);
    return NextResponse.json({ error: 'Failed to fetch audit logs count' }, { status: 500 });
  }

  const totalLogs = count || 0;

  const { data: logs, error: logsError } = await supabase.rpc('search_audit_logs', {
    p_organization_id: organization_id,
    p_limit: pageSize,
    p_offset: offset,
    ...(event_type && { p_event_type: event_type }),
    ...(severity && { p_severity: severity }),
    ...(tag && { p_tag: tag }),
    ...(resource_type && { p_resource_type: resource_type }),
    ...(resource_id && { p_resource_id: resource_id }),
  });

  if (logsError) {
    console.error('Error fetching audit logs:', logsError);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }

  // Ensure logs is an array and use the paginatedResponse helper
  return NextResponse.json(paginatedResponse(logs || [], page, pageSize, totalLogs));
}, ['admin', 'super_admin']);

export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase: SupabaseClient = await createClient(); // Create client for internal use
  const body = await request.json();

  if (!body.user_id || !body.organization_id || !body.action) {
    return NextResponse.json({ error: 'Missing required log data' }, { status: 400 });
  }

  const ip_address =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const user_agent = request.headers.get('user-agent') || 'unknown';

  try {
    const newLog = await insertAuditLog(supabase, {
      ...body,
      ip_address,
      user_agent,
    });
    return NextResponse.json({ success: true, log: newLog[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to process audit log POST request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to log audit event' },
      { status: 500 }
    );
  }
});
