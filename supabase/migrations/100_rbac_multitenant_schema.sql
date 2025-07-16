-- =============================================================================
-- RBAC Multi-Tenant Database Schema
-- Generated according to CLAUDE.md Security Specification
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS ltree;

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- =============================================================================
-- DROP EXISTING TABLES (IF ANY) - BE CAREFUL WITH THIS IN PRODUCTION
-- =============================================================================

-- Drop tables in reverse dependency order to avoid foreign key conflicts
DROP TABLE IF EXISTS schema_documentation CASCADE;
DROP TABLE IF EXISTS organization_settings CASCADE;
DROP TABLE IF EXISTS soft_delete_tracking CASCADE;
DROP TABLE IF EXISTS pending_deletion_requests CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS invitation_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS insert_audit_log(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, JSONB, VARCHAR, INET, TEXT) CASCADE;
DROP FUNCTION IF EXISTS is_user_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_organization_id(UUID) CASCADE;

-- =============================================================================
-- CORE ORGANIZATIONAL STRUCTURE
-- =============================================================================

-- Organizations table for multi-tenant isolation
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    hierarchy_path LTREE, -- For hierarchical organization support
    parent_organization_id UUID REFERENCES organizations(id),
    settings JSONB DEFAULT '{}',
    
    -- Multi-tenant isolation fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Soft delete support
    deleted_at TIMESTAMP WITH TIME ZONE NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Constraints
    CONSTRAINT organizations_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT organizations_domain_format CHECK (domain ~ '^[a-z0-9.-]+$'),
    UNIQUE(name, deleted_at), -- Unique name when not deleted
    UNIQUE(domain, deleted_at) -- Unique domain when not deleted
);

-- Create indexes for organizations
CREATE INDEX idx_organizations_parent ON organizations(parent_organization_id);
CREATE INDEX idx_organizations_active ON organizations(is_active, deleted_at);
CREATE INDEX idx_organizations_hierarchy ON organizations USING GIST(hierarchy_path);

-- =============================================================================
-- RBAC USER MANAGEMENT
-- =============================================================================

-- Users table with RBAC integration
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL, -- Reference to Supabase auth.users
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    
    -- RBAC role assignment (strictly Admin, Auditor, Reviewer)
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'auditor', 'reviewer')),
    
    -- Multi-tenant isolation (MANDATORY)
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Additional profile fields
    company VARCHAR(255),
    phone VARCHAR(50),
    custom_fields JSONB DEFAULT '{}',
    
    -- Status and activity
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'suspended')),
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Security fields for login attempts
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE NULL,

    -- Soft delete support
    deleted_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- Constraints
    CONSTRAINT users_email_format CHECK (email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'),
    CONSTRAINT users_name_not_empty CHECK (length(trim(first_name)) > 0 AND length(trim(last_name)) > 0),
    UNIQUE(email, organization_id, deleted_at), -- Unique email per organization when not deleted
    UNIQUE(auth_user_id) -- One profile per auth user
);

-- Create indexes for users
CREATE INDEX idx_users_auth_user ON users(auth_user_id);
CREATE INDEX idx_users_organization ON users(organization_id, deleted_at);
CREATE INDEX idx_users_role_organization ON users(role, organization_id, deleted_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active, deleted_at);

-- =============================================================================
-- INVITATION SYSTEM (SECURE TOKEN STORAGE)
-- =============================================================================

-- Invitation tokens table (tokens never returned in API responses)
CREATE TABLE invitation_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(255) NOT NULL UNIQUE, -- Secure random token
    token_hash VARCHAR(255) NOT NULL UNIQUE, -- Hashed version for verification
    
    -- Invitation details
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('auditor', 'reviewer')), -- Only auditor/reviewer can be invited
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Invitation metadata
    invited_by UUID NOT NULL REFERENCES users(id),
    invitation_message TEXT,
    custom_data JSONB DEFAULT '{}',
    
    -- Token lifecycle
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by UUID REFERENCES users(id),
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT invitation_tokens_email_format CHECK (email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'),
    CONSTRAINT invitation_tokens_expires_future CHECK (expires_at > created_at),
    CONSTRAINT invitation_tokens_accepted_logic CHECK (
        (status = 'accepted' AND accepted_at IS NOT NULL AND accepted_by IS NOT NULL) OR
        (status != 'accepted' AND accepted_at IS NULL AND accepted_by IS NULL)
    )
);

