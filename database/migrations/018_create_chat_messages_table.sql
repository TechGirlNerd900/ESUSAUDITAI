-- Create chat_messages table with proper indexes for performance
-- This migration adds a dedicated table for storing chat messages with pagination support

BEGIN;

-- Create chat_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_id ON chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_organization_id ON chat_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_created ON chat_messages(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_org_project_created ON chat_messages(organization_id, project_id, created_at);

-- Enable Row Level Security
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY chat_messages_select_policy ON chat_messages
    FOR SELECT
    USING (
        -- Admin can see all messages
        (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
        OR
        -- Users can see messages in their organization
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY chat_messages_insert_policy ON chat_messages
    FOR INSERT
    WITH CHECK (
        -- Users can only insert messages for projects in their organization
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
        AND
        -- And only for projects they have access to
        (
            -- If they're an admin
            (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
            OR
            -- If they created the project
            project_id IN (
                SELECT id FROM projects 
                WHERE created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
            )
            OR
            -- If they're assigned to the project
            project_id IN (
                SELECT id FROM projects 
                WHERE (SELECT id FROM users WHERE auth_user_id = auth.uid()) = ANY(assigned_to)
            )
        )
    );

-- Add comment for documentation
COMMENT ON TABLE chat_messages IS 'Stores chat messages between users and AI assistant for projects';

COMMIT;