'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { JobFilters } from '@/components/jobs/JobFilters';
import { JobsTable } from '@/components/jobs/JobsTable';
import { JobDetailsModal } from '@/components/jobs/JobDetailsModal';
import { useJobsData, Job } from '@/hooks/useJobsData';

const AlertTriangle = ({ className }: { className?: string }) => (
  <span className={className}>⚠️</span>
);

export default function JobsPage() {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobDialog, setShowJobDialog] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  const {
    jobs,
    loading,
    error,
    jobTypes,
    loadJobs,
    retryJob,
    cancelJob,
    deleteJob,
    cleanupJobs,
  } = useJobsData(selectedStatus, selectedType);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval) {
      const interval = setInterval(() => {
        loadJobs();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, loadJobs]);

  const viewJobDetails = (job: Job) => {
    setSelectedJob(job);
    setShowJobDialog(true);
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

      <JobFilters
        selectedStatus={selectedStatus}
        selectedType={selectedType}
        jobTypes={jobTypes}
        refreshInterval={refreshInterval}
        loading={loading}
        onStatusChange={setSelectedStatus}
        onTypeChange={setSelectedType}
        onRefreshIntervalChange={setRefreshInterval}
        onRefresh={loadJobs}
        onCleanup={cleanupJobs}
      />

      <JobsTable
        jobs={jobs}
        loading={loading}
        onJobClick={viewJobDetails}
        onRetry={retryJob}
        onCancel={cancelJob}
        onDelete={deleteJob}
      />

      <JobDetailsModal
        job={selectedJob}
        open={showJobDialog}
        onOpenChange={setShowJobDialog}
        onRetry={retryJob}
        onCancel={cancelJob}
      />
    </div>
  );
}
