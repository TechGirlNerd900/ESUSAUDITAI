import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { withErrorHandling, AuthorizationError } from '@/lib/errorHandler';
import { getJobQueue } from '@/lib/jobQueue';

/**
 * GET handler for metrics
 * Returns system metrics for monitoring
 * Restricted to admin users only
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Initialize Supabase client
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new AuthorizationError('Authentication required to access metrics');
  }

  // Check if user is admin
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  if (userError || !userProfile) {
    throw new AuthorizationError('User profile not found');
  }

  if (userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
    throw new AuthorizationError('Admin privileges required to access metrics');
  }

  // Get metrics from various sources
  const metrics = await collectMetrics(supabase);

  return NextResponse.json(metrics);
});

/**
 * Collect metrics from various sources
 * @param supabase Supabase client
 * @returns Collected metrics
 */
async function collectMetrics(supabase: any): Promise<any> {
  const startTime = Date.now();

  // Get job queue metrics
  const jobQueue = getJobQueue();
  const jobs = jobQueue.getJobs();

  const jobMetrics = {
    total: jobs.length,
    pending: jobs.filter((job) => job.status === 'pending').length,
    processing: jobs.filter((job) => job.status === 'processing').length,
    completed: jobs.filter((job) => job.status === 'completed').length,
    failed: jobs.filter((job) => job.status === 'failed').length,
  };

  // Get database metrics
  const dbMetrics = await getDatabaseMetrics(supabase);

  // Get user metrics
  const userMetrics = await getUserMetrics(supabase);

  // Get document metrics
  const documentMetrics = await getDocumentMetrics(supabase);

  // Get project metrics
  const projectMetrics = await getProjectMetrics(supabase);

  // Get API usage metrics
  const apiMetrics = await getApiMetrics(supabase);

  // Get system metrics
  const systemMetrics = getSystemMetrics();

  return {
    timestamp: new Date().toISOString(),
    responseTime: Date.now() - startTime,
    jobs: jobMetrics,
    database: dbMetrics,
    users: userMetrics,
    documents: documentMetrics,
    projects: projectMetrics,
    api: apiMetrics,
    system: systemMetrics,
  };
}

/**
 * Get database metrics
 * @param supabase Supabase client
 * @returns Database metrics
 */
async function getDatabaseMetrics(supabase: any): Promise<any> {
  // Get row counts for key tables
  const tables = [
    'users',
    'projects',
    'documents',
    'analysis_results',
    'chat_history',
    'audit_reports',
    'audit_logs',
  ];

  const counts: Record<string, number> = {};

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });

    counts[table] = error ? -1 : count || 0;
  }

  // Get storage metrics
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

  const storage = {
    buckets: bucketsError ? [] : buckets || [],
    bucketCount: bucketsError ? 0 : buckets?.length || 0,
  };

  return {
    tables: counts,
    storage,
  };
}

/**
 * Get user metrics
 * @param supabase Supabase client
 * @returns User metrics
 */
async function getUserMetrics(supabase: any): Promise<any> {
  // Get total user count
  const { count: totalUsers, error: totalError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  // Get active users in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count: activeUsers, error: activeError } = await supabase
    .from('audit_logs')
    .select('user_id', { count: 'exact', head: true })
    .gt('created_at', sevenDaysAgo.toISOString())
    .not('user_id', 'is', null);

  // Get user count by role
  const { data: roleData, error: roleError } = await supabase
    .from('users')
    .select('role')
    .not('role', 'is', null);

  const roleCount: Record<string, number> = {};

  if (!roleError && roleData) {
    for (const user of roleData) {
      roleCount[user.role] = (roleCount[user.role] || 0) + 1;
    }
  }

  return {
    total: totalError ? -1 : totalUsers || 0,
    active: activeError ? -1 : activeUsers || 0,
    byRole: roleCount,
  };
}

/**
 * Get document metrics
 * @param supabase Supabase client
 * @returns Document metrics
 */
async function getDocumentMetrics(supabase: any): Promise<any> {
  // Get total document count
  const { count: totalDocuments, error: totalError } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true });

  // Get document count by status
  const { data: statusData, error: statusError } = await supabase
    .from('documents')
    .select('status')
    .not('status', 'is', null);

  const statusCount: Record<string, number> = {};

  if (!statusError && statusData) {
    for (const doc of statusData) {
      statusCount[doc.status] = (statusCount[doc.status] || 0) + 1;
    }
  }

  // Get documents uploaded in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count: recentDocuments, error: recentError } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .gt('created_at', sevenDaysAgo.toISOString());

  return {
    total: totalError ? -1 : totalDocuments || 0,
    recent: recentError ? -1 : recentDocuments || 0,
    byStatus: statusCount,
  };
}

/**
 * Get project metrics
 * @param supabase Supabase client
 * @returns Project metrics
 */
async function getProjectMetrics(supabase: any): Promise<any> {
  // Get total project count
  const { count: totalProjects, error: totalError } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true });

  // Get project count by status
  const { data: statusData, error: statusError } = await supabase
    .from('projects')
    .select('status')
    .not('status', 'is', null);

  const statusCount: Record<string, number> = {};

  if (!statusError && statusData) {
    for (const project of statusData) {
      statusCount[project.status] = (statusCount[project.status] || 0) + 1;
    }
  }

  // Get projects created in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count: recentProjects, error: recentError } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .gt('created_at', thirtyDaysAgo.toISOString());

  return {
    total: totalError ? -1 : totalProjects || 0,
    recent: recentError ? -1 : recentProjects || 0,
    byStatus: statusCount,
  };
}

/**
 * Get API usage metrics
 * @param supabase Supabase client
 * @returns API usage metrics
 */
async function getApiMetrics(supabase: any): Promise<any> {
  // Get API calls in the last 24 hours
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const { count: apiCalls24h, error: apiError24h } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .gt('created_at', oneDayAgo.toISOString())
    .eq('resource_type', 'api');

  // Get API calls by endpoint
  const { data: endpointData, error: endpointError } = await supabase
    .from('audit_logs')
    .select('request_path')
    .gt('created_at', oneDayAgo.toISOString())
    .eq('resource_type', 'api');

  const endpointCount: Record<string, number> = {};

  if (!endpointError && endpointData) {
    for (const log of endpointData) {
      if (log.request_path) {
        endpointCount[log.request_path] = (endpointCount[log.request_path] || 0) + 1;
      }
    }
  }

  return {
    last24Hours: apiError24h ? -1 : apiCalls24h || 0,
    byEndpoint: endpointCount,
  };
}

/**
 * Get system metrics
 * @returns System metrics
 */
function getSystemMetrics(): any {
  // Get memory usage
  const memoryUsage = process.memoryUsage();

  // Get uptime
  const uptime = process.uptime();

  // Get Node.js version
  const nodeVersion = process.version;

  return {
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024), // RSS in MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // Heap total in MB
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // Heap used in MB
      external: Math.round(memoryUsage.external / 1024 / 1024), // External in MB
    },
    uptime: {
      seconds: Math.round(uptime),
      minutes: Math.round(uptime / 60),
      hours: Math.round(uptime / 60 / 60),
    },
    nodeVersion,
  };
}
