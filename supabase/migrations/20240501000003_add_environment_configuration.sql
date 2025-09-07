-- Migration to add environment configuration tables
-- This enables storing configuration in the database with proper access control

-- Create app_settings table for environment variables
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB,
    setting_type VARCHAR(50) DEFAULT 'string',
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT app_settings_unique UNIQUE (organization_id, setting_key)
);

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
CREATE INDEX IF NOT EXISTS idx_app_settings_setting_key ON public.app_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_app_settings_organization_id ON public.app_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_integrations_type ON public.api_integrations(type);
CREATE INDEX IF NOT EXISTS idx_api_integrations_organization_id ON public.api_integrations(organization_id);

-- Enable RLS on tables
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_check ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for app_settings
CREATE POLICY "Admin can manage app settings" ON public.app_settings
    FOR ALL
    USING (
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

-- Create RLS policies for api_integrations
CREATE POLICY "Admin can manage API integrations" ON public.api_integrations
    FOR ALL
    USING (
        (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin')
        AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()))
    );

-- Create RLS policies for health_check
CREATE POLICY "Public can view health check" ON public.health_check
    FOR SELECT
    USING (TRUE);

CREATE POLICY "Admin can update health check" ON public.health_check
    FOR ALL
    USING ((SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'super_admin'));

-- Insert initial health check record
INSERT INTO public.health_check (id, last_check, status, details)
VALUES ('00000000-0000-0000-0000-000000000000', now(), 'healthy', '{"initialSetup": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;
