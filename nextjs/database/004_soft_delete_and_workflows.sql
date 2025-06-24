-- Soft Delete and Workflow Management Schema
-- Implements soft delete functionality and pending deletion approval workflow

-- Soft delete tracking table - central tracking for all soft-deleted entities
CREATE TABLE deleted_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- Table name of deleted entity
    entity_id UUID NOT NULL, -- ID of the deleted entity
    entity_data JSONB NOT NULL, -- Full snapshot of entity at deletion time
    deleted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deletion_reason TEXT,
    can_restore BOOLEAN DEFAULT TRUE,
    retention_until TIMESTAMP WITH TIME ZONE, -- When data can be permanently deleted
    restored_at TIMESTAMP WITH TIME ZONE,
    restored_by UUID REFERENCES users(id),
    permanently_deleted_at TIMESTAMP WITH TIME ZONE,
    permanently_deleted_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique tracking per entity
    CONSTRAINT deleted_entities_unique UNIQUE (entity_type, entity_id)
);

-- Create indexes for deleted_entities
CREATE INDEX idx_deleted_entities_organization_id ON deleted_entities(organization_id);
CREATE INDEX idx_deleted_entities_type ON deleted_entities(entity_type, organization_id);
CREATE INDEX idx_deleted_entities_deleted_by ON deleted_entities(deleted_by);
CREATE INDEX idx_deleted_entities_restorable ON deleted_entities(can_restore, retention_until) 
    WHERE can_restore = TRUE;
CREATE INDEX idx_deleted_entities_retention ON deleted_entities(retention_until) 
    WHERE retention_until IS NOT NULL;

-- Pending deletion requests table - implements admin approval workflow for deletions
CREATE TABLE pending_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- Type of entity to delete (project, document, etc.)
    entity_id UUID NOT NULL, -- ID of entity to delete
    entity_description TEXT, -- Human-readable description of what's being deleted
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_reason TEXT NOT NULL, -- Why deletion is requested
    impact_assessment JSONB DEFAULT '{}', -- Assessment of deletion impact
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    
    -- Admin review fields
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    approval_conditions TEXT, -- Any conditions for approval
    
    -- Execution fields
    scheduled_for TIMESTAMP WITH TIME ZONE, -- When deletion should occur
    executed_at TIMESTAMP WITH TIME ZONE,
    executed_by UUID REFERENCES users(id),
    execution_result JSONB, -- Results of deletion execution
    
    -- Metadata
    expires_at TIMESTAMP WITH TIME ZONE, -- When request expires if not reviewed
    notification_sent BOOLEAN DEFAULT FALSE,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for pending_deletion_requests
CREATE INDEX idx_pending_deletion_requests_organization_id ON pending_deletion_requests(organization_id);
CREATE INDEX idx_pending_deletion_requests_status ON pending_deletion_requests(status, organization_id);
CREATE INDEX idx_pending_deletion_requests_requested_by ON pending_deletion_requests(requested_by);
CREATE INDEX idx_pending_deletion_requests_reviewed_by ON pending_deletion_requests(reviewed_by);
CREATE INDEX idx_pending_deletion_requests_entity ON pending_deletion_requests(entity_type, entity_id);
CREATE INDEX idx_pending_deletion_requests_priority ON pending_deletion_requests(priority, status, created_at);
CREATE INDEX idx_pending_deletion_requests_expires ON pending_deletion_requests(expires_at) 
    WHERE expires_at IS NOT NULL;
CREATE INDEX idx_pending_deletion_requests_pending ON pending_deletion_requests(status, created_at) 
    WHERE status = 'pending';

-- Data retention policies table - configurable retention rules
CREATE TABLE data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- Type of data the policy applies to
    policy_name VARCHAR(100) NOT NULL,
    description TEXT,
    retention_period INTERVAL NOT NULL, -- How long to keep data
    auto_delete BOOLEAN DEFAULT FALSE, -- Automatically delete after retention period
    requires_approval BOOLEAN DEFAULT TRUE, -- Require admin approval for deletion
    backup_before_delete BOOLEAN DEFAULT TRUE, -- Create backup before deletion
    legal_hold_exempt BOOLEAN DEFAULT FALSE, -- Exempt from legal holds
    priority INTEGER DEFAULT 0, -- Policy priority (higher number = higher priority)
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique policy names per organization
    CONSTRAINT data_retention_policies_unique UNIQUE (organization_id, policy_name)
);

