-- Migration to add job queue table
-- This enables persistent job storage and recovery

-- Adding required extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create job_queue table
CREATE TABLE IF NOT EXISTS public.job_queue (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    priority TEXT NOT NULL,
    data JSONB NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    result JSONB,
    organization_id UUID REFERENCES public.organizations(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON public.job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_type ON public.job_queue(type);
CREATE INDEX IF NOT EXISTS idx_job_queue_priority ON public.job_queue(priority);
CREATE INDEX IF NOT EXISTS idx_job_queue_created_at ON public.job_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_organization_id ON public.job_queue(organization_id);

-- Enable RLS on job_queue table
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for job_queue
CREATE POLICY job_queue_select_policy ON public.job_queue
    FOR SELECT
    USING (
        -- Only admins can see jobs
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
        -- Users can only see jobs for their organization
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

CREATE POLICY job_queue_insert_policy ON public.job_queue
    FOR INSERT
    WITH CHECK (
        -- Only authenticated users can insert jobs
        auth.uid() IS NOT NULL
        -- Users can only insert jobs for their organization
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

CREATE POLICY job_queue_update_policy ON public.job_queue
    FOR UPDATE
    USING (
        -- Only authenticated users can update jobs
        auth.uid() IS NOT NULL
        -- Users can only update jobs for their organization
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

CREATE POLICY job_queue_delete_policy ON public.job_queue
    FOR DELETE
    USING (
        -- Only admins can delete jobs
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
        -- Users can only delete jobs for their organization
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

-- Create function to clean up old jobs
CREATE OR REPLACE FUNCTION public.cleanup_old_jobs()
RETURNS void AS $$
BEGIN
    -- Delete completed and failed jobs older than 7 days
    DELETE FROM public.job_queue
    WHERE (status = 'completed' OR status = 'failed')
    AND updated_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up old jobs daily
-- Note: This requires pg_cron extension to be enabled
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pg_cron'
    ) THEN
        -- Schedule job to run daily at 3 AM
        PERFORM cron.schedule('0 3 * * *', 'SELECT public.cleanup_old_jobs()');
    END IF;
END $$;