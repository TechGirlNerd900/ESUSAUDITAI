-- Fix authentication issues and schema mismatches

-- 1. Create organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    parent_organization_id UUID REFERENCES organizations(id),
    hierarchy_path UUID[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    role VARCHAR(20) CHECK (role IN ('admin', 'auditor', 'reviewer')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE
);

-- 3. Add auth_user_id column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'auth_user_id'
    ) THEN
        ALTER TABLE users ADD COLUMN auth_user_id UUID UNIQUE;
        -- Create index for faster lookups
        CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
    END IF;
END $$;

-- 4. Add organization_id column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id);
        -- Create index for faster lookups
        CREATE INDEX idx_users_organization_id ON users(organization_id);
    END IF;
END $$;

-- 5. Add status and is_active columns to users table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'status'
    ) THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 6. Add organization_id column to other tables that need it
DO $$
BEGIN
    -- Projects table
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE projects ADD COLUMN organization_id UUID REFERENCES organizations(id);
        CREATE INDEX idx_projects_organization_id ON projects(organization_id);
    END IF;
    
    -- Documents table
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE documents ADD COLUMN organization_id UUID REFERENCES organizations(id);
        CREATE INDEX idx_documents_organization_id ON documents(organization_id);
    END IF;
    
    -- Audit reports table
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'audit_reports' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE audit_reports ADD COLUMN organization_id UUID REFERENCES organizations(id);
        CREATE INDEX idx_audit_reports_organization_id ON audit_reports(organization_id);
    END IF;
    
    -- Audit logs table
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'audit_logs' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE audit_logs ADD COLUMN organization_id UUID REFERENCES organizations(id);
        CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
    END IF;
END $$;

-- 7. Create trigger function to create user profile when auth user is created
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    auth_user_id, 
    email, 
    first_name, 
    last_name, 
    role, 
    organization_id,
    is_active,
    status
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'auditor'),
    COALESCE(NEW.raw_user_meta_data->>'organization_id', NULL)::UUID,
    true,
    'active'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't prevent user creation
  RAISE NOTICE 'Error creating user profile: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- 9. Fix app_settings table column name if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'app_settings' AND column_name = 'sensitive'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'app_settings' AND column_name = 'is_sensitive'
    ) THEN
        ALTER TABLE app_settings RENAME COLUMN sensitive TO is_sensitive;
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'app_settings' AND column_name = 'type'
    ) THEN
        ALTER TABLE app_settings ADD COLUMN type VARCHAR(50);
    END IF;
END $$;

-- 10. Set up Row Level Security (RLS) policies
-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile" 
  ON users FOR SELECT 
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile" 
  ON users FOR UPDATE 
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all users in their organization" ON users;
CREATE POLICY "Admins can view all users in their organization" 
  ON users FOR SELECT 
  USING (
    organization_id = (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()) AND
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can manage users in their organization" ON users;
CREATE POLICY "Admins can manage users in their organization" 
  ON users FOR ALL 
  USING (
    organization_id = (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()) AND
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
  );

-- Create RLS policies for projects
DROP POLICY IF EXISTS "Users can view projects in their organization" ON projects;
CREATE POLICY "Users can view projects in their organization" 
  ON projects FOR SELECT 
  USING (
    organization_id = (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()) OR
    created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
    (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(assigned_to)
  );

DROP POLICY IF EXISTS "Admins can manage projects in their organization" ON projects;
CREATE POLICY "Admins can manage projects in their organization" 
  ON projects FOR ALL 
  USING (
    organization_id = (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()) AND
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
  );

-- Create RLS policies for documents
DROP POLICY IF EXISTS "Users can view documents in their organization" ON documents;
CREATE POLICY "Users can view documents in their organization" 
  ON documents FOR SELECT 
  USING (
    organization_id = (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()) OR
    project_id IN (
      SELECT id FROM projects WHERE 
        organization_id = (SELECT organization_id FROM users WHERE auth_user_id = auth.uid()) OR
        created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
        (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(assigned_to)
    )
  );

-- 11. Update function to track user password changes if needed
CREATE OR REPLACE FUNCTION track_password_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
        NEW.password_changed_at = CURRENT_TIMESTAMP;
        NEW.failed_login_attempts = 0;
        NEW.locked_until = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';