-- Migration to add environment configuration tables
-- This enables storing configuration in the database with proper access control

-- Create app_settings table for environment variables
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    organization_id UUID REFERENCES public.organizations(id),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add key column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'key') THEN
        ALTER TABLE public.app_settings ADD COLUMN key TEXT;
    END IF;
    
    -- Add category column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'category') THEN
        ALTER TABLE public.app_settings ADD COLUMN category TEXT NOT NULL DEFAULT 'general';
    END IF;
    
    -- Add sensitive column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'sensitive') THEN
        ALTER TABLE public.app_settings ADD COLUMN sensitive BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    
    -- Add value column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'value') THEN
        ALTER TABLE public.app_settings ADD COLUMN value TEXT;
    END IF;
    
    -- Add description column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'description') THEN
        ALTER TABLE public.app_settings ADD COLUMN description TEXT;
    END IF;
    
    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'created_by') THEN
        ALTER TABLE public.app_settings ADD COLUMN created_by UUID;
    END IF;
    
    -- Add updated_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'updated_by') THEN
        ALTER TABLE public.app_settings ADD COLUMN updated_by UUID;
    END IF;
END
$$;

-- Make key column unique if it exists and has data
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'key') THEN
        -- Only add unique constraint if key column exists and doesn't already have the constraint
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc 
                      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name 
                      WHERE tc.table_schema = 'public' AND tc.table_name = 'app_settings' 
                      AND kcu.column_name = 'key' AND tc.constraint_type = 'UNIQUE') THEN
            ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_key_unique UNIQUE (key);
        END IF;
    END IF;
END
$$;

-- Create api_integrations table for API integrations
CREATE TABLE IF NOT EXISTS public.api_integrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    api_key TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_test_result JSONB,
    organization_id UUID REFERENCES public.organizations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create health_check table for health check status
CREATE TABLE IF NOT EXISTS public.health_check (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    last_check TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'healthy',
    details JSONB DEFAULT '{}'::jsonb
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);
CREATE INDEX IF NOT EXISTS idx_app_settings_category ON public.app_settings(category);
CREATE INDEX IF NOT EXISTS idx_app_settings_organization_id ON public.app_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_integrations_type ON public.api_integrations(type);
CREATE INDEX IF NOT EXISTS idx_api_integrations_organization_id ON public.api_integrations(organization_id);

-- Enable RLS on tables
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_check ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS app_settings_select_policy ON public.app_settings;
DROP POLICY IF EXISTS app_settings_insert_policy ON public.app_settings;
DROP POLICY IF EXISTS app_settings_update_policy ON public.app_settings;
DROP POLICY IF EXISTS app_settings_delete_policy ON public.app_settings;

-- Create RLS policies for app_settings
CREATE POLICY app_settings_select_policy ON public.app_settings
    FOR SELECT
    USING (
        -- Only admins can see app settings
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
        -- Users can only see app settings for their organization or global settings
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

CREATE POLICY app_settings_insert_policy ON public.app_settings
    FOR INSERT
    WITH CHECK (
        -- Only admins can insert app settings
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
        -- Users can only insert app settings for their organization
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

CREATE POLICY app_settings_update_policy ON public.app_settings
    FOR UPDATE
    USING (
        -- Only admins can update app settings
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
        -- Users can only update app settings for their organization
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

CREATE POLICY app_settings_delete_policy ON public.app_settings
    FOR DELETE
    USING (
        -- Only admins can delete app settings
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
        -- Users can only delete app settings for their organization
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

-- Drop existing policies if they exist
DROP POLICY IF EXISTS api_integrations_select_policy ON public.api_integrations;
DROP POLICY IF EXISTS api_integrations_insert_policy ON public.api_integrations;
DROP POLICY IF EXISTS api_integrations_update_policy ON public.api_integrations;
DROP POLICY IF EXISTS api_integrations_delete_policy ON public.api_integrations;

-- Create RLS policies for api_integrations
CREATE POLICY api_integrations_select_policy ON public.api_integrations
    FOR SELECT
    USING (
        -- Only admins can see API integrations
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
        -- Users can only see API integrations for their organization or global integrations
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

CREATE POLICY api_integrations_insert_policy ON public.api_integrations
    FOR INSERT
    WITH CHECK (
        -- Only admins can insert API integrations
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
        -- Users can only insert API integrations for their organization
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

CREATE POLICY api_integrations_update_policy ON public.api_integrations
    FOR UPDATE
    USING (
        -- Only admins can update API integrations
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
        -- Users can only update API integrations for their organization
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

CREATE POLICY api_integrations_delete_policy ON public.api_integrations
    FOR DELETE
    USING (
        -- Only admins can delete API integrations
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
        -- Users can only delete API integrations for their organization
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

-- Drop existing policies if they exist
DROP POLICY IF EXISTS health_check_select_policy ON public.health_check;
DROP POLICY IF EXISTS health_check_insert_policy ON public.health_check;
DROP POLICY IF EXISTS health_check_update_policy ON public.health_check;

-- Create RLS policies for health_check
CREATE POLICY health_check_select_policy ON public.health_check
    FOR SELECT
    USING (TRUE); -- Everyone can see health check status

CREATE POLICY health_check_insert_policy ON public.health_check
    FOR INSERT
    WITH CHECK (
        -- Only admins can insert health check status
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
    );

CREATE POLICY health_check_update_policy ON public.health_check
    FOR UPDATE
    USING (
        -- Only admins can update health check status
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
    );

-- Insert initial health check record
INSERT INTO public.health_check (id, last_check, status, details)
VALUES ('00000000-0000-0000-0000-000000000000', now(), 'healthy', '{"initialSetup": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Insert default app settings
INSERT INTO public.app_settings (key, value, description, category, sensitive)
VALUES 
    ('APP_VERSION', '1.0.0', 'Application version', 'custom', FALSE),
    ('LOG_LEVEL', 'info', 'Logging level', 'monitoring', FALSE),
    ('MAX_UPLOAD_SIZE', '10485760', 'Maximum upload size in bytes (10MB)', 'custom', FALSE),
    ('DOCUMENT_RETENTION_DAYS', '90', 'Number of days to retain documents', 'custom', FALSE),
    ('ENABLE_AUDIT_LOGGING', 'true', 'Enable audit logging', 'security', FALSE)
ON CONFLICT (key) DO NOTHING;