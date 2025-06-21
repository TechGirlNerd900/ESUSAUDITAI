-- Migration 014: Create automatic user profile creation trigger
-- This ensures that every user who authenticates via Supabase auth
-- automatically gets a profile created in the users table

-- First, drop any existing trigger and function to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Add organization_id column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN organization_id UUID;
        -- Add foreign key constraint to organizations table
        ALTER TABLE public.users ADD CONSTRAINT fk_users_organization 
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add auth_user_id column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'auth_user_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN auth_user_id UUID UNIQUE;
    END IF;
END $$;

-- Create a function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    default_org_id UUID;
BEGIN
    -- Get the default organization ID (create one if it doesn't exist)
    SELECT id INTO default_org_id FROM organizations WHERE name = 'Default Organization' LIMIT 1;
    
    IF default_org_id IS NULL THEN
        INSERT INTO organizations (name, logo_url, created_at, updated_at)
        VALUES ('Default Organization', NULL, NOW(), NOW())
        RETURNING id INTO default_org_id;
    END IF;

    -- Insert new user profile
    INSERT INTO public.users (
        auth_user_id,
        organization_id,
        email,
        first_name,
        last_name,
        role,
        status,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        default_org_id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'last_name', 'Profile'),
        'auditor', -- Default role
        'active',
        true,
        NOW(),
        NOW()
    );

    -- Log the profile creation in audit_logs if the table exists
    BEGIN
        INSERT INTO audit_logs (
            organization_id,
            action,
            resource_type,
            resource_id,
            details,
            created_at
        ) VALUES (
            default_org_id,
            'user_profile_created',
            'user',
            NEW.id,
            jsonb_build_object(
                'auth_user_id', NEW.id,
                'email', NEW.email,
                'auto_created', true,
                'trigger', 'on_auth_user_created'
            ),
            NOW()
        );
    EXCEPTION 
        WHEN undefined_table THEN
            -- audit_logs table doesn't exist yet, skip logging
            NULL;
    END;

    RETURN NEW;
END;
$$;

-- Create the trigger to fire after user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions to supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT ON TABLE public.users TO supabase_auth_admin;
GRANT INSERT ON TABLE public.audit_logs TO supabase_auth_admin;
GRANT SELECT, INSERT ON TABLE public.organizations TO supabase_auth_admin;

-- Revoke permissions from other roles for security
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon, public;


ALTER TABLE public.users
ADD CONSTRAINT unique_auth_user_id UNIQUE (auth_user_id);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon, public;

-- This handles the case where users authenticated before this trigger was created
INSERT INTO public.users (
    auth_user_id,
    email,
    first_name,
    last_name,
    role,
    organization_id,
    is_active,
    created_at,
    updated_at
)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'first_name', 'Migrated User'),
    COALESCE(au.raw_user_meta_data->>'last_name', 'Profile'),
    'auditor',
    (SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1),
    true,
    au.created_at,
    NOW()
FROM auth.users au
LEFT JOIN public.users u ON u.auth_user_id = au.id
WHERE u.auth_user_id IS NULL
ON CONFLICT (auth_user_id) DO NOTHING;

-- Create index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id_active 
ON public.users(auth_user_id, is_active) 
WHERE deleted_at IS NULL;

-- Add a comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 
'Automatically creates user profile when new user signs up via Supabase Auth';