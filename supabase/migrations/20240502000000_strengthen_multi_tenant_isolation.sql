-- Migration to strengthen multi-tenant isolation with organization-based RLS policies
-- This ensures proper data isolation between different organizations

-- First, ensure all tables have organization_id column
DO $$
BEGIN
    -- Check and add organization_id to tables if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'organization_id') THEN
        ALTER TABLE public.users ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'organization_id') THEN
        ALTER TABLE public.projects ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'organization_id') THEN
        ALTER TABLE public.documents ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    END IF;

    -- Changed from analysis_results to document_analysis_results to match your schema
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'document_analysis_results' AND column_name = 'organization_id') THEN
        ALTER TABLE public.document_analysis_results ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_history' AND column_name = 'organization_id') THEN
        ALTER TABLE public.chat_history ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_reports' AND column_name = 'organization_id') THEN
        ALTER TABLE public.audit_reports ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'organization_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'organization_id') THEN
        ALTER TABLE public.app_settings ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    END IF;
END
$$;

-- Create indexes for organization_id columns for better performance
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_analysis_results_organization_id ON public.document_analysis_results(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_organization_id ON public.chat_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_organization_id ON public.audit_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_organization_id ON public.app_settings(organization_id);

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create helper function to get user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT organization_id INTO org_id
    FROM public.users
    WHERE auth_user_id = auth.uid();
    
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.users
    WHERE auth_user_id = auth.uid();
    
    RETURN user_role IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS users_isolation_policy ON public.users;
DROP POLICY IF EXISTS projects_isolation_policy ON public.projects;
DROP POLICY IF EXISTS documents_isolation_policy ON public.documents;
DROP POLICY IF EXISTS document_analysis_results_isolation_policy ON public.document_analysis_results;
DROP POLICY IF EXISTS chat_history_isolation_policy ON public.chat_history;
DROP POLICY IF EXISTS audit_reports_isolation_policy ON public.audit_reports;
DROP POLICY IF EXISTS audit_logs_isolation_policy ON public.audit_logs;
DROP POLICY IF EXISTS app_settings_isolation_policy ON public.app_settings;

-- Create organization-based RLS policies for each table

-- Users table policies
CREATE POLICY users_isolation_policy ON public.users
    USING (
        -- Users can see their own profile
        auth.uid() = auth_user_id
        -- Users can see other users in their organization
        OR organization_id = public.get_user_organization_id()
        -- Super admins can see all users
        OR (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) = 'super_admin'
    );

-- Projects table policies
CREATE POLICY projects_isolation_policy ON public.projects
    USING (
        -- Users can only see projects in their organization
        organization_id = public.get_user_organization_id()
    );

-- Documents table policies
CREATE POLICY documents_isolation_policy ON public.documents
    USING (
        -- Users can only see documents in their organization
        organization_id = public.get_user_organization_id()
    );

-- Document analysis results table policies
CREATE POLICY document_analysis_results_isolation_policy ON public.document_analysis_results
    USING (
        -- Users can only see analysis results in their organization
        organization_id = public.get_user_organization_id()
    );

-- Chat history table policies
CREATE POLICY chat_history_isolation_policy ON public.chat_history
    USING (
        -- Users can only see chat history in their organization
        organization_id = public.get_user_organization_id()
    );

-- Audit reports table policies
CREATE POLICY audit_reports_isolation_policy ON public.audit_reports
    USING (
        -- Users can only see audit reports in their organization
        organization_id = public.get_user_organization_id()
    );

-- Audit logs table policies
CREATE POLICY audit_logs_isolation_policy ON public.audit_logs
    USING (
        -- Users can only see audit logs in their organization
        organization_id = public.get_user_organization_id()
        -- Only admins can see audit logs
        AND public.is_admin()
    );

-- App settings table policies
CREATE POLICY app_settings_isolation_policy ON public.app_settings
    USING (
        -- Users can only see app settings in their organization
        (organization_id = public.get_user_organization_id() OR organization_id IS NULL)
        -- Only admins can see app settings
        AND public.is_admin()
    );

-- Create insert policies to enforce organization_id
CREATE POLICY users_insert_policy ON public.users
    FOR INSERT
    WITH CHECK (
        -- Users can only insert into their organization
        organization_id = public.get_user_organization_id()
        -- Super admins can insert into any organization
        OR (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) = 'super_admin'
    );

CREATE POLICY projects_insert_policy ON public.projects
    FOR INSERT
    WITH CHECK (
        -- Users can only insert into their organization
        organization_id = public.get_user_organization_id()
    );

CREATE POLICY documents_insert_policy ON public.documents
    FOR INSERT
    WITH CHECK (
        -- Users can only insert into their organization
        organization_id = public.get_user_organization_id()
    );

CREATE POLICY document_analysis_results_insert_policy ON public.document_analysis_results
    FOR INSERT
    WITH CHECK (
        -- Users can only insert into their organization
        organization_id = public.get_user_organization_id()
    );

CREATE POLICY chat_history_insert_policy ON public.chat_history
    FOR INSERT
    WITH CHECK (
        -- Users can only insert into their organization
        organization_id = public.get_user_organization_id()
    );

CREATE POLICY audit_reports_insert_policy ON public.audit_reports
    FOR INSERT
    WITH CHECK (
        -- Users can only insert into their organization
        organization_id = public.get_user_organization_id()
    );

CREATE POLICY audit_logs_insert_policy ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        -- Users can only insert into their organization
        organization_id = public.get_user_organization_id()
    );

