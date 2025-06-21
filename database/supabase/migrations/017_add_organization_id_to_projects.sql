-- Add organization_id to projects table and ensure consistency

BEGIN;

-- Check if organization_id column exists in projects table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'organization_id'
    ) THEN
        -- Add organization_id column to projects table
        ALTER TABLE projects 
        ADD COLUMN organization_id UUID REFERENCES organizations(id);
        
        -- Set default organization for existing projects
        WITH default_org AS (
            SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1
        )
        UPDATE projects
        SET organization_id = (SELECT id FROM default_org)
        WHERE organization_id IS NULL;
        
        -- Make organization_id NOT NULL after setting defaults
        ALTER TABLE projects 
        ALTER COLUMN organization_id SET NOT NULL;
        
        -- Add index for performance
        CREATE INDEX idx_projects_organization_id ON projects(organization_id);
    END IF;
END $$;

-- Check if project_type column exists in projects table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'project_type'
    ) THEN
        -- Add project_type column to projects table
        ALTER TABLE projects 
        ADD COLUMN project_type VARCHAR(50) DEFAULT 'general';
    END IF;
END $$;

-- Check if deleted_at column exists in projects table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'deleted_at'
    ) THEN
        -- Add deleted_at column to projects table for soft delete
        ALTER TABLE projects 
        ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        
        -- Add index for performance
        CREATE INDEX idx_projects_deleted_at ON projects(deleted_at) 
        WHERE deleted_at IS NOT NULL;
    END IF;
END $$;

-- Create soft delete function if it doesn't exist
CREATE OR REPLACE FUNCTION soft_delete(
    table_name TEXT,
    row_id UUID,
    org_id UUID,
    user_id UUID
)
RETURNS VOID AS $$
DECLARE
    query TEXT;
BEGIN
    -- Construct and execute dynamic SQL for soft delete
    query := format('
        UPDATE %I 
        SET 
            status = ''archived'', 
            deleted_at = NOW() 
        WHERE 
            id = %L AND 
            organization_id = %L',
        table_name,
        row_id,
        org_id
    );
    
    EXECUTE query;
    
    -- Log the deletion
    INSERT INTO audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        details,
        created_at
    ) VALUES (
        user_id,
        'soft_delete',
        table_name,
        row_id,
        jsonb_build_object(
            'organization_id', org_id,
            'deleted_at', NOW()
        ),
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policy for projects if not exists
DO $$
BEGIN
    -- Drop existing policies first to avoid conflicts
    DROP POLICY IF EXISTS projects_select_policy ON projects;
    DROP POLICY IF EXISTS projects_insert_policy ON projects;
    DROP POLICY IF EXISTS projects_update_policy ON projects;
    DROP POLICY IF EXISTS projects_delete_policy ON projects;
    
    -- Enable RLS on projects table
    ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
    CREATE POLICY projects_select_policy ON projects
        FOR SELECT
        USING (
            -- Admin can see all projects
            (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
            OR
            -- Users can see projects in their organization
            organization_id IN (
                SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
            )
            OR
            -- Users can see projects they created
            created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
            OR
            -- Users can see projects they're assigned to
            (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(assigned_to)
        );
    
    CREATE POLICY projects_insert_policy ON projects
        FOR INSERT
        WITH CHECK (
            -- Admin can create projects
            (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
            OR
            -- Users can create projects in their organization
            organization_id IN (
                SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
            )
        );
    
    CREATE POLICY projects_update_policy ON projects
        FOR UPDATE
        USING (
            -- Admin can update all projects
            (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
            OR
            -- Users can update projects in their organization
            (
                organization_id IN (
                    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
                )
                AND
                (
                    -- If they created it
                    created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
                    OR
                    -- Or if they're assigned to it
                    (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(assigned_to)
                )
            )
        );
    
    CREATE POLICY projects_delete_policy ON projects
        FOR DELETE
        USING (
            -- Only admin can delete projects
            (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
            AND
            -- In their organization
            organization_id IN (
                SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
            )
        );
END $$;

COMMIT;