/**
 * Job Queue System for Background Processing
 *
 * This module provides a simple in-memory job queue system for background processing.
 * In production, you would use a more robust solution like Bull/BullMQ with Redis.
 */

import { EventEmitter } from 'events';
import { withRetry } from './errorHandler';

// Job status enum
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// Job priority enum
export enum JobPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

// Job interface
export interface Job<T = any, R = any> {
  id: string;
  type: string;
  data: T;
  priority: JobPriority;
  status: JobStatus;
  result?: R;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
}

// Job processor function type
export type JobProcessor<T = any, R = any> = (job: Job<T>) => Promise<R>;

// Job queue options
export interface JobQueueOptions {
  concurrency?: number;
  defaultMaxAttempts?: number;
  pollInterval?: number;
}

/**
 * In-memory job queue implementation
 * In production, use a distributed queue like Bull/BullMQ with Redis
 */
export class JobQueue extends EventEmitter {
  private queue: Job[] = [];
  private processing: Set<string> = new Set();
  private processors: Map<string, JobProcessor> = new Map();
  private running: boolean = false;
  private concurrency: number;
  private defaultMaxAttempts: number;
  private pollInterval: number;
  private pollTimeout?: NodeJS.Timeout | undefined;

  constructor(options: JobQueueOptions = {}) {
    super();
    this.concurrency = options.concurrency || 3;
    this.defaultMaxAttempts = options.defaultMaxAttempts || 3;
    this.pollInterval = options.pollInterval || 1000;
  }

  /**
   * Register a job processor for a specific job type
   * @param jobType The job type to register the processor for
   * @param processor The processor function
   */
  registerProcessor<T = any, R = any>(jobType: string, processor: JobProcessor<T, R>): void {
    this.processors.set(jobType, processor as JobProcessor);
  }

  /**
   * Add a job to the queue
   * @param jobType The type of job
   * @param data The job data
   * @param options Job options
   * @returns The created job
   */
  async addJob<T = any>(
    jobType: string,
    data: T,
    options: {
      priority?: JobPriority;
      maxAttempts?: number;
    } = {}
  ): Promise<Job<T>> {
    const { priority = JobPriority.NORMAL, maxAttempts = this.defaultMaxAttempts } = options;

    const job: Job<T> = {
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: jobType,
      data,
      priority,
      status: JobStatus.PENDING,
      attempts: 0,
      maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.queue.push(job);

    // Sort queue by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);

    this.emit('job:added', job);

    // Start processing if not already running
    if (!this.running) {
      this.start();
    }

    return job;
  }

  /**
   * Get a job by ID
   * @param jobId The job ID
   * @returns The job or undefined if not found
   */
  getJob<T = any, R = any>(jobId: string): Job<T, R> | undefined {
    return this.queue.find((job) => job.id === jobId) as Job<T, R> | undefined;
  }

  /**
   * Get all jobs
   * @param filter Optional filter function
   * @returns Array of jobs
   */
  getJobs<T = any, R = any>(filter?: (job: Job) => boolean): Job<T, R>[] {
    if (filter) {
      return this.queue.filter(filter) as Job<T, R>[];
    }
    return [...this.queue] as Job<T, R>[];
  }

  /**
   * Start the job queue processing
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.processNextJobs();
  }

  /**
   * Stop the job queue processing
   */
  stop(): void {
    this.running = false;

    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = undefined;
    }
  }

  /**
   * Process the next jobs in the queue
   */
  private processNextJobs(): void {
    if (!this.running) return;

    // Find pending jobs that can be processed
    const pendingJobs = this.queue.filter(
      (job) => job.status === JobStatus.PENDING && !this.processing.has(job.id)
    );

    // Calculate how many more jobs we can process
    const availableSlots = Math.max(0, this.concurrency - this.processing.size);

    // Process up to availableSlots jobs
    const jobsToProcess = pendingJobs.slice(0, availableSlots);

    // Process each job
    jobsToProcess.forEach((job) => {
      this.processJob(job);
    });

    // Schedule next processing round
    this.pollTimeout = setTimeout(() => {
      this.processNextJobs();
    }, this.pollInterval);
  }

  /**
   * Process a single job
   * @param job The job to process
   */
  private async processJob(job: Job): Promise<void> {
    // Mark job as processing
    job.status = JobStatus.PROCESSING;
    job.attempts += 1;
    job.startedAt = new Date();
    job.updatedAt = new Date();
    this.processing.add(job.id);

    this.emit('job:processing', job);

    // Get the processor for this job type
    const processor = this.processors.get(job.type);

    if (!processor) {
      job.status = JobStatus.FAILED;
      job.error = `No processor registered for job type: ${job.type}`;
      job.failedAt = new Date();
      job.updatedAt = new Date();
      this.processing.delete(job.id);
      this.emit('job:failed', job);
      return;
    }

    try {
      // Process the job with retry logic
      const result = await withRetry(() => processor(job), {
        maxRetries: 0, // We handle retries at the job level
        shouldRetry: () => false,
      });

      // Mark job as completed
      job.status = JobStatus.COMPLETED;
      job.result = result;
      job.completedAt = new Date();
      job.updatedAt = new Date();
      this.emit('job:completed', job);
    } catch (error) {
      // Check if we should retry
      if (job.attempts < job.maxAttempts) {
        // Reset job to pending for retry
        job.status = JobStatus.PENDING;
        job.error = error instanceof Error ? error.message : String(error);
        job.updatedAt = new Date();
        this.emit('job:retry', job);
      } else {
        // Mark job as failed
        job.status = JobStatus.FAILED;
        job.error = error instanceof Error ? error.message : String(error);
        job.failedAt = new Date();
        job.updatedAt = new Date();
        this.emit('job:failed', job);
      }
    } finally {
      // Remove job from processing set
      this.processing.delete(job.id);
    }
  }

  /**
   * Clean up completed and failed jobs
   * @param maxAge Maximum age in milliseconds
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();

    this.queue = this.queue.filter((job) => {
      // Keep all pending and processing jobs
      if (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
        return true;
      }

      // Keep completed and failed jobs that are newer than maxAge
      const jobDate = job.completedAt || job.failedAt || job.createdAt;
      return now - jobDate.getTime() < maxAge;
    });
  }
}

// Create a singleton instance
const defaultQueue = new JobQueue();

/**
 * Get the default job queue instance
 * @returns The default job queue
 */
export function getJobQueue(): JobQueue {
  return defaultQueue;
}

/**
 * Create a new job queue instance
 * @param options Job queue options
 * @returns A new job queue
 */
export function createJobQueue(options: JobQueueOptions = {}): JobQueue {
  return new JobQueue(options);
}

// Document analysis job processor example
export async function registerDocumentAnalysisProcessor(
  processor: JobProcessor<{ documentId: string; userId: string }>
): Promise<void> {
  defaultQueue.registerProcessor('document:analyze', processor);
}

// Export a function to add a document analysis job
export async function queueDocumentAnalysis(
  documentId: string,
  userId: string,
  priority: JobPriority = JobPriority.NORMAL
): Promise<Job<{ documentId: string; userId: string }>> {
  return defaultQueue.addJob('document:analyze', { documentId, userId }, { priority });
}

// Start the default queue
defaultQueue.start();

// Handle process exit to stop the queue
process.on('exit', () => {
  defaultQueue.stop();
});

// Export the job queue
export default defaultQueue;