CREATE POLICY app_settings_insert_policy ON public.app_settings
    FOR INSERT
    WITH CHECK (
        -- Users can only insert into their organization
        organization_id = public.get_user_organization_id()
        -- Only admins can insert app settings
        AND public.is_admin()
    );

-- Create update policies to enforce organization_id
CREATE POLICY users_update_policy ON public.users
    FOR UPDATE
    USING (
        -- Users can update their own profile
        auth.uid() = auth_user_id
        -- Admins can update users in their organization
        OR (
            public.is_admin()
            AND organization_id = public.get_user_organization_id()
        )
        -- Super admins can update any user
        OR (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) = 'super_admin'
    );

CREATE POLICY projects_update_policy ON public.projects
    FOR UPDATE
    USING (
        -- Users can only update projects in their organization
        organization_id = public.get_user_organization_id()
        -- Users can only update projects they created or are assigned to
        AND (
            created_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
            OR (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) = ANY(assigned_to)
            OR public.is_admin()
        )
    );

CREATE POLICY documents_update_policy ON public.documents
    FOR UPDATE
    USING (
        -- Users can only update documents in their organization
        organization_id = public.get_user_organization_id()
        -- Users can only update documents they uploaded or in projects they're assigned to
        AND (
            uploaded_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.id = project_id
                AND (
                    p.created_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
                    OR (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) = ANY(p.assigned_to)
                )
            )
            OR public.is_admin()
        )
    );

-- Create delete policies (using soft delete)
-- Note: Soft delete validation is handled by application logic, not RLS policies
CREATE POLICY users_delete_policy ON public.users
    FOR UPDATE
    USING (
        -- Only admins can delete users
        public.is_admin()
        -- Users can only delete users in their organization
        AND organization_id = public.get_user_organization_id()
    );

CREATE POLICY projects_delete_policy ON public.projects
    FOR UPDATE
    USING (
        -- Users can only delete projects in their organization
        organization_id = public.get_user_organization_id()
        -- Users can only delete projects they created or admins
        AND (
            created_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
            OR public.is_admin()
        )
    );

CREATE POLICY documents_delete_policy ON public.documents
    FOR UPDATE
    USING (
        -- Users can only delete documents in their organization
        organization_id = public.get_user_organization_id()
        -- Users can only delete documents they uploaded or in projects they created
        AND (
            uploaded_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.id = project_id
                AND p.created_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
            )
            OR public.is_admin()
        )
    );

-- Create trigger to enforce organization_id on insert
CREATE OR REPLACE FUNCTION public.enforce_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    -- If organization_id is not set, set it to the user's organization_id
    IF NEW.organization_id IS NULL THEN
        SELECT organization_id INTO NEW.organization_id
        FROM public.users
        WHERE auth_user_id = auth.uid();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for each table
DROP TRIGGER IF EXISTS enforce_organization_id_projects ON public.projects;
CREATE TRIGGER enforce_organization_id_projects
    BEFORE INSERT ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_organization_id();

DROP TRIGGER IF EXISTS enforce_organization_id_documents ON public.documents;
CREATE TRIGGER enforce_organization_id_documents
    BEFORE INSERT ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_organization_id();

