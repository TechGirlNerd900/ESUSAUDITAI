import { Button } from '@/components/ui/button';
import { Job } from '@/hooks/useJobsData';
import { Trash2 } from 'lucide-react';

interface JobActionsProps {
  job: Job;
  onRetry: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  onDelete: (jobId: string) => void;
}

export function JobActions({ job, onRetry, onCancel, onDelete }: JobActionsProps) {
  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
  };

  return (
    <div className="flex justify-end space-x-2" role="group" aria-label="Job actions">
      {job.status === 'failed' && (
        <Button variant="outline" size="sm" onClick={handleAction(() => onRetry(job.id))}>
          Retry
        </Button>
      )}
      {job.status === 'pending' && (
        <Button variant="outline" size="sm" onClick={handleAction(() => onCancel(job.id))}>
          Cancel
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={handleAction(() => onDelete(job.id))}>
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  );
}