-- Create indexes for invitation tokens
CREATE INDEX idx_invitation_tokens_hash ON invitation_tokens(token_hash);
CREATE INDEX idx_invitation_tokens_email ON invitation_tokens(email, status);
CREATE INDEX idx_invitation_tokens_organization ON invitation_tokens(organization_id, status);
CREATE INDEX idx_invitation_tokens_invited_by ON invitation_tokens(invited_by);
CREATE INDEX idx_invitation_tokens_expires ON invitation_tokens(expires_at, status);

-- =============================================================================
-- COMPREHENSIVE AUDIT LOGGING
-- =============================================================================

-- Audit logs table for security monitoring
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Actor information
    user_id UUID REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    
    -- Action details
    action VARCHAR(100) NOT NULL, -- e.g., 'user_created', 'project_deleted', 'login_failed'
    resource_type VARCHAR(50), -- e.g., 'user', 'project', 'document'
    resource_id VARCHAR(255), -- ID of the affected resource
    
    -- Context information
    details JSONB DEFAULT '{}', -- Additional context (NO SENSITIVE DATA)
    ip_address INET,
    user_agent TEXT,
    
    -- Classification
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('low', 'info', 'warning', 'high', 'critical')),
    category VARCHAR(50) DEFAULT 'general', -- e.g., 'auth', 'data', 'admin', 'security'
    tags TEXT[], -- Array of tags for categorization
    
    -- Temporal
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT audit_logs_action_not_empty CHECK (length(trim(action)) > 0),
    CONSTRAINT audit_logs_organization_required CHECK (organization_id IS NOT NULL)
);

-- Create indexes for audit logs
CREATE INDEX idx_audit_logs_organization_time ON audit_logs(organization_id, timestamp DESC);
CREATE INDEX idx_audit_logs_user_time ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, timestamp DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity, timestamp DESC);
CREATE INDEX idx_audit_logs_category ON audit_logs(category, timestamp DESC);

-- =============================================================================
-- PENDING DELETION WORKFLOW (AUDITOR → ADMIN APPROVAL)
-- =============================================================================

-- Pending deletion requests table for Auditor → Admin workflow
CREATE TABLE pending_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Request details
    resource_type VARCHAR(50) NOT NULL, -- e.g., 'project', 'document', 'user'
    resource_id UUID NOT NULL,
    resource_name VARCHAR(255), -- Human-readable name for display
    
    -- Multi-tenant isolation
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Workflow actors
    requested_by UUID NOT NULL REFERENCES users(id), -- Must be Auditor role
    reviewed_by UUID REFERENCES users(id), -- Must be Admin role when approved/rejected
    
    -- Request status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    
    -- Request context
    reason TEXT, -- Why deletion is requested
    admin_notes TEXT, -- Admin's notes when reviewing
    metadata JSONB DEFAULT '{}', -- Additional context
    
    -- Workflow timestamps
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    
    -- Constraints
    CONSTRAINT pending_deletion_resource_not_empty CHECK (length(trim(resource_type)) > 0),
    CONSTRAINT pending_deletion_expires_future CHECK (expires_at > requested_at),
    CONSTRAINT pending_deletion_review_logic CHECK (
        (status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL) OR
        (status IN ('pending', 'expired') AND reviewed_by IS NULL AND reviewed_at IS NULL)
    )
);

-- Create indexes for pending deletion requests
CREATE INDEX idx_pending_deletion_organization ON pending_deletion_requests(organization_id, status);
CREATE INDEX idx_pending_deletion_requested_by ON pending_deletion_requests(requested_by, status);
CREATE INDEX idx_pending_deletion_resource ON pending_deletion_requests(resource_type, resource_id);
CREATE INDEX idx_pending_deletion_expires ON pending_deletion_requests(expires_at, status);

-- =============================================================================
-- SOFT DELETE TRACKING
-- =============================================================================

-- Soft delete tracking table for audit and recovery
CREATE TABLE soft_delete_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Resource identification
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    resource_data JSONB, -- Snapshot of deleted data for recovery
    
    -- Multi-tenant isolation
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Deletion context
    deleted_by UUID NOT NULL REFERENCES users(id),
    deletion_reason TEXT,
    deletion_type VARCHAR(20) DEFAULT 'manual' CHECK (deletion_type IN ('manual', 'automatic', 'cascade')),
    
    -- Recovery information
    is_recoverable BOOLEAN DEFAULT TRUE,
    recovery_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days'),
    
    -- Timestamps
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT soft_delete_resource_not_empty CHECK (length(trim(resource_type)) > 0),
    UNIQUE(resource_type, resource_id) -- One deletion record per resource
);

