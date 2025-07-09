'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// Simple modal components
const Dialog = ({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={() => onOpenChange(false)}
      role="dialog"
      onKeyDown={(e) => e.key === 'Escape' && onOpenChange(false)}
      tabIndex={0}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
};

const DialogContent = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => <div className={`bg-white rounded-lg shadow-lg p-6 ${className || ''}`}>{children}</div>;

const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4">{children}</div>
);

const DialogTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-lg font-semibold">{children}</h2>
);

const DialogDescription = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-gray-600">{children}</p>
);

const DialogFooter = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => <div className={`mt-6 ${className || ''}`}>{children}</div>;

import { toast } from '@/components/ui/use-toast';
// Icon components - using simple HTML entities
const Loader2 = ({ className }: { className?: string }) => <span className={className}>⟳</span>;
const RefreshCw = ({ className }: { className?: string }) => <span className={className}>🔄</span>;
const AlertTriangle = ({ className }: { className?: string }) => (
  <span className={className}>⚠️</span>
);
const CheckCircle = ({ className }: { className?: string }) => (
  <span className={className}>✅</span>
);
const XCircle = ({ className }: { className?: string }) => <span className={className}>❌</span>;
const Clock = ({ className }: { className?: string }) => <span className={className}>🕐</span>;
const Play = ({ className }: { className?: string }) => <span className={className}>▶️</span>;
const Trash2 = ({ className }: { className?: string }) => <span className={className}>🗑️</span>;
import { JobStatus, JobPriority } from '@/lib/jobQueue';
import { createClient } from '@/utils/supabase/client';

