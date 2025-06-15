-- Enable the pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create app_settings table for configuration management
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL,
    value TEXT,
    type TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    description TEXT,
    sensitive BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);
CREATE INDEX IF NOT EXISTS idx_app_settings_type ON public.app_settings(type);

-- Add RLS policies
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only authenticated users with admin role can modify settings
CREATE POLICY "app_settings_modify_admin" ON public.app_settings
    FOR UPDATE, DELETE
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Authenticated users can read non-sensitive settings
CREATE POLICY "app_settings_read_auth" ON public.app_settings
    FOR SELECT
    TO authenticated
    USING (NOT sensitive);

-- Add unique constraint on key and type
ALTER TABLE public.app_settings 
    ADD CONSTRAINT unique_key_type UNIQUE (key, type);