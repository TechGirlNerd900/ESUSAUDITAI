-- Migration: Supabase Compatibility
-- Version: 1.2.0
-- Date: 2024-06-01
-- Description: Adds Supabase auth integration and RLS policies

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Ensure auth schema exists (Supabase requirement)
CREATE SCHEMA IF NOT EXISTS auth;

-- Modify users table to work with Supabase auth
ALTER TABLE users
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Create RLS Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view their own profile"
    ON users FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view all profiles"
    ON users FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users
        WHERE auth_user_id = auth.uid()
        AND role = 'admin'
    ));

CREATE POLICY "Admins can update all profiles"
    ON users FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM users
        WHERE auth_user_id = auth.uid()
        AND role = 'admin'
    ));

-- Projects table policies
CREATE POLICY "Users can view assigned projects"
    ON projects FOR SELECT
    USING (
        auth.uid()::text = ANY(assigned_to::text[]) OR
        created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can create projects"
    ON projects FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE
    USING (created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Documents table policies
CREATE POLICY "Users can view project documents"
    ON documents FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM projects
            WHERE auth.uid()::text = ANY(assigned_to::text[]) OR
                  created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Users can upload documents"
    ON documents FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT id FROM projects
            WHERE auth.uid()::text = ANY(assigned_to::text[]) OR
                  created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        )
    );

-- Analysis results policies
CREATE POLICY "Users can view analysis results"
    ON analysis_results FOR SELECT
    USING (
        document_id IN (
            SELECT id FROM documents
            WHERE project_id IN (
                SELECT id FROM projects
                WHERE auth.uid()::text = ANY(assigned_to::text[]) OR
                      created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
            )
        )
    );

-- Chat history policies
CREATE POLICY "Users can view project chat history"
    ON chat_history FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM projects
            WHERE auth.uid()::text = ANY(assigned_to::text[]) OR
                  created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Users can create chat messages"
    ON chat_history FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT id FROM projects
            WHERE auth.uid()::text = ANY(assigned_to::text[]) OR
                  created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        )
    );

-- Audit reports policies
CREATE POLICY "Users can view project reports"
    ON audit_reports FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM projects
            WHERE auth.uid()::text = ANY(assigned_to::text[]) OR
                  created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Users can create reports"
    ON audit_reports FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT id FROM projects
            WHERE auth.uid()::text = ANY(assigned_to::text[]) OR
                  created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        )
    );

-- Audit logs policies
CREATE POLICY "Admins can view all audit logs"
    ON audit_logs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users
        WHERE auth_user_id = auth.uid()
        AND role = 'admin'
    ));

CREATE POLICY "Users can view their own audit logs"
    ON audit_logs FOR SELECT
    USING (user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- App settings policies
CREATE POLICY "Admins can manage app settings"
    ON app_settings FOR ALL
    USING (EXISTS (
        SELECT 1 FROM users
        WHERE auth_user_id = auth.uid()
        AND role = 'admin'
    ));

CREATE POLICY "Users can view non-sensitive settings"
    ON app_settings FOR SELECT
    USING (NOT is_sensitive);

-- Functions for Supabase realtime
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (auth_user_id, email, first_name, last_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', 'New'),
        COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'auditor')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create audit log entry for this migration
INSERT INTO audit_logs (
    action,
    resource_type,
    details,
    success
) VALUES (
    'database_migration',
    'schema',
    '{"migration": "003_supabase_compatibility", "version": "1.2.0", "description": "Added Supabase auth integration and RLS policies"}'::jsonb,
    true
);

COMMIT;

-- Analyze tables for query optimization
ANALYZE users;
ANALYZE projects;
ANALYZE documents;
ANALYZE analysis_results;
ANALYZE chat_history;
ANALYZE audit_reports;
ANALYZE audit_logs;
ANALYZE app_settings;