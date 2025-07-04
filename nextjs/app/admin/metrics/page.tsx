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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

// Metrics interface
interface Metrics {
  timestamp: string;
  responseTime: number;
  jobs: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  database: {
    tables: Record<string, number>;
  };
  users: {
    total: number;
    active: number;
  };
  documents: {
    total: number;
    recent: number;
  };
  projects?: {
    total: number;
    recent: number;
  };
  api?: {
    last24Hours: number;
    byEndpoint: Record<string, number>;
  };
  system: {
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
    uptime: {
      seconds: number;
      minutes: number;
      hours: number;
    };
  };
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Load metrics on component mount
  useEffect(() => {
    fetchMetrics();

    // Set up refresh interval
    if (refreshInterval) {
      const interval = setInterval(() => {
        fetchMetrics();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

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
      setMetrics(data);
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
    const remainingSeconds = seconds % 60;

    const parts = [];

    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`);

    return parts.join(' ');
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">System Metrics</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <Select
            value={refreshInterval ? refreshInterval.toString() : '0'}
            onValueChange={(value) => setRefreshInterval(parseInt(value) || null)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue>Auto Refresh</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Manual Refresh</SelectItem>
              <SelectItem value="5000">5 seconds</SelectItem>
              <SelectItem value="10000">10 seconds</SelectItem>
              <SelectItem value="30000">30 seconds</SelectItem>
              <SelectItem value="60000">1 minute</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={fetchMetrics} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {metrics && (
          <div className="text-sm text-gray-500">
            Last updated: {new Date(metrics.timestamp).toLocaleString()} ({metrics.responseTime}ms)
          </div>
        )}
      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="api">API Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Activity className="h-4 w-4 mr-2" />
                    Jobs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.jobs.total}</div>
                  <p className="text-xs text-gray-500">
                    {metrics.jobs.pending} pending, {metrics.jobs.processing} processing
                  </p>
                </CardContent>
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
                    {formatBytes(metrics.system.memory.heapUsed * 1024 * 1024)}
                  </div>
                  <p className="text-xs text-gray-500">
                    Memory usage (
                    {Math.round(
                      (metrics.system.memory.heapUsed / metrics.system.memory.heapTotal) * 100
                    )}
                    %)
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No metrics data available</p>
            </div>
          )}

          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Job Queue Status</CardTitle>
                  <CardDescription>Current job queue statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Pending</span>
                      <span className="text-sm">{metrics.jobs.pending}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Processing</span>
                      <span className="text-sm">{metrics.jobs.processing}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Completed</span>
                      <span className="text-sm">{metrics.jobs.completed}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Failed</span>
                      <span className="text-sm">{metrics.jobs.failed}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total</span>
                      <span className="text-sm font-bold">{metrics.jobs.total}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Resources</CardTitle>
                  <CardDescription>Current system resource usage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Memory (RSS)</span>
                      <span className="text-sm">
                        {formatBytes(metrics.system.memory.rss * 1024 * 1024)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Heap Total</span>
                      <span className="text-sm">
                        {formatBytes(metrics.system.memory.heapTotal * 1024 * 1024)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Heap Used</span>
                      <span className="text-sm">
                        {formatBytes(metrics.system.memory.heapUsed * 1024 * 1024)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Memory Usage</span>
                      <span className="text-sm">
                        {Math.round(
                          (metrics.system.memory.heapUsed / metrics.system.memory.heapTotal) * 100
                        )}
                        %
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Uptime</span>
                      <span className="text-sm">{formatUptime(metrics.system.uptime.seconds)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="system">
          {loading && !metrics ? (
            <div className="grid grid-cols-1 gap-6 animate-pulse">
              <Card>
                <CardHeader>
                  <div className="h-5 bg-gray-200 rounded w-1/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : metrics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Memory Usage</CardTitle>
                  <CardDescription>Current memory allocation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">RSS</span>
                      <span className="text-sm">
                        {formatBytes(metrics.system.memory.rss * 1024 * 1024)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Heap Total</span>
                      <span className="text-sm">
                        {formatBytes(metrics.system.memory.heapTotal * 1024 * 1024)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Heap Used</span>
                      <span className="text-sm">
                        {formatBytes(metrics.system.memory.heapUsed * 1024 * 1024)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Usage Percentage</span>
                      <span className="text-sm">
                        {Math.round(
                          (metrics.system.memory.heapUsed / metrics.system.memory.heapTotal) * 100
                        )}
                        %
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{
                          width: `${Math.round((metrics.system.memory.heapUsed / metrics.system.memory.heapTotal) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Uptime</CardTitle>
                  <CardDescription>System uptime statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Seconds</span>
                      <span className="text-sm">
                        {metrics.system.uptime.seconds.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Minutes</span>
                      <span className="text-sm">
                        {metrics.system.uptime.minutes.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Hours</span>
                      <span className="text-sm">
                        {metrics.system.uptime.hours.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Days</span>
                      <span className="text-sm">
                        {Math.floor(metrics.system.uptime.hours / 24).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Human Readable</span>
                      <span className="text-sm">{formatUptime(metrics.system.uptime.seconds)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No system metrics available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="database">
          {loading && !metrics ? (
            <div className="animate-pulse">
              <Card>
                <CardHeader>
                  <div className="h-5 bg-gray-200 rounded w-1/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : metrics ? (
            <Card>
              <CardHeader>
                <CardTitle>Database Tables</CardTitle>
                <CardDescription>Row counts for key tables</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(metrics.database.tables).map(([table, count]) => (
                    <div key={table} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{table}</span>
                      <span className="text-sm">{count.toLocaleString()} rows</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No database metrics available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="jobs">
          {loading && !metrics ? (
            <div className="animate-pulse">
              <Card>
                <CardHeader>
                  <div className="h-5 bg-gray-200 rounded w-1/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : metrics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Job Queue Status</CardTitle>
                  <CardDescription>Current job queue statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Pending</span>
                      <span className="text-sm">{metrics.jobs.pending.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Processing</span>
                      <span className="text-sm">{metrics.jobs.processing.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Completed</span>
                      <span className="text-sm">{metrics.jobs.completed.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Failed</span>
                      <span className="text-sm">{metrics.jobs.failed.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total</span>
                      <span className="text-sm font-bold">
                        {metrics.jobs.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => (window.location.href = '/admin/jobs')}
                  >
                    View Job Queue
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Job Distribution</CardTitle>
                  <CardDescription>Visual representation of job status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium">Pending</span>
                        <span className="text-xs">
                          {Math.round((metrics.jobs.pending / metrics.jobs.total) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-yellow-400 h-2.5 rounded-full"
                          style={{
                            width: `${Math.round((metrics.jobs.pending / metrics.jobs.total) * 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium">Processing</span>
                        <span className="text-xs">
                          {Math.round((metrics.jobs.processing / metrics.jobs.total) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-blue-500 h-2.5 rounded-full"
                          style={{
                            width: `${Math.round((metrics.jobs.processing / metrics.jobs.total) * 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium">Completed</span>
                        <span className="text-xs">
                          {Math.round((metrics.jobs.completed / metrics.jobs.total) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-green-500 h-2.5 rounded-full"
                          style={{
                            width: `${Math.round((metrics.jobs.completed / metrics.jobs.total) * 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium">Failed</span>
                        <span className="text-xs">
                          {Math.round((metrics.jobs.failed / metrics.jobs.total) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-red-500 h-2.5 rounded-full"
                          style={{
                            width: `${Math.round((metrics.jobs.failed / metrics.jobs.total) * 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No job metrics available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="api">
          {loading && !metrics ? (
            <div className="animate-pulse">
              <Card>
                <CardHeader>
                  <div className="h-5 bg-gray-200 rounded w-1/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : metrics && metrics.api ? (
            <Card>
              <CardHeader>
                <CardTitle>API Usage</CardTitle>
                <CardDescription>
                  API calls in the last 24 hours: {metrics.api.last24Hours.toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Calls by Endpoint</h3>

                  {Object.entries(metrics.api.byEndpoint)
                    .sort(([, a], [, b]) => b - a) // Sort by count descending
                    .map(([endpoint, count]) => (
                      <div key={endpoint} className="flex justify-between items-center">
                        <span className="text-sm font-mono truncate max-w-md">{endpoint}</span>
                        <span className="text-sm">{count.toLocaleString()} calls</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No API metrics available</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
