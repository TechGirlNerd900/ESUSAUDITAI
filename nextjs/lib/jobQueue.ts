export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum JobPriority {
  LOW = 4,
  NORMAL = 3,
  HIGH = 2,
  CRITICAL = 1,
}

export interface Job {
  id: string;
  type: string;
  data: any;
  priority: JobPriority;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  error?: string;
  result?: any;
}

export const queueDocumentAnalysis = async (
  documentId: string,
  userId: string,
  priority: JobPriority
): Promise<Job> => {
  // This is a mock implementation. In a real application, this would add a job to a persistent queue (e.g., Redis, RabbitMQ).
  const job: Job = {
    id: crypto.randomUUID(),
    type: 'document-analysis',
    data: { documentId, userId },
    priority,
    status: 'pending',
    attempts: 0,
    max_attempts: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return job;
};

// This is a mock implementation of a job queue.
const jobQueue: Job[] = [];

export const getJobQueue = () => {
  return {
    getJobs: () => jobQueue,
  };
};
