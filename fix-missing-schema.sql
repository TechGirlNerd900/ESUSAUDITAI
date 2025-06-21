-- Missing Schema Elements Script
-- Run this to fix 500 signup errors

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'auditor',
    token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    invited_by UUID REFERENCES users(id),
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_organization ON invitations(organization_id);

-- Create missing RPC functions (transaction stubs)
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS void AS $$
BEGIN
    -- Transaction stub - implement based on your needs
    NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS void AS $$
BEGIN
    -- Transaction stub - implement based on your needs
    NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS void AS $$
BEGIN
    -- Transaction stub - implement based on your needs
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Add organization_id to existing tables if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id);
        CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE audit_logs ADD COLUMN organization_id UUID REFERENCES organizations(id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_organization ON audit_logs(organization_id);
    END IF;
END $$;

-- Update existing projects table if it doesn't have organization_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE projects ADD COLUMN organization_id UUID REFERENCES organizations(id);
        CREATE INDEX IF NOT EXISTS idx_projects_organization ON projects(organization_id);
    END IF;
END $$;
