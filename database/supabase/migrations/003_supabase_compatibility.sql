-- Migration: Supabase Compatibility
-- Version: 1.4.0
-- Date: 2024-07-01
-- Description: Further enhances Supabase auth integration, RLS policies, and performance

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create auth schema if not exists (Supabase requirement)
CREATE SCHEMA IF NOT EXISTS auth;

-- Update users table for Supabase auth compatibility
ALTER TABLE public.users 
    ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS encrypted_password TEXT,
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS recovery_sent_at TIMESTAMP WITH TIME ZONE;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        auth_user_id,
        email,
        first_name,
        last_name,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NOW(),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Create function to sync user updates
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.users
    SET
        email = NEW.email,
        first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', first_name),
        last_name = COALESCE(NEW.raw_user_meta_data->>'last_name', last_name),
        updated_at = NOW()
    WHERE auth_user_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for user updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_update();

-- Add RLS (Row Level Security) policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users policy
CREATE POLICY users_policy ON public.users
    FOR ALL
    USING (
        auth_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Projects policy
CREATE POLICY projects_policy ON public.projects
    FOR ALL
    USING (
        created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
        (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(assigned_to) OR
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Documents policy
CREATE POLICY documents_policy ON public.documents
    FOR ALL
    USING (
        project_id IN (
            SELECT id FROM projects
            WHERE created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
            (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(assigned_to)
        ) OR
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Analysis results policy
CREATE POLICY analysis_results_policy ON public.analysis_results
    FOR ALL
    USING (
        document_id IN (
            SELECT id FROM documents
            WHERE project_id IN (
                SELECT id FROM projects
                WHERE created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
                (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(assigned_to)
            )
        ) OR
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Chat history policy
CREATE POLICY chat_history_policy ON public.chat_history
    FOR ALL
    USING (
        project_id IN (
            SELECT id FROM projects
            WHERE created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
            (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(assigned_to)
        ) OR
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Audit reports policy
CREATE POLICY audit_reports_policy ON public.audit_reports
    FOR ALL
    USING (
        project_id IN (
            SELECT id FROM projects
            WHERE created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
            (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(assigned_to)
        ) OR
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Audit logs policy (only accessible by admins)
CREATE POLICY audit_logs_policy ON public.audit_logs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON public.documents(project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_document_id ON public.analysis_results(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_project_id ON public.chat_history(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_project_id ON public.audit_reports(project_id);

-- Add function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;
DROP TRIGGER IF EXISTS update_analysis_results_updated_at ON public.analysis_results;
DROP TRIGGER IF EXISTS update_chat_history_updated_at ON public.chat_history;
DROP TRIGGER IF EXISTS update_audit_reports_updated_at ON public.audit_reports;
DROP TRIGGER IF EXISTS update_audit_logs_updated_at ON public.audit_logs;

-- Add updated_at triggers to all tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_results_updated_at
    BEFORE UPDATE ON public.analysis_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_history_updated_at
    BEFORE UPDATE ON public.chat_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audit_reports_updated_at
    BEFORE UPDATE ON public.audit_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audit_logs_updated_at
    BEFORE UPDATE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create audit log entry for this migration
INSERT INTO audit_logs (
    action,
    resource_type,
    details,
    success
) VALUES (
    'database_migration',
    'schema',
    '{"migration": "004_supabase_compatibility", "version": "1.4.0", "description": "Further enhanced Supabase auth integration, RLS policies, and performance"}'::jsonb,
    true
);

COMMIT;

-- Analyze tables for query optimization
ANALYZE public.users;
ANALYZE public.projects;
ANALYZE public.documents;
ANALYZE public.analysis_results;
ANALYZE public.chat_history;
ANALYZE public.audit_reports;
ANALYZE public.audit_logs;