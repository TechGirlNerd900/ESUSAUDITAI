-- One-time migration to fix user profiles
-- This migration ensures that all auth users have corresponding profiles
-- and that all profiles have correct roles and organization assignments

-- First make sure the organizations table exists
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    parent_organization_id UUID REFERENCES organizations(id),
    hierarchy_path UUID[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create a default organization if none exists
DO $$
DECLARE
    org_count INTEGER;
    default_org_id UUID;
BEGIN
    SELECT COUNT(*) INTO org_count FROM organizations;
    
    IF org_count = 0 THEN
        INSERT INTO organizations (name)
        VALUES ('Default Organization')
        RETURNING id INTO default_org_id;
        
        RAISE NOTICE 'Created default organization with ID %', default_org_id;
    ELSE
        SELECT id INTO default_org_id FROM organizations LIMIT 1;
        RAISE NOTICE 'Using existing organization with ID %', default_org_id;
    END IF;
    
    -- Add organization_id to any users that don't have one
    UPDATE users
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;
    
    -- Create profile records for any auth users that don't have one
    INSERT INTO users (
        auth_user_id,
        email,
        first_name,
        last_name,
        role,
        organization_id,
        is_active,
        status
    )
    SELECT 
        au.id,
        au.email,
        COALESCE(au.raw_user_meta_data->>'first_name', split_part(au.email, '@', 1)),
        COALESCE(au.raw_user_meta_data->>'last_name', 'User'),
        COALESCE(au.raw_user_meta_data->>'role', 'auditor'),
        COALESCE(
            (au.raw_user_meta_data->>'organization_id')::UUID,
            default_org_id
        ),
        true,
        'active'
    FROM auth.users au
    LEFT JOIN users u ON au.id = u.auth_user_id
    WHERE u.id IS NULL;
    
    -- Update auth metadata for any users with role mismatches
    -- This requires a function since we need to update each user individually
    CREATE OR REPLACE FUNCTION temp_fix_role_mismatches() RETURNS VOID AS $$
    DECLARE
        user_rec RECORD;
    BEGIN
        FOR user_rec IN 
            SELECT 
                u.auth_user_id, 
                u.role,
                au.raw_user_meta_data->>'role' as auth_role
            FROM users u
            JOIN auth.users au ON u.auth_user_id = au.id
            WHERE 
                u.role != COALESCE(au.raw_user_meta_data->>'role', '') 
                AND u.role IS NOT NULL
        LOOP
            UPDATE auth.users
            SET raw_user_meta_data = jsonb_set(
                COALESCE(raw_user_meta_data, '{}'::jsonb),
                '{role}',
                to_jsonb(user_rec.role)
            )
            WHERE id = user_rec.auth_user_id;
            
            RAISE NOTICE 'Updated role for auth user % to %', user_rec.auth_user_id, user_rec.role;
        END LOOP;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Run the function
    PERFORM temp_fix_role_mismatches();
    
    -- Drop the temporary function
    DROP FUNCTION temp_fix_role_mismatches();
    
    -- Make sure at least one admin user exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin' AND is_active = true) THEN
        -- Try to promote the first active user to admin
        UPDATE users
        SET role = 'admin'
        WHERE id = (
            SELECT id FROM users 
            WHERE is_active = true 
            ORDER BY created_at ASC 
            LIMIT 1
        );
        
        -- Also update their auth metadata
        UPDATE auth.users
        SET raw_user_meta_data = jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{role}',
            '"admin"'
        )
        WHERE id = (
            SELECT auth_user_id FROM users 
            WHERE role = 'admin'
            LIMIT 1
        );
        
        RAISE NOTICE 'Promoted one user to admin role';
    END IF;
END $$;