-- Invitations and Token Management Schema
-- Implements secure invitation system with proper token handling

-- Invitations table - secure token management for user invitations
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL, -- Email of invited user
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('auditor', 'reviewer')), -- Admins create orgs directly
    token VARCHAR(255) NOT NULL UNIQUE, -- Secure invitation token
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Required expiration
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by UUID REFERENCES users(id), -- Links to created user after acceptance
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id),
    revoke_reason TEXT,
    metadata JSONB DEFAULT '{}', -- Additional invitation metadata
    ip_address INET, -- IP of inviter for audit trail
    user_agent TEXT, -- User agent of inviter
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one pending invitation per email per organization
    CONSTRAINT invitations_email_org_pending_unique 
        UNIQUE (email, organization_id) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for invitations
CREATE INDEX idx_invitations_organization_id ON invitations(organization_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status, organization_id);
CREATE INDEX idx_invitations_expires ON invitations(expires_at);
CREATE INDEX idx_invitations_invited_by ON invitations(invited_by);
CREATE INDEX idx_invitations_pending ON invitations(status, expires_at) WHERE status = 'pending';

-- API tokens table for service-to-service authentication
CREATE TABLE api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- Human-readable token name
    token_hash VARCHAR(255) NOT NULL UNIQUE, -- Hashed token for security
    permissions JSONB DEFAULT '{}', -- Token-specific permissions
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_used_ip INET,
    usage_count INTEGER DEFAULT 0,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL -- Soft delete
);

-- Create indexes for api_tokens
CREATE INDEX idx_api_tokens_organization_id ON api_tokens(organization_id);
CREATE INDEX idx_api_tokens_user_id ON api_tokens(user_id);
CREATE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX idx_api_tokens_active ON api_tokens(is_active, organization_id) WHERE is_active = TRUE;
CREATE INDEX idx_api_tokens_deleted ON api_tokens(deleted_at) WHERE deleted_at IS NULL;

-- Password reset tokens table for enhanced security
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for password_reset_tokens
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
CREATE INDEX idx_password_reset_tokens_unused ON password_reset_tokens(used_at) WHERE used_at IS NULL;

-- Email verification tokens table
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL, -- Email to verify (may be different from current)
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for email_verification_tokens
CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_email ON email_verification_tokens(email);
CREATE INDEX idx_email_verification_tokens_token_hash ON email_verification_tokens(token_hash);
CREATE INDEX idx_email_verification_tokens_expires ON email_verification_tokens(expires_at);

-- Add RLS policies for multi-tenant isolation
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for invitations (users can only see invitations in their organization)
CREATE POLICY invitations_isolation_policy ON invitations
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for api_tokens
CREATE POLICY api_tokens_isolation_policy ON api_tokens
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for password_reset_tokens
CREATE POLICY password_reset_tokens_isolation_policy ON password_reset_tokens
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for email_verification_tokens
CREATE POLICY email_verification_tokens_isolation_policy ON email_verification_tokens
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
    UPDATE invitations 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' 
    AND expires_at < NOW()
    AND status != 'expired';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    -- Clean up expired password reset tokens (older than 24 hours)
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() - INTERVAL '24 hours';
    
    -- Clean up expired email verification tokens (older than 7 days)
    DELETE FROM email_verification_tokens 
    WHERE expires_at < NOW() - INTERVAL '7 days';
    
    -- Mark expired invitations
    UPDATE invitations 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating timestamps
CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_tokens_updated_at BEFORE UPDATE ON api_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate secure invitation tokens
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS varchar AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to hash API tokens securely
CREATE OR REPLACE FUNCTION hash_api_token(token TEXT)
RETURNS varchar AS $$
BEGIN
    RETURN encode(digest(token || current_setting('app.jwt_secret', true), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;