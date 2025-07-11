import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { JobStatus } from '@/lib/jobQueue';

const Loader2 = ({ className }: { className?: string }) => <span className={className}>⟳</span>;
const RefreshCw = ({ className }: { className?: string }) => <span className={className}>🔄</span>;
const Trash2 = ({ className }: { className?: string }) => <span className={className}>🗑️</span>;

interface JobFiltersProps {
  selectedStatus: string | null;
  selectedType: string | null;
  jobTypes: string[];
  refreshInterval: number | null;
  loading: boolean;
  onStatusChange: (status: string | null) => void;
  onTypeChange: (type: string | null) => void;
  onRefreshIntervalChange: (interval: number | null) => void;
  onRefresh: () => void;
  onCleanup: () => void;
}

export function JobFilters({
  selectedStatus,
  selectedType,
  jobTypes,
  refreshInterval,
  loading,
  onStatusChange,
  onTypeChange,
  onRefreshIntervalChange,
  onRefresh,
  onCleanup,
}: JobFiltersProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center space-x-2">
        <Select
          value={selectedStatus || ''}
          onValueChange={(value) => onStatusChange(value || null)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
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
          onValueChange={(value) => onTypeChange(value || null)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
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
          onValueChange={(value) => onRefreshIntervalChange(parseInt(value) || null)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Auto Refresh" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Manual Refresh</SelectItem>
            <SelectItem value="5000">5 seconds</SelectItem>
            <SelectItem value="10000">10 seconds</SelectItem>
            <SelectItem value="30000">30 seconds</SelectItem>
            <SelectItem value="60000">1 minute</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={onRefresh} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      <Button variant="outline" onClick={onCleanup}>
        <Trash2 className="h-4 w-4 mr-2" />
        Clean Up Old Jobs
      </Button>
    </div>
  );
}