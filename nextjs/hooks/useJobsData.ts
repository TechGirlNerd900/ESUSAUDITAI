import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from '@/components/ui/use-toast';

export interface Job {
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

export interface UseJobsDataReturn {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  jobTypes: string[];
  loadJobs: () => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  cleanupJobs: () => Promise<void>;
}

export function useJobsData(selectedStatus: string | null, selectedType: string | null): UseJobsDataReturn {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const supabase = createClient();

  const loadJobs = useCallback(async () => {
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
  }, [selectedStatus, selectedType, supabase]);

  const retryJob = async (jobId: string) => {
    try {
      const job = jobs.find((j) => j.id === jobId);

      if (!job) {
        throw new Error('Job not found');
      }

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

      await loadJobs();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while retrying job',
        variant: 'destructive',
      });
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      const job = jobs.find((j) => j.id === jobId);

      if (!job) {
        throw new Error('Job not found');
      }

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

      await loadJobs();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while cancelling job',
        variant: 'destructive',
      });
    }
  };

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

      await loadJobs();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while deleting job',
        variant: 'destructive',
      });
    }
  };

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

      await loadJobs();
    } catch (err) {
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'An error occurred while cleaning up jobs',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  return {
    jobs,
    loading,
    error,
    jobTypes,
    loadJobs,
    retryJob,
    cancelJob,
    deleteJob,
    cleanupJobs,
  };
}