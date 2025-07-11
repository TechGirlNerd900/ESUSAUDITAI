import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Job } from '@/hooks/useJobsData';
import { JobPriority } from '@/lib/jobQueue';

const CheckCircle = ({ className }: { className?: string }) => <span className={className}>✅</span>;
const XCircle = ({ className }: { className?: string }) => <span className={className}>❌</span>;
const Clock = ({ className }: { className?: string }) => <span className={className}>🕐</span>;
const Play = ({ className }: { className?: string }) => <span className={className}>▶️</span>;

interface JobDetailsModalProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: (jobId: string) => void;
  onCancel: (jobId: string) => void;
}

export function JobDetailsModal({ job, open, onOpenChange, onRetry, onCancel }: JobDetailsModalProps) {
  if (!job) return null;

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

  const renderPriorityBadge = (priority: string | number) => {
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

    const priorityLabel =
      typeof priority === 'number' ? priorityLabels[priority] || 'UNKNOWN' : priority;

    return (
      <Badge className={priorityColors[priorityLabel] || 'bg-gray-100 text-gray-800'}>
        {priorityLabel}
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Job Details</DialogTitle>
          <DialogDescription>Detailed information about the selected job.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">ID</h3>
              <p className="font-mono text-sm">{job.id}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Type</h3>
              <p>{job.type}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <div>{renderStatusBadge(job.status)}</div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Priority</h3>
              <div>{renderPriorityBadge(job.priority)}</div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Created</h3>
              <p>{formatDate(job.created_at)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Updated</h3>
              <p>{formatDate(job.updated_at)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Started</h3>
              <p>{formatDate(job.started_at)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Completed</h3>
              <p>{formatDate(job.completed_at)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Failed</h3>
              <p>{formatDate(job.failed_at)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Attempts</h3>
              <p>
                {job.attempts} / {job.max_attempts}
              </p>
            </div>
          </div>

          {job.error && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Error</h3>
              <div className="bg-red-50 p-3 rounded-md text-red-800 font-mono text-sm overflow-auto max-h-32">
                {job.error}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-500">Data</h3>
            <div className="bg-gray-50 p-3 rounded-md font-mono text-sm overflow-auto max-h-64">
              <pre>{JSON.stringify(job.data, null, 2)}</pre>
            </div>
          </div>

          {job.result && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Result</h3>
              <div className="bg-gray-50 p-3 rounded-md font-mono text-sm overflow-auto max-h-64">
                <pre>{JSON.stringify(job.result, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {job.status === 'failed' && (
              <Button
                variant="outline"
                onClick={() => {
                  onRetry(job.id);
                  onOpenChange(false);
                }}
              >
                Retry Job
              </Button>
            )}
            {job.status === 'pending' && (
              <Button
                variant="outline"
                onClick={() => {
                  onCancel(job.id);
                  onOpenChange(false);
                }}
              >
                Cancel Job
              </Button>
            )}
          </div>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}