-- Create indexes for data_retention_policies
CREATE INDEX idx_data_retention_policies_organization_id ON data_retention_policies(organization_id);
CREATE INDEX idx_data_retention_policies_entity_type ON data_retention_policies(entity_type, organization_id);
CREATE INDEX idx_data_retention_policies_active ON data_retention_policies(is_active, organization_id) 
    WHERE is_active = TRUE;

-- Workflow approvals table - generic approval workflow system
CREATE TABLE workflow_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_type VARCHAR(50) NOT NULL, -- deletion_request, user_access, etc.
    entity_type VARCHAR(50), -- Type of entity being approved
    entity_id UUID, -- ID of entity being approved
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_data JSONB NOT NULL, -- Data about what's being requested
    approval_level INTEGER DEFAULT 1, -- Support multi-level approvals
    required_approvers INTEGER DEFAULT 1, -- How many approvals needed
    current_approvers INTEGER DEFAULT 0, -- How many approvals received
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Individual approval actions table
CREATE TABLE workflow_approval_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_approval_id UUID NOT NULL REFERENCES workflow_approvals(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('approved', 'rejected', 'delegated')),
    comments TEXT,
    delegated_to UUID REFERENCES users(id), -- If action is 'delegated'
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for workflow tables
CREATE INDEX idx_workflow_approvals_organization_id ON workflow_approvals(organization_id);
CREATE INDEX idx_workflow_approvals_type ON workflow_approvals(workflow_type, organization_id);
CREATE INDEX idx_workflow_approvals_status ON workflow_approvals(status, organization_id);
CREATE INDEX idx_workflow_approvals_requested_by ON workflow_approvals(requested_by);
CREATE INDEX idx_workflow_approvals_pending ON workflow_approvals(status, created_at) 
    WHERE status = 'pending';

CREATE INDEX idx_workflow_approval_actions_workflow_id ON workflow_approval_actions(workflow_approval_id);
CREATE INDEX idx_workflow_approval_actions_approver_id ON workflow_approval_actions(approver_id);

-- Add RLS policies for multi-tenant isolation
ALTER TABLE deleted_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_approval_actions ENABLE ROW LEVEL SECURITY;

-- RLS policies for deleted_entities
CREATE POLICY deleted_entities_isolation_policy ON deleted_entities
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for pending_deletion_requests
CREATE POLICY pending_deletion_requests_isolation_policy ON pending_deletion_requests
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for data_retention_policies
CREATE POLICY data_retention_policies_isolation_policy ON data_retention_policies
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for workflow_approvals
CREATE POLICY workflow_approvals_isolation_policy ON workflow_approvals
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for workflow_approval_actions
CREATE POLICY workflow_approval_actions_isolation_policy ON workflow_approval_actions
    FOR ALL USING (
        workflow_approval_id IN (
            SELECT id FROM workflow_approvals wa
            WHERE wa.organization_id IN (
                SELECT organization_id FROM users 
                WHERE auth_user_id = auth.uid() 
                AND deleted_at IS NULL
            )
        )
    );

-- Function to soft delete an entity
CREATE OR REPLACE FUNCTION soft_delete_entity(
    p_organization_id UUID,
    p_entity_type VARCHAR,
    p_entity_id UUID,
    p_entity_data JSONB,
    p_deleted_by UUID,
    p_deletion_reason TEXT DEFAULT NULL,
    p_retention_period INTERVAL DEFAULT INTERVAL '7 years'
)
RETURNS UUID AS $$
DECLARE
    deletion_id UUID;
    retention_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate retention date
    retention_date := NOW() + p_retention_period;
    
    -- Create deletion record
    INSERT INTO deleted_entities (
        organization_id, entity_type, entity_id, entity_data,
        deleted_by, deletion_reason, retention_until
    ) VALUES (
        p_organization_id, p_entity_type, p_entity_id, p_entity_data,
        p_deleted_by, p_deletion_reason, retention_date
    ) RETURNING id INTO deletion_id;
    
    -- Create audit log
    PERFORM create_audit_log(
        p_organization_id,
        p_deleted_by,
        'soft_delete',
        p_entity_type,
        p_entity_id,
        p_entity_data,
        NULL,
        jsonb_build_object('deletion_reason', p_deletion_reason, 'retention_until', retention_date)
    );
    
    RETURN deletion_id;