-- Create indexes for soft delete tracking
CREATE INDEX idx_soft_delete_organization ON soft_delete_tracking(organization_id, deleted_at);
CREATE INDEX idx_soft_delete_deleted_by ON soft_delete_tracking(deleted_by);
CREATE INDEX idx_soft_delete_resource ON soft_delete_tracking(resource_type, resource_id);
CREATE INDEX idx_soft_delete_recovery ON soft_delete_tracking(is_recoverable, recovery_expires_at);

-- =============================================================================
-- HELPER TABLES FOR RBAC AND AUDIT
-- =============================================================================

-- System configuration table for organization-specific settings
CREATE TABLE organization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Setting key-value store
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB,
    setting_type VARCHAR(20) DEFAULT 'custom' CHECK (setting_type IN ('system', 'security', 'custom')),
    
    -- Metadata
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT org_settings_key_not_empty CHECK (length(trim(setting_key)) > 0),
    UNIQUE(organization_id, setting_key)
);

-- Create indexes for organization settings
CREATE INDEX idx_org_settings_organization ON organization_settings(organization_id);
CREATE INDEX idx_org_settings_key ON organization_settings(setting_key);
CREATE INDEX idx_org_settings_type ON organization_settings(setting_type);

-- =============================================================================
-- SECURITY FUNCTIONS FOR MULTI-TENANT ISOLATION
-- =============================================================================

-- Function to get user's organization context
CREATE OR REPLACE FUNCTION get_user_organization_id(user_uuid UUID)
RETURNS UUID AS $
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
$ LANGUAGE plpgsql SECURITY INVOKER;

-- Function to check if user has admin role
CREATE OR REPLACE FUNCTION is_user_admin(user_uuid UUID)
RETURNS BOOLEAN AS $
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
$ LANGUAGE plpgsql SECURITY INVOKER;

-- Function to audit log insertion
CREATE OR REPLACE FUNCTION insert_audit_log(
    p_user_id UUID,
    p_organization_id UUID,
    p_action VARCHAR(100),
    p_resource_type VARCHAR(50) DEFAULT NULL,
    p_resource_id VARCHAR(255) DEFAULT NULL,
    p_details JSONB DEFAULT '{}',
    p_severity VARCHAR(20) DEFAULT 'info',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        user_id, organization_id, action, resource_type, resource_id,
        details, severity, ip_address, user_agent
    ) VALUES (
        p_user_id, p_organization_id, p_action, p_resource_type, p_resource_id,
        p_details, p_severity, p_ip_address, p_user_agent
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGERS FOR AUDIT LOGGING AND MAINTENANCE
-- =============================================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER trigger_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_invitation_tokens_updated_at
    BEFORE UPDATE ON invitation_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_organization_settings_updated_at
    BEFORE UPDATE ON organization_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE soft_delete_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Organizations: Users can view their own organization" ON organizations
    FOR SELECT USING (id = get_user_organization_id(auth.uid()));

CREATE POLICY "Organizations: Admins can manage their organization" ON organizations
    FOR ALL USING (id = get_user_organization_id(auth.uid()) AND is_user_admin(auth.uid()));

-- RLS Policies for users
CREATE POLICY "Users: Users can view users in their organization" ON users
    FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()) AND deleted_at IS NULL);



CREATE POLICY "Users: Admins can manage users in their organization" ON users
    FOR ALL USING (organization_id = get_user_organization_id(auth.uid()) AND is_user_admin(auth.uid()));

-- RLS Policies for invitation tokens
CREATE POLICY "Invitations: Admins can manage invitations in their organization" ON invitation_tokens
    FOR ALL USING (organization_id = get_user_organization_id(auth.uid()) AND is_user_admin(auth.uid()));

-- RLS Policies for audit logs
CREATE POLICY "Audit Logs: Users can view logs in their organization" ON audit_logs
    FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Audit Logs: System can insert logs" ON audit_logs
    FOR INSERT WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

