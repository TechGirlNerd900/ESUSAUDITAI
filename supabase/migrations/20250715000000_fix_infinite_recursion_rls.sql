-- Function to get user's organization context
CREATE OR REPLACE FUNCTION get_user_organization_id(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT organization_id INTO org_id
    FROM users
    WHERE auth_user_id = user_uuid
    AND deleted_at IS NULL
    AND is_active = TRUE;
    
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Function to check if user has admin role
CREATE OR REPLACE FUNCTION is_user_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR(20);
BEGIN
    SELECT role INTO user_role
    FROM users
    WHERE auth_user_id = user_uuid
    AND deleted_at IS NULL
    AND is_active = TRUE;
    
    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Fix infinite recursion in users table RLS policies
-- This migration addresses the infinite recursion error by using a different approach
-- The existing function get_user_organization_id(user_uuid UUID) will be used

-- Drop all existing problematic RLS policies on the users table
DROP POLICY IF EXISTS "Users: Can view own info or users in same organization" ON public.users;
DROP POLICY IF EXISTS "Users: Can view own user info" ON public.users;
DROP POLICY IF EXISTS "Users: Can view other users in the same organization" ON public.users;
DROP POLICY IF EXISTS "Users: Users can view users in their organization" ON public.users;
DROP POLICY IF EXISTS "user_isolation_policy" ON public.users;

-- Create a simple, non-recursive policy for users to view their own data
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users: Can view own profile v2') THEN
        CREATE POLICY "Users: Can view own profile v2"
        ON public.users
        FOR SELECT
        TO authenticated
        USING (auth_user_id = auth.uid());
    END IF;
END
$$;

-- Create a separate policy for organization-level access using the existing function
-- Note: The function get_user_organization_id(user_uuid UUID) already exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users: Can view organization members v2') THEN
        CREATE POLICY "Users: Can view organization members v2"
        ON public.users
        FOR SELECT
        TO authenticated
        USING (
          organization_id = get_user_organization_id(auth.uid()) AND
          deleted_at IS NULL
        );
    END IF;
END
$$;

-- Create policies for INSERT, UPDATE, DELETE operations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users: Can insert own profile v2') THEN
        CREATE POLICY "Users: Can insert own profile v2"
        ON public.users
        FOR INSERT
        TO authenticated
        WITH CHECK (auth_user_id = auth.uid());
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users: Can update own profile v2') THEN
        CREATE POLICY "Users: Can update own profile v2"
        ON public.users
        FOR UPDATE
        TO authenticated
        USING (auth_user_id = auth.uid())
        WITH CHECK (auth_user_id = auth.uid());
    END IF;
END
$$;

-- Only admins can delete users (using the existing is_user_admin function)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users: Admin can delete users v2') THEN
        CREATE POLICY "Users: Admin can delete users v2"
        ON public.users
        FOR DELETE
        TO authenticated
        USING (
          is_user_admin(auth.uid())
        );
    END IF;
END
$$;

-- Ensure the existing functions have proper permissions
GRANT EXECUTE ON FUNCTION get_user_organization_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin(uuid) TO authenticated;
