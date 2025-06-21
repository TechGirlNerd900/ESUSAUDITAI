-- Fix RLS Policies for Multi-Tenant SaaS
-- This migration fixes the broken RLS policies that reference wrong table names

BEGIN;

-- Drop existing broken RLS policies
DROP POLICY IF EXISTS org_isolation_users ON users;
DROP POLICY IF EXISTS org_isolation_projects ON projects;
DROP POLICY IF EXISTS org_isolation_documents ON documents;
DROP POLICY IF EXISTS org_isolation_analysis_results ON analysis_results;
DROP POLICY IF EXISTS org_isolation_chat_history ON chat_history;
DROP POLICY IF EXISTS org_isolation_audit_reports ON audit_reports;
DROP POLICY IF EXISTS org_isolation_audit_logs ON audit_logs;
DROP POLICY IF EXISTS org_isolation_app_settings ON app_settings;

-- Create function to get current user's organization_id from JWT
CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT organization_id 
  FROM users 
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- Create RLS policies that work with Supabase auth
-- First ensure required columns exist
DO $$
BEGIN
    -- Add organization_id to tables that need it for RLS policies
    
    -- Projects table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'organization_id') THEN
        ALTER TABLE projects ADD COLUMN organization_id UUID;
    END IF;
    
    -- Documents table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'organization_id') THEN
        ALTER TABLE documents ADD COLUMN organization_id UUID;
    END IF;
    
    -- Analysis results table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analysis_results' AND column_name = 'organization_id') THEN
        ALTER TABLE analysis_results ADD COLUMN organization_id UUID;
    END IF;
    
    -- Chat history table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_history' AND column_name = 'organization_id') THEN
        ALTER TABLE chat_history ADD COLUMN organization_id UUID;
    END IF;
    
    -- Audit reports table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_reports' AND column_name = 'organization_id') THEN
        ALTER TABLE audit_reports ADD COLUMN organization_id UUID;
    END IF;
    
    -- Audit logs table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'organization_id') THEN
        ALTER TABLE audit_logs ADD COLUMN organization_id UUID;
    END IF;
    
    -- App settings table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'organization_id') THEN
        ALTER TABLE app_settings ADD COLUMN organization_id UUID;
    END IF;
END $$;

CREATE POLICY users_org_isolation ON users
  FOR ALL
  USING (organization_id = get_current_organization_id());

CREATE POLICY projects_org_isolation ON projects
  FOR ALL
  USING (organization_id = get_current_organization_id());

CREATE POLICY documents_org_isolation ON documents
  FOR ALL
  USING (organization_id = get_current_organization_id());

CREATE POLICY analysis_results_org_isolation ON analysis_results
  FOR ALL
  USING (organization_id = get_current_organization_id());

CREATE POLICY chat_history_org_isolation ON chat_history
  FOR ALL
  USING (organization_id = get_current_organization_id());

CREATE POLICY audit_reports_org_isolation ON audit_reports
  FOR ALL
  USING (organization_id = get_current_organization_id());

CREATE POLICY audit_logs_org_isolation ON audit_logs
  FOR ALL
  USING (organization_id = get_current_organization_id());

CREATE POLICY app_settings_org_isolation ON app_settings
  FOR ALL
  USING (organization_id = get_current_organization_id());

-- Special policy for organizations table - users can only see their own org
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_own_only ON organizations
  FOR ALL
  USING (id = get_current_organization_id());

-- Allow anonymous access to organizations for invitation flow
CREATE POLICY organizations_invite_read ON organizations
  FOR SELECT
  USING (true);

COMMIT;