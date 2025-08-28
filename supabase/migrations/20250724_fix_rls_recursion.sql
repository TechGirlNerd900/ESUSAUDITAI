-- Fix RLS Recursion Issues - Critical Security Fix
-- This migration resolves the infinite recursion problem in RLS policies

-- First, drop existing problematic policies
DROP POLICY IF EXISTS users_isolation_policy ON public.users;
DROP POLICY IF EXISTS projects_isolation_policy ON public.projects;
DROP POLICY IF EXISTS documents_isolation_policy ON public.documents;
DROP POLICY IF EXISTS document_analysis_results_isolation_policy ON public.document_analysis_results;
DROP POLICY IF EXISTS chat_history_isolation_policy ON public.chat_history;
DROP POLICY IF EXISTS audit_reports_isolation_policy ON public.audit_reports;
DROP POLICY IF EXISTS audit_logs_isolation_policy ON public.audit_logs;
DROP POLICY IF EXISTS app_settings_isolation_policy ON public.app_settings;

-- Drop existing problematic functions
DROP FUNCTION IF EXISTS public.get_user_organization_id();
DROP FUNCTION IF EXISTS public.is_admin();

-- Create NON-RECURSIVE helper functions that bypass RLS
-- These functions are marked SECURITY DEFINER and explicitly disable RLS

CREATE OR REPLACE FUNCTION public.get_user_organization_id_safe()
RETURNS UUID AS $$
DECLARE
    org_id UUID;
    current_user_id UUID;
BEGIN
    -- Get current authenticated user ID
    current_user_id := auth.uid();
    
    -- Return null if no authenticated user
    IF current_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Disable RLS for this function to prevent recursion
    SET LOCAL row_security = off;
    
    -- Get organization_id directly
    SELECT organization_id INTO org_id
    FROM public.users
    WHERE auth_user_id = current_user_id
    AND is_active = true
    AND deleted_at IS NULL;
    
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_role_safe()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
    current_user_id UUID;
BEGIN
    -- Get current authenticated user ID
    current_user_id := auth.uid();
    
    -- Return null if no authenticated user
    IF current_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Disable RLS for this function to prevent recursion
    SET LOCAL row_security = off;
    
    -- Get user role directly
    SELECT role INTO user_role
    FROM public.users
    WHERE auth_user_id = current_user_id
    AND is_active = true
    AND deleted_at IS NULL;
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.get_user_role_safe() IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create NON-RECURSIVE RLS policies using direct auth.uid() comparisons where possible

-- Users table policies - FIXED to prevent recursion
CREATE POLICY users_select_policy ON public.users
    FOR SELECT
    USING (
        -- Users can see their own profile (direct comparison, no recursion)
        auth.uid() = auth_user_id
        -- Admins can see users in their organization
        OR (
            public.get_user_role_safe() = 'admin' 
            AND organization_id = public.get_user_organization_id_safe()
        )
        -- Super admins can see all users
        OR public.get_user_role_safe() = 'super_admin'
    );

CREATE POLICY users_insert_policy ON public.users
    FOR INSERT
    WITH CHECK (
        -- Only admins can create users in their organization
        public.get_user_role_safe() IN ('admin', 'super_admin')
        AND (
            public.get_user_role_safe() = 'super_admin'
            OR organization_id = public.get_user_organization_id_safe()
        )
    );

CREATE POLICY users_update_policy ON public.users
    FOR UPDATE
    USING (
        -- Users can update their own profile
        auth.uid() = auth_user_id
        -- Admins can update users in their organization
        OR (
            public.get_user_role_safe() = 'admin'
            AND organization_id = public.get_user_organization_id_safe()
        )
        -- Super admins can update any user
        OR public.get_user_role_safe() = 'super_admin'
    );

CREATE POLICY users_delete_policy ON public.users
    FOR DELETE
    USING (
        -- Only admins can delete users in their organization
        public.get_user_role_safe() IN ('admin', 'super_admin')
        AND (
            public.get_user_role_safe() = 'super_admin'
            OR organization_id = public.get_user_organization_id_safe()
        )
        -- Users cannot delete themselves
        AND auth.uid() != auth_user_id
    );

-- Projects table policies
CREATE POLICY projects_isolation_policy ON public.projects
    FOR ALL
    USING (
        -- Users can only access projects in their organization
        organization_id = public.get_user_organization_id_safe()
    );

-- Documents table policies
CREATE POLICY documents_isolation_policy ON public.documents
    FOR ALL
    USING (
        -- Users can only access documents in their organization
        organization_id = public.get_user_organization_id_safe()
    );

-- Document analysis results policies
CREATE POLICY document_analysis_results_isolation_policy ON public.document_analysis_results
    FOR ALL
    USING (
        -- Users can only access analysis results in their organization
        organization_id = public.get_user_organization_id_safe()
    );

-- Chat history policies
CREATE POLICY chat_history_isolation_policy ON public.chat_history
    FOR ALL
    USING (
        -- Users can only access chat history in their organization
        organization_id = public.get_user_organization_id_safe()
    );

-- Audit reports policies
CREATE POLICY audit_reports_isolation_policy ON public.audit_reports
    FOR ALL
    USING (
        -- Users can only access audit reports in their organization
        organization_id = public.get_user_organization_id_safe()
    );

-- Audit logs policies - Admins only
CREATE POLICY audit_logs_admin_policy ON public.audit_logs
    FOR ALL
    USING (
        -- Only admins can access audit logs in their organization
        public.get_user_role_safe() IN ('admin', 'super_admin')
        AND (
            public.get_user_role_safe() = 'super_admin'
            OR organization_id = public.get_user_organization_id_safe()
        )
    );

-- App settings policies
CREATE POLICY app_settings_isolation_policy ON public.app_settings
    FOR ALL
    USING (
        -- Users can only access app settings in their organization
        organization_id = public.get_user_organization_id_safe()
    );

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_user_organization_id_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_safe() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.get_user_organization_id_safe() IS 'Safely gets user organization ID without RLS recursion';
COMMENT ON FUNCTION public.get_user_role_safe() IS 'Safely gets user role without RLS recursion';
COMMENT ON FUNCTION public.is_admin_safe() IS 'Safely checks admin status without RLS recursion';

-- Update any triggers that might use the old functions
-- (This ensures compatibility with existing code)

-- Create backward compatibility functions (deprecated but functional)
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID AS $$
BEGIN
    RETURN public.get_user_organization_id_safe();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.is_admin_safe();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;