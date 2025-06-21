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

-- Add type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_settings' 
        AND column_name = 'type'
    ) THEN
        ALTER TABLE public.app_settings ADD COLUMN type TEXT DEFAULT 'general';
    END IF;
END $$;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);
CREATE INDEX IF NOT EXISTS idx_app_settings_type ON public.app_settings(type);

-- Add RLS policies
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can update app settings" 
ON public.app_settings 
FOR UPDATE 
TO authenticated 
USING ((select auth.jwt() ->> 'role') = 'admin') 
WITH CHECK ((select auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Admin users can delete app settings" 
ON public.app_settings 
FOR DELETE 
TO authenticated 
USING ((select auth.jwt() ->> 'role') = 'admin');

-- Authenticated users can read non-sensitive settings
CREATE POLICY "app_settings_read_auth" 
ON public.app_settings 
FOR SELECT 
TO authenticated 
USING (NOT is_sensitive);

-- Add unique constraint on key and type
ALTER TABLE public.app_settings 
    ADD CONSTRAINT unique_key_type UNIQUE (key, type);