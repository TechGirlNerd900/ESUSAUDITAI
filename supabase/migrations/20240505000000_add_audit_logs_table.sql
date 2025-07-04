-- Migration to add audit logs table
-- This enables comprehensive audit logging for security and compliance

-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    organization_id UUID REFERENCES public.organizations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON public.audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs(organization_id);

-- Enable RLS on audit_logs table
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for audit_logs
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        -- Any authenticated user can create audit logs
        auth.uid() IS NOT NULL
        -- Users can only create audit logs for their organization
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

CREATE POLICY audit_logs_select_policy ON public.audit_logs
    FOR SELECT
    USING (
        -- Only admins can view audit logs
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
        -- Users can only view audit logs for their organization
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

-- Create function to log actions
CREATE OR REPLACE FUNCTION public.log_action(
    p_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id TEXT,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_organization_id UUID;
    v_log_id UUID;
BEGIN
    -- Get user's organization ID
    SELECT organization_id INTO v_organization_id
    FROM public.users
    WHERE id = p_user_id;
    
    -- Insert audit log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        details,
        ip_address,
        user_agent,
        organization_id
    ) VALUES (
        p_user_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_details,
        p_ip_address,
        p_user_agent,
        v_organization_id
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clean up old audit logs
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(retention_days INTEGER DEFAULT 365)
RETURNS void AS $$
BEGIN
    -- Delete audit logs older than retention_days
    DELETE FROM public.audit_logs
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up old audit logs annually
-- Note: This requires pg_cron extension to be enabled
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pg_cron'
    ) THEN
        -- Schedule job to run on the first day of each year at 2 AM
        PERFORM cron.schedule('0 2 1 1 *', 'SELECT public.cleanup_old_audit_logs()');
    END IF;
END $$;

-- Create triggers to automatically log database changes

-- Function to create audit log from trigger
CREATE OR REPLACE FUNCTION public.create_audit_log_from_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_user_id UUID;
    v_details JSONB;
BEGIN
    -- Determine action
    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'delete';
    END IF;
    
    -- Get user ID from auth.uid() or use system user ID for background operations
    v_user_id := COALESCE(
        auth.uid(),
        '00000000-0000-0000-0000-000000000000'::UUID
    );
    
    -- Create details JSON
    IF TG_OP = 'INSERT' THEN
        v_details := jsonb_build_object('new', row_to_json(NEW)::jsonb);
    ELSIF TG_OP = 'UPDATE' THEN
        v_details := jsonb_build_object(
            'old', row_to_json(OLD)::jsonb,
            'new', row_to_json(NEW)::jsonb,
            'changed_fields', (
                SELECT jsonb_object_agg(key, value)
                FROM jsonb_each(row_to_json(NEW)::jsonb)
                WHERE NOT (row_to_json(OLD)::jsonb ? key AND row_to_json(OLD)::jsonb->key = value)
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        v_details := jsonb_build_object('old', row_to_json(OLD)::jsonb);
    END IF;
    
    -- Log the action
    PERFORM public.log_action(
        v_user_id,
        v_action,
        TG_TABLE_NAME,
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT
            ELSE NEW.id::TEXT
        END,
        v_details
    );
    
    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for important tables
CREATE TRIGGER audit_projects_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.create_audit_log_from_trigger();

CREATE TRIGGER audit_documents_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.create_audit_log_from_trigger();

CREATE TRIGGER audit_analysis_results_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.analysis_results
FOR EACH ROW EXECUTE FUNCTION public.create_audit_log_from_trigger();

CREATE TRIGGER audit_users_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.create_audit_log_from_trigger();

-- Add comment for documentation
COMMENT ON TABLE public.audit_logs IS 'Stores audit logs for all system actions';
COMMENT ON FUNCTION public.log_action IS 'Helper function to create audit logs';
COMMENT ON FUNCTION public.cleanup_old_audit_logs IS 'Function to clean up old audit logs';
COMMENT ON FUNCTION public.create_audit_log_from_trigger IS 'Trigger function to automatically create audit logs';