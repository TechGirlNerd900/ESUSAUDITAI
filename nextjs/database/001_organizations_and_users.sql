-- Organizations and Users Schema
-- Implements multi-tenant isolation and RBAC for Admin/Auditor/Reviewer roles

-- Organizations table - root of multi-tenant structure
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    parent_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    hierarchy_path UUID[] DEFAULT ARRAY[]::UUID[], -- For hierarchical organization structures
    settings JSONB DEFAULT '{}', -- Organization-specific settings
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- Soft delete
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for organizations
CREATE INDEX idx_organizations_parent ON organizations(parent_organization_id);
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_organizations_deleted ON organizations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_hierarchy ON organizations USING GIN(hierarchy_path);

-- Users table - implements RBAC with strict organization isolation
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL UNIQUE, -- Links to Supabase auth.users
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL, -- RFC 5321 max email length
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'auditor', 'reviewer')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    is_active BOOLEAN DEFAULT TRUE,
    company VARCHAR(255), -- Optional company field
    last_login_at TIMESTAMP WITH TIME ZONE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE, -- Account lockout for security
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- Soft delete
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure email uniqueness per organization (allows same email across orgs)
    CONSTRAINT users_email_org_unique UNIQUE (email, organization_id)
);

-- Create indexes for users
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active, organization_id) WHERE is_active = TRUE;
CREATE INDEX idx_users_deleted ON users(deleted_at, organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status, organization_id);

-- User roles table for advanced RBAC (future extension)
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL,
    permissions JSONB DEFAULT '{}', -- Granular permissions
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional role expiration
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure user can't have duplicate roles in same organization
    CONSTRAINT user_roles_unique UNIQUE (user_id, organization_id, role_name)
);

-- Create indexes for user_roles
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_organization_id ON user_roles(organization_id);
CREATE INDEX idx_user_roles_active ON user_roles(is_active, organization_id) WHERE is_active = TRUE;

-- User sessions table for enhanced session management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id)
);

-- Create indexes for user_sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_organization_id ON user_sessions(organization_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_revoked, expires_at) WHERE is_revoked = FALSE;

-- Add RLS policies for multi-tenant isolation
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for organizations (admins can see their org and children)
CREATE POLICY org_isolation_policy ON organizations
    FOR ALL USING (
        auth.uid() IN (
            SELECT auth_user_id FROM users 
            WHERE organization_id = organizations.id 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for users (users can only see users in their organization)
CREATE POLICY user_isolation_policy ON users
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for user_roles
CREATE POLICY user_roles_isolation_policy ON user_roles
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for user_sessions
CREATE POLICY user_sessions_isolation_policy ON user_sessions
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- Triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();