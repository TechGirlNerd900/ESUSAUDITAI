import { Card, CardContent } from '@/app/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { JobActions } from './JobActions';
import { Job } from '@/hooks/useJobsData';
import { JobPriority } from '@/lib/jobQueue';

const Loader2 = ({ className }: { className?: string }) => <span className={className}>⟳</span>;
const CheckCircle = ({ className }: { className?: string }) => (
  <span className={className}>✅</span>
);
const XCircle = ({ className }: { className?: string }) => <span className={className}>❌</span>;
const Clock = ({ className }: { className?: string }) => <span className={className}>🕐</span>;
const Play = ({ className }: { className?: string }) => <span className={className}>▶️</span>;

interface JobsTableProps {
  jobs: Job[];
  loading: boolean;
  onJobClick: (job: Job) => void;
  onRetry: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  onDelete: (jobId: string) => void;
}

export function JobsTable({
  jobs,
  loading,
  onJobClick,
  onRetry,
  onCancel,
  onDelete,
}: JobsTableProps) {
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
                  onClick={() => onJobClick(job)}
                  onKeyDown={(e) => e.key === 'Enter' && onJobClick(job)}
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
                    <JobActions
                      job={job}
                      onRetry={onRetry}
                      onCancel={onCancel}
                      onDelete={onDelete}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