END;
$$ LANGUAGE plpgsql;

-- Function to restore a soft-deleted entity
CREATE OR REPLACE FUNCTION restore_soft_deleted_entity(
    p_deletion_id UUID,
    p_restored_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    deletion_record RECORD;
BEGIN
    -- Get deletion record
    SELECT * INTO deletion_record
    FROM deleted_entities
    WHERE id = p_deletion_id
    AND can_restore = TRUE
    AND restored_at IS NULL
    AND permanently_deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Mark as restored
    UPDATE deleted_entities
    SET restored_at = NOW(),
        restored_by = p_restored_by,
        updated_at = NOW()
    WHERE id = p_deletion_id;
    
    -- Create audit log
    PERFORM create_audit_log(
        deletion_record.organization_id,
        p_restored_by,
        'restore_entity',
        deletion_record.entity_type,
        deletion_record.entity_id,
        NULL,
        deletion_record.entity_data,
        jsonb_build_object('deletion_id', p_deletion_id)
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to request deletion approval
CREATE OR REPLACE FUNCTION request_deletion_approval(
    p_organization_id UUID,
    p_entity_type VARCHAR,
    p_entity_id UUID,
    p_entity_description TEXT,
    p_requested_by UUID,
    p_request_reason TEXT,
    p_priority VARCHAR DEFAULT 'medium'
)
RETURNS UUID AS $$
DECLARE
    request_id UUID;
    expiry_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Set expiry date (30 days from now)
    expiry_date := NOW() + INTERVAL '30 days';
    
    -- Create deletion request
    INSERT INTO pending_deletion_requests (
        organization_id, entity_type, entity_id, entity_description,
        requested_by, request_reason, priority, expires_at
    ) VALUES (
        p_organization_id, p_entity_type, p_entity_id, p_entity_description,
        p_requested_by, p_request_reason, p_priority, expiry_date
    ) RETURNING id INTO request_id;
    
    -- Create audit log
    PERFORM create_audit_log(
        p_organization_id,
        p_requested_by,
        'request_deletion_approval',
        p_entity_type,
        p_entity_id,
        NULL,
        NULL,
        jsonb_build_object(
            'request_id', request_id,
            'reason', p_request_reason,
            'priority', p_priority
        )
    );
    
    RETURN request_id;
END;
$$ LANGUAGE plpgsql;

-- Function to approve/reject deletion request
CREATE OR REPLACE FUNCTION review_deletion_request(
    p_request_id UUID,
    p_reviewed_by UUID,
    p_status VARCHAR,
    p_review_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    request_record RECORD;
BEGIN
    -- Get and validate request
    SELECT * INTO request_record
    FROM pending_deletion_requests
    WHERE id = p_request_id
    AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Update request
    UPDATE pending_deletion_requests
    SET status = p_status,
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW(),
        review_notes = p_review_notes,
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Create audit log
    PERFORM create_audit_log(
        request_record.organization_id,
        p_reviewed_by,
        'review_deletion_request',
        request_record.entity_type,
        request_record.entity_id,
        jsonb_build_object('old_status', 'pending'),
        jsonb_build_object('new_status', p_status),
        jsonb_build_object(
            'request_id', p_request_id,
            'review_notes', p_review_notes
        )
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired deletion requests
CREATE OR REPLACE FUNCTION cleanup_expired_deletion_requests()
RETURNS void AS $$
BEGIN
    -- Mark expired requests as cancelled
    UPDATE pending_deletion_requests
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE status = 'pending'
    AND expires_at < NOW();
    
    -- Clean up old completed requests (older than 1 year)
    DELETE FROM pending_deletion_requests
    WHERE status IN ('approved', 'rejected', 'cancelled')
    AND updated_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating timestamps
CREATE TRIGGER update_deleted_entities_updated_at BEFORE UPDATE ON deleted_entities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pending_deletion_requests_updated_at BEFORE UPDATE ON pending_deletion_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_retention_policies_updated_at BEFORE UPDATE ON data_retention_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_approvals_updated_at BEFORE UPDATE ON workflow_approvals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();