-- RLS Policies for pending deletion requests
CREATE POLICY "Pending Deletions: Users can view requests in their organization" ON pending_deletion_requests
    FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Pending Deletions: Auditors can create requests" ON pending_deletion_requests
    FOR INSERT WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Pending Deletions: Admins can manage requests" ON pending_deletion_requests
    FOR ALL USING (organization_id = get_user_organization_id(auth.uid()) AND is_user_admin(auth.uid()));

-- RLS Policies for soft delete tracking
CREATE POLICY "Soft Delete: Users can view tracking in their organization" ON soft_delete_tracking
    FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Soft Delete: System can manage tracking" ON soft_delete_tracking
    FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- RLS Policies for organization settings
CREATE POLICY "Org Settings: Users can view settings in their organization" ON organization_settings
    FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Org Settings: Admins can manage settings" ON organization_settings
    FOR ALL USING (organization_id = get_user_organization_id(auth.uid()) AND is_user_admin(auth.uid()));

-- =============================================================================
-- INITIAL DATA AND CONSTRAINTS
-- =============================================================================

-- Add constraint checks for RBAC role validation in pending deletions
ALTER TABLE pending_deletion_requests DROP CONSTRAINT IF EXISTS check_requester_is_auditor;
-- Note: This will be checked at application level due to complexity