// Job interface
interface Job {
  id: string;
  type: string;
  priority: string | number;
  data: any;
  status: string;
  attempts: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  error?: string;
  result?: any;
  organization_id?: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobDialog, setShowJobDialog] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const supabase = createClient();

  // Load jobs on component mount
  useEffect(() => {
    loadJobs();

    // Set up refresh interval
    const interval = setInterval(() => {
      if (refreshInterval) {
        loadJobs();
      }
    }, refreshInterval || 10000);

    return () => clearInterval(interval);
  }, [selectedStatus, selectedType, refreshInterval]);

  // Load jobs from the database
  const loadJobs = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('job_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedStatus) {
        query = query.eq('status', selectedStatus);
      }

      if (selectedType) {
        query = query.eq('type', selectedType);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setJobs(data || []);

      // Extract unique job types
      const types = Array.from(new Set(data?.map((job) => job.type) || []));
      setJobTypes(types);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while loading jobs');
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while loading jobs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Retry a failed job
  const retryJob = async (jobId: string) => {
    try {
      const job = jobs.find((j) => j.id === jobId);

      if (!job) {
        throw new Error('Job not found');
      }

      // Update job status to pending
      const { error } = await supabase
        .from('job_queue')
        .update({
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) {
        throw error;
      }

      toast({
        title: 'Success',
        description: `Job ${jobId} queued for retry`,
        variant: 'default',
      });

      // Reload jobs
      loadJobs();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while retrying job',
        variant: 'destructive',
      });
    }
  };

  // Cancel a pending job
  const cancelJob = async (jobId: string) => {
    try {
      const job = jobs.find((j) => j.id === jobId);

      if (!job) {
        throw new Error('Job not found');
      }

      // Update job status to failed
      const { error } = await supabase
        .from('job_queue')
        .update({
          status: 'failed',
          error: 'Cancelled by user',
          updated_at: new Date().toISOString(),
          failed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) {
        throw error;
      }

      toast({
        title: 'Success',
        description: `Job ${jobId} cancelled`,
        variant: 'default',
      });

      // Reload jobs
      loadJobs();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while cancelling job',
        variant: 'destructive',
      });
    }
  };

  // Delete a job
  const deleteJob = async (jobId: string) => {
    if (!confirm(`Are you sure you want to delete job ${jobId}?`)) {
      return;
    }

    try {
      const { error } = await supabase.from('job_queue').delete().eq('id', jobId);

      if (error) {
        throw error;
      }

      toast({
        title: 'Success',
        description: `Job ${jobId} deleted`,
        variant: 'default',
      });

      // Reload jobs
      loadJobs();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while deleting job',
        variant: 'destructive',
      });
    }
  };

  // Clean up old jobs
  const cleanupJobs = async () => {
    if (
      !confirm(
        'Are you sure you want to clean up old jobs? This will delete all completed and failed jobs older than 7 days.'
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase.rpc('cleanup_old_jobs');

      if (error) {
        throw error;
      }

      toast({
        title: 'Success',
        description: 'Old jobs cleaned up successfully',
        variant: 'default',
      });

      // Reload jobs
      loadJobs();
    } catch (err) {
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'An error occurred while cleaning up jobs',
        variant: 'destructive',
      });
    }
  };

  // View job details
  const viewJobDetails = (job: Job) => {
    setSelectedJob(job);
    setShowJobDialog(true);
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    const statusColors: Record<string, { bg: string; icon: React.ReactNode }> = {
      pending: { bg: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3 mr-1" /> },
      processing: { bg: 'bg-blue-100 text-blue-800', icon: <Play className="w-3 h-3 mr-1" /> },
      completed: {
        bg: 'bg-green-100 text-green-800',
        icon: <CheckCircle className="w-3 h-3 mr-1" />,
      },
      failed: { bg: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3 mr-1" /> },
    };

    const { bg, icon } = statusColors[status] || { bg: 'bg-gray-100 text-gray-800', icon: null };

    return (
      <Badge className={bg}>
        {icon}
        {status}
      </Badge>
    );
  };

  // Render priority badge
  const renderPriorityBadge = (priority: string | number) => {
    // Map numeric priority values to string labels
    const priorityLabels: Record<number, string> = {
      [JobPriority.CRITICAL]: 'CRITICAL',
      [JobPriority.HIGH]: 'HIGH',
      [JobPriority.NORMAL]: 'NORMAL',
      [JobPriority.LOW]: 'LOW',
    };

    const priorityColors: Record<string, string> = {
      CRITICAL: 'bg-red-100 text-red-800',
      HIGH: 'bg-orange-100 text-orange-800',
      NORMAL: 'bg-blue-100 text-blue-800',
      LOW: 'bg-gray-100 text-gray-800',
    };

    // Convert numeric priority to string label if needed
    const priorityLabel =
      typeof priority === 'number' ? priorityLabels[priority] || 'UNKNOWN' : priority;

    return (
      <Badge className={priorityColors[priorityLabel] || 'bg-gray-100 text-gray-800'}>
        {priorityLabel}
      </Badge>
    );
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Job Queue Management</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <Select
            value={selectedStatus || ''}
            onValueChange={(value) => setSelectedStatus(value || null)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue>All Statuses</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              {Object.values(JobStatus).map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedType || ''}
            onValueChange={(value) => setSelectedType(value || null)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue>All Types</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              {jobTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

          <Button variant="outline" onClick={loadJobs} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        <Button variant="outline" onClick={cleanupJobs}>
          <Trash2 className="h-4 w-4 mr-2" />
          Clean Up Old Jobs
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p className="mt-2 text-sm text-gray-500">Loading jobs...</p>
                  </TableCell>
                </TableRow>
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-sm text-gray-500">No jobs found</p>
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => viewJobDetails(job)}
                    onKeyDown={(e) => e.key === 'Enter' && viewJobDetails(job)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for job ${job.id}`}
                  >
                    <TableCell className="font-mono text-xs">{job.id.substring(0, 8)}...</TableCell>
                    <TableCell>{job.type}</TableCell>
                    <TableCell>{renderStatusBadge(job.status)}</TableCell>
                    <TableCell>{renderPriorityBadge(job.priority)}</TableCell>
                    <TableCell>{formatDate(job.created_at)}</TableCell>
                    <TableCell>{formatDate(job.updated_at)}</TableCell>
                    <TableCell>
                      {job.attempts} / {job.max_attempts}
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex justify-end space-x-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        role="group"
                        aria-label="Job actions"
                      >
                        {job.status === 'failed' && (
                          <Button variant="outline" size="sm" onClick={() => retryJob(job.id)}>
                            Retry
                          </Button>
                        )}
                        {job.status === 'pending' && (
                          <Button variant="outline" size="sm" onClick={() => cancelJob(job.id)}>
                            Cancel
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => deleteJob(job.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showJobDialog} onOpenChange={setShowJobDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription>Detailed information about the selected job.</DialogDescription>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">ID</h3>
                  <p className="font-mono text-sm">{selectedJob.id}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Type</h3>
                  <p>{selectedJob.type}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <div>{renderStatusBadge(selectedJob.status)}</div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Priority</h3>
                  <div>{renderPriorityBadge(selectedJob.priority)}</div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Created</h3>
                  <p>{formatDate(selectedJob.created_at)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Updated</h3>
                  <p>{formatDate(selectedJob.updated_at)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Started</h3>
                  <p>{formatDate(selectedJob.started_at)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Completed</h3>
                  <p>{formatDate(selectedJob.completed_at)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Failed</h3>
                  <p>{formatDate(selectedJob.failed_at)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Attempts</h3>
                  <p>
                    {selectedJob.attempts} / {selectedJob.max_attempts}
                  </p>
                </div>
              </div>

              {selectedJob.error && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Error</h3>
                  <div className="bg-red-50 p-3 rounded-md text-red-800 font-mono text-sm overflow-auto max-h-32">
                    {selectedJob.error}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-500">Data</h3>
                <div className="bg-gray-50 p-3 rounded-md font-mono text-sm overflow-auto max-h-64">
                  <pre>{JSON.stringify(selectedJob.data, null, 2)}</pre>
                </div>
              </div>

              {selectedJob.result && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Result</h3>
                  <div className="bg-gray-50 p-3 rounded-md font-mono text-sm overflow-auto max-h-64">
                    <pre>{JSON.stringify(selectedJob.result, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div>
              {selectedJob?.status === 'failed' && (
                <Button
                  variant="outline"
                  onClick={() => {
                    retryJob(selectedJob.id);
                    setShowJobDialog(false);
                  }}
                >
                  Retry Job
                </Button>
              )}
              {selectedJob?.status === 'pending' && (
                <Button
                  variant="outline"
                  onClick={() => {
                    cancelJob(selectedJob.id);
                    setShowJobDialog(false);
                  }}
                >
                  Cancel Job
                </Button>
              )}
            </div>
            <Button onClick={() => setShowJobDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
