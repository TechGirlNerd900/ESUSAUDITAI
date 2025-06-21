-- Create a dedicated invitations table to replace the app_settings approach
-- This provides better structure and query capabilities for invitations

BEGIN;

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    role VARCHAR(20) DEFAULT 'auditor' CHECK (role IN ('admin', 'auditor', 'reviewer')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB
);

-- Create indexes for performance
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_organization_id ON invitations(organization_id);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);

-- Add RLS policies
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins and organization members can view invitations for their organization
CREATE POLICY invitations_select_policy ON invitations
    FOR SELECT
    USING (
        (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
        OR
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Policy: Only admins and organization admins can create invitations
CREATE POLICY invitations_insert_policy ON invitations
    FOR INSERT
    WITH CHECK (
        (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
        OR
        (
            (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
            AND
            organization_id IN (
                SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Policy: Only admins and organization admins can update invitations
CREATE POLICY invitations_update_policy ON invitations
    FOR UPDATE
    USING (
        (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
        OR
        (
            (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
            AND
            organization_id IN (
                SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Policy: Only admins and organization admins can delete invitations
CREATE POLICY invitations_delete_policy ON invitations
    FOR DELETE
    USING (
        (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
        OR
        (
            (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
            AND
            organization_id IN (
                SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Function to migrate existing invitations from app_settings
CREATE OR REPLACE FUNCTION migrate_invitations_from_app_settings()
RETURNS void AS $$
DECLARE
    invite_record RECORD;
    invite_data JSONB;
    token_value TEXT;
BEGIN
    FOR invite_record IN
        SELECT * FROM app_settings 
        WHERE category = 'invitations' 
        AND key LIKE 'invite_%'
    LOOP
        -- Extract token from key
        token_value := substring(invite_record.key FROM 8);
        
        -- Parse the JSON value
        invite_data := invite_record.value::jsonb;
        
        -- Insert into new invitations table
        INSERT INTO invitations (
            email,
            organization_id,
            token,
            role,
            status,
            created_by,
            created_at,
            expires_at,
            metadata
        ) VALUES (
            invite_data->>'email',
            (invite_data->>'organizationId')::uuid,
            token_value,
            COALESCE(invite_data->>'role', 'auditor'),
            'pending',
            (invite_data->>'createdBy')::uuid,
            COALESCE((invite_data->>'createdAt')::timestamp with time zone, CURRENT_TIMESTAMP),
            COALESCE((invite_data->>'expiresAt')::timestamp with time zone, (CURRENT_TIMESTAMP + interval '7 days')),
            invite_data
        )
        ON CONFLICT (token) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the migration function
SELECT migrate_invitations_from_app_settings();

-- Drop the migration function
DROP FUNCTION migrate_invitations_from_app_settings();

-- Add helpful comments
COMMENT ON TABLE invitations IS 'Stores user invitations to join organizations';
COMMENT ON COLUMN invitations.token IS 'Unique token used in invitation links';
COMMENT ON COLUMN invitations.status IS 'Current status of the invitation: pending, accepted, expired, or revoked';
COMMENT ON COLUMN invitations.expires_at IS 'When the invitation expires and can no longer be used';

COMMIT;