-- Create function to validate pending deletion requests
CREATE OR REPLACE FUNCTION validate_pending_deletion_request()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if requester is an active auditor or admin
    IF NOT EXISTS (
        SELECT 1 
        FROM public.users u
        WHERE u.id = NEW.requested_by
          AND u.role IN ('auditor', 'admin')
          AND u.deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Requester must be an active auditor or admin';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for pending deletion requests
CREATE TRIGGER pending_deletion_request_validation
BEFORE INSERT OR UPDATE ON pending_deletion_requests
FOR EACH ROW
EXECUTE FUNCTION validate_pending_deletion_request();

-- Create documentation view for schema information
CREATE VIEW schema_documentation AS
SELECT 
    'organizations' as table_name,
    'Core organizational structure for multi-tenant isolation' as description,
    'organization_id is required on all tenant-specific tables' as notes
UNION ALL
SELECT 
    'users' as table_name,
    'RBAC users with roles: admin, auditor, reviewer' as description,
    'Each user must belong to exactly one organization' as notes
UNION ALL
SELECT 
    'invitation_tokens' as table_name,
    'Secure invitation system - tokens never returned in API responses' as description,
    'Only auditor and reviewer roles can be invited' as notes
UNION ALL
SELECT 
    'audit_logs' as table_name,
    'Comprehensive audit logging for sensitive operations' as description,
    'All operations must be logged with organization context' as notes
UNION ALL
SELECT 
    'pending_deletion_requests' as table_name,
    'Auditor → Admin approval workflow for deletions' as description,
    'Auditors request, Admins approve project-level deletions' as notes
UNION ALL
SELECT 
    'soft_delete_tracking' as table_name,
    'Soft delete implementation to prevent data loss' as description,
    'Maintains deletion history for audit and recovery' as notes;


COMMENT ON TABLE organizations IS 'Multi-tenant organization structure with hierarchical support';
COMMENT ON TABLE users IS 'RBAC users with strict role enforcement (admin/auditor/reviewer)';
COMMENT ON TABLE invitation_tokens IS 'Secure invitation tokens - never exposed in API responses';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for security monitoring';
COMMENT ON TABLE pending_deletion_requests IS 'Auditor→Admin approval workflow for deletion requests';
COMMENT ON TABLE soft_delete_tracking IS 'Soft delete tracking for data recovery and audit';

-- =============================================================================
-- ADDITIONAL FUNCTIONS AND TRIGGERS (MOVED FROM 20240505000000_add_audit_logs_table.sql)
-- =============================================================================

-- Create function to log actions
CREATE OR REPLACE FUNCTION public.log_action(
    p_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id TEXT,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_organization_id UUID;
    v_log_id UUID;
BEGIN
    -- Get user's organization ID
    SELECT organization_id INTO v_organization_id
    FROM public.users
    WHERE id = p_user_id;
    
    -- Insert audit log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        details,
        ip_address,
        user_agent,
        organization_id
    ) VALUES (
        p_user_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_details,
        p_ip_address,
        p_user_agent,
        v_organization_id
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clean up old audit logs
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(retention_days INTEGER DEFAULT 365)
RETURNS void AS $$
BEGIN
    -- Delete audit logs older than retention_days
    DELETE FROM public.audit_logs
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up old audit logs annually
-- Note: This requires pg_cron extension to be enabled
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pg_cron'
    ) THEN
        -- Schedule job to run on the first day of each year at 2 AM
        PERFORM cron.schedule('0 2 1 1 *', 'SELECT public.cleanup_old_audit_logs()');
    END IF;
END $$;

-- Create triggers to automatically log database changes

-- Function to create audit log from trigger
CREATE OR REPLACE FUNCTION public.create_audit_log_from_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_user_id UUID;
    v_details JSONB;
BEGIN
    -- Determine action
    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'delete';
    END IF;
    
    v_user_id := COALESCE(
        auth.uid(),
        '00000000-0000-0000-0000-000000000000'::UUID
    );
    
    -- Create details JSON
    IF TG_OP = 'INSERT' THEN
        v_details := jsonb_build_object('new', row_to_json(NEW)::jsonb);
    ELSIF TG_OP = 'UPDATE' THEN
        v_details := jsonb_build_object(
            'old', row_to_json(OLD)::jsonb,
            'new', row_to_json(NEW)::jsonb,
            'changed_fields', (
                SELECT jsonb_object_agg(key, value)
                FROM jsonb_each(row_to_json(NEW)::jsonb)
                WHERE NOT (row_to_json(OLD)::jsonb ? key AND row_to_json(OLD)::jsonb->key = value)
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        v_details := jsonb_build_object('old', row_to_json(OLD)::jsonb);
    END IF;
    
    -- Log the action
    PERFORM public.log_action(
        v_user_id,
        v_action,
        TG_TABLE_NAME,
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT
            ELSE NEW.id::TEXT
        END,
        v_details
    );
    
    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for important tables
-- Note: These triggers assume the existence of the tables (projects, documents, analysis_results)
-- If these tables are not defined in this migration, they should be defined in a prior migration.
CREATE TRIGGER audit_projects_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.create_audit_log_from_trigger();

CREATE TRIGGER audit_documents_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.create_audit_log_from_trigger();

CREATE TRIGGER audit_document_analysis_results_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.document_analysis_results
FOR EACH ROW EXECUTE FUNCTION public.create_audit_log_from_trigger();

CREATE TRIGGER audit_users_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.create_audit_log_from_trigger();

-- Add comment for documentation
COMMENT ON FUNCTION public.log_action IS 'Helper function to create audit logs';
COMMENT ON FUNCTION public.cleanup_old_audit_logs IS 'Function to clean up old audit logs';
COMMENT ON FUNCTION public.create_audit_log_from_trigger IS 'Trigger function to automatically create audit logs';

-- =============================================================================
-- RPC FUNCTION FOR AUDIT LOG SEARCH
-- =============================================================================

-- Function to search audit logs with filters
CREATE OR REPLACE FUNCTION public.search_audit_logs(
    p_organization_id UUID,
    p_event_type VARCHAR(100) DEFAULT NULL,
    p_severity VARCHAR(20) DEFAULT NULL,
    p_tag TEXT DEFAULT NULL,
    p_resource_type VARCHAR(50) DEFAULT NULL,
    p_resource_id VARCHAR(255) DEFAULT NULL,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    organization_id UUID,
    session_id VARCHAR,
    action VARCHAR,
    resource_type VARCHAR,
    resource_id VARCHAR,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    severity VARCHAR,
    category VARCHAR,
    tags TEXT[],
    timestamp TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        al.id,
        al.user_id,
        al.organization_id,
        al.session_id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.details,
        al.ip_address,
        al.user_agent,
        al.severity,
        al.category,
        al.tags,
        al.timestamp
    FROM
        public.audit_logs al
    WHERE
        al.organization_id = p_organization_id
        AND (p_event_type IS NULL OR al.action = p_event_type)
        AND (p_severity IS NULL OR al.severity = p_severity)
        AND (p_tag IS NULL OR al.tags @> ARRAY[p_tag])
        AND (p_resource_type IS NULL OR al.resource_type = p_resource_type)
        AND (p_resource_id IS NULL OR al.resource_id = p_resource_id)
    ORDER BY
        al.timestamp DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.search_audit_logs IS 'Searches audit logs with various filters for a given organization.';