DROP TRIGGER IF EXISTS enforce_organization_id_document_analysis_results ON public.document_analysis_results;
CREATE TRIGGER enforce_organization_id_document_analysis_results
    BEFORE INSERT ON public.document_analysis_results
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_organization_id();

DROP TRIGGER IF EXISTS enforce_organization_id_chat_history ON public.chat_history;
CREATE TRIGGER enforce_organization_id_chat_history
    BEFORE INSERT ON public.chat_history
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_organization_id();

DROP TRIGGER IF EXISTS enforce_organization_id_audit_reports ON public.audit_reports;
CREATE TRIGGER enforce_organization_id_audit_reports
    BEFORE INSERT ON public.audit_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_organization_id();

DROP TRIGGER IF EXISTS enforce_organization_id_audit_logs ON public.audit_logs;
CREATE TRIGGER enforce_organization_id_audit_logs
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_organization_id();

-- Create function to validate cross-organization references
CREATE OR REPLACE FUNCTION public.validate_organization_references()
RETURNS TRIGGER AS $$
DECLARE
    project_org_id UUID;
BEGIN
    -- For documents, check that project_id belongs to the same organization
    IF TG_TABLE_NAME = 'documents' AND NEW.project_id IS NOT NULL THEN
        SELECT organization_id INTO project_org_id
        FROM public.projects
        WHERE id = NEW.project_id;
        
        IF NEW.organization_id != project_org_id THEN
            RAISE EXCEPTION 'Cross-organization reference not allowed';
        END IF;
    END IF;
    
    -- For document_analysis_results, check that document_id belongs to the same organization
    IF TG_TABLE_NAME = 'document_analysis_results' AND NEW.document_id IS NOT NULL THEN
        SELECT organization_id INTO project_org_id
        FROM public.documents
        WHERE id = NEW.document_id;
        
        IF NEW.organization_id != project_org_id THEN
            RAISE EXCEPTION 'Cross-organization reference not allowed';
        END IF;
    END IF;
    
    -- For chat_history, check that project_id belongs to the same organization
    IF TG_TABLE_NAME = 'chat_history' AND NEW.project_id IS NOT NULL THEN
        SELECT organization_id INTO project_org_id
        FROM public.projects
        WHERE id = NEW.project_id;
        
        IF NEW.organization_id != project_org_id THEN
            RAISE EXCEPTION 'Cross-organization reference not allowed';
        END IF;
    END IF;
    
    -- For audit_reports, check that project_id belongs to the same organization
    IF TG_TABLE_NAME = 'audit_reports' AND NEW.project_id IS NOT NULL THEN
        SELECT organization_id INTO project_org_id
        FROM public.projects
        WHERE id = NEW.project_id;
        
        IF NEW.organization_id != project_org_id THEN
            RAISE EXCEPTION 'Cross-organization reference not allowed';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for cross-organization validation
DROP TRIGGER IF EXISTS validate_organization_documents ON public.documents;
CREATE TRIGGER validate_organization_documents
    BEFORE INSERT OR UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_organization_references();

DROP TRIGGER IF EXISTS validate_organization_document_analysis_results ON public.document_analysis_results;
CREATE TRIGGER validate_organization_document_analysis_results
    BEFORE INSERT OR UPDATE ON public.document_analysis_results
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_organization_references();

DROP TRIGGER IF EXISTS validate_organization_chat_history ON public.chat_history;
CREATE TRIGGER validate_organization_chat_history
    BEFORE INSERT OR UPDATE ON public.chat_history
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_organization_references();

DROP TRIGGER IF EXISTS validate_organization_audit_reports ON public.audit_reports;
CREATE TRIGGER validate_organization_audit_reports
    BEFORE INSERT OR UPDATE ON public.audit_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_organization_references();

-- Add comment for documentation
COMMENT ON FUNCTION public.get_user_organization_id() IS 'Helper function to get the current user''s organization ID';
COMMENT ON FUNCTION public.is_admin() IS 'Helper function to check if the current user is an admin';
COMMENT ON FUNCTION public.enforce_organization_id() IS 'Trigger function to enforce organization_id on insert';
COMMENT ON FUNCTION public.validate_organization_references() IS 'Trigger function to validate cross-organization references';