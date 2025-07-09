'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  Server,
  Users,
  FileText,
  Database,
  Activity,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

// Dashboard metrics interface
interface DashboardMetrics {
  users: {
    total: number;
    active: number;
    byRole: Record<string, number>;
  };
  documents: {
    total: number;
    recent: number;
    byStatus: Record<string, number>;
  };
  projects: {
    total: number;
    recent: number;
    byStatus: Record<string, number>;
  };
  system: {
    jobsTotal: number;
    jobsPending: number;
    memory: {
      used: number;
      total: number;
    };
    uptime: number;
  };
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load metrics on component mount
  useEffect(() => {
    fetchMetrics();
  }, []);

  // Fetch metrics from the API
  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/metrics');

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();

      // Transform API metrics to dashboard metrics
      const dashboardMetrics: DashboardMetrics = {
        users: {
          total: data.users.total,
          active: data.users.active,
          byRole: data.users.byRole || {},
        },
        documents: {
          total: data.documents.total,
          recent: data.documents.recent,
          byStatus: {},
        },
        projects: {
          total: data.projects?.total || 0,
          recent: data.projects?.recent || 0,
          byStatus: data.projects?.byStatus || {},
        },
        system: {
          jobsTotal: data.jobs.total,
          jobsPending: data.jobs.pending + data.jobs.processing,
          memory: {
            used: data.system.memory.heapUsed,
            total: data.system.memory.heapTotal,
          },
          uptime: data.system.uptime.seconds,
        },
      };

      setMetrics(dashboardMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching metrics');
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'An error occurred while fetching metrics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Format bytes to human-readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format uptime to human-readable format
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];

    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ');
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>

        <Button variant="outline" onClick={fetchMetrics} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : metrics ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.users.total}</div>
                <p className="text-xs text-gray-500">
                  {metrics.users.active} active in the last 7 days
                </p>
              </CardContent>
              <CardFooter className="pt-0">
                <Link href="/admin/users" className="text-xs text-blue-500 hover:underline">
                  Manage Users →
                </Link>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.documents.total}</div>
                <p className="text-xs text-gray-500">
                  {metrics.documents.recent} uploaded in the last 7 days
                </p>
              </CardContent>
              <CardFooter className="pt-0">
                <Link href="/admin/documents" className="text-xs text-blue-500 hover:underline">
                  View Documents →
                </Link>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.system.jobsTotal}</div>
                <p className="text-xs text-gray-500">
                  {metrics.system.jobsPending} currently in progress
                </p>
              </CardContent>
              <CardFooter className="pt-0">
                <Link href="/admin/jobs" className="text-xs text-blue-500 hover:underline">
                  View Job Queue →
                </Link>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Server className="h-4 w-4 mr-2" />
                  System
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatBytes(metrics.system.memory.used * 1024 * 1024)}
                </div>
                <p className="text-xs text-gray-500">
                  Memory usage (
                  {Math.round((metrics.system.memory.used / metrics.system.memory.total) * 100)}%)
                </p>
              </CardContent>
              <CardFooter className="pt-0">
                <Link href="/admin/metrics" className="text-xs text-blue-500 hover:underline">
                  View Metrics →
                </Link>
              </CardFooter>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest system activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Link href="/admin/audit-logs" className="block">
                    <Button variant="outline" className="w-full">
                      View Audit Logs
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Current system status and uptime</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Uptime</span>
                    <span className="text-sm">{formatUptime(metrics.system.uptime)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Memory Usage</span>
                    <span className="text-sm">
                      {Math.round((metrics.system.memory.used / metrics.system.memory.total) * 100)}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Pending Jobs</span>
                    <span className="text-sm">{metrics.system.jobsPending}</span>
                  </div>

                  <Link href="/admin/config" className="block">
                    <Button variant="outline" className="w-full">
                      Manage Configuration
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
                <CardDescription>Frequently used admin tools</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Link href="/admin/users">
                    <Button variant="outline" className="w-full">
                      <Users className="h-4 w-4 mr-2" />
                      User Management
                    </Button>
                  </Link>

                  <Link href="/admin/audit-logs">
                    <Button variant="outline" className="w-full">
                      <Activity className="h-4 w-4 mr-2" />
                      Audit Logs
                    </Button>
                  </Link>

                  <Link href="/admin/jobs">
                    <Button variant="outline" className="w-full">
                      <Clock className="h-4 w-4 mr-2" />
                      Job Queue
                    </Button>
                  </Link>

                  <Link href="/admin/metrics">
                    <Button variant="outline" className="w-full">
                      <Server className="h-4 w-4 mr-2" />
                      System Metrics
                    </Button>
                  </Link>

                  <Link href="/admin/config">
                    <Button variant="outline" className="w-full">
                      <Database className="h-4 w-4 mr-2" />
                      Configuration
                    </Button>
                  </Link>

                  <Link href="/api-docs">
                    <Button variant="outline" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      API Documentation
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">No metrics data available</p>
          <Button onClick={fetchMetrics} className="mt-4">
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
