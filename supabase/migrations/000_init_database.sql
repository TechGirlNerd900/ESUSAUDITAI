-- Database Initialization Script
-- This script initializes the complete database schema for the audit application
-- with proper multi-tenant isolation and RBAC implementation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create custom types for commonly used enums
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM ('admin', 'auditor', 'reviewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status_type AS ENUM ('active', 'inactive', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invitation_status_type AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_severity_type AS ENUM ('debug', 'info', 'warning', 'error', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE priority_type AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create database functions for common operations
CREATE OR REPLACE FUNCTION gen_random_uuid_v7()
RETURNS UUID AS $$
DECLARE
    unix_time BIGINT;
    rand_bytes BYTEA;
BEGIN
    -- Get current Unix timestamp in milliseconds
    unix_time := EXTRACT(EPOCH FROM NOW()) * 1000;
    
    -- Generate random bytes
    rand_bytes := gen_random_bytes(10);
    
    -- Construct UUID v7 format
    RETURN (
        LPAD(TO_HEX(unix_time), 12, '0') ||
        LPAD(TO_HEX(GET_BYTE(rand_bytes, 0) & 15 | 112), 2, '0') || -- Version 7
        LPAD(TO_HEX(GET_BYTE(rand_bytes, 1) & 63 | 128), 2, '0') || -- Variant
        ENCODE(SUBSTRING(rand_bytes FROM 2 FOR 8), 'hex')
    )::UUID;
END;
$$ LANGUAGE plpgsql;

-- Create function for secure random token generation
CREATE OR REPLACE FUNCTION generate_secure_token(length INTEGER DEFAULT 32)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(length), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Create function for password hashing
CREATE OR REPLACE FUNCTION hash_password(password TEXT, salt TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    password_salt TEXT;
BEGIN
    IF salt IS NULL THEN
        password_salt := encode(gen_random_bytes(32), 'hex');
    ELSE
        password_salt := salt;
    END IF;
    
    RETURN password_salt || ':' || encode(digest(password || password_salt, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Create function to verify password
CREATE OR REPLACE FUNCTION verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    salt TEXT;
    expected_hash TEXT;
BEGIN
    -- Extract salt from hash
    salt := split_part(hash, ':', 1);
    
    -- Generate expected hash
    expected_hash := salt || ':' || encode(digest(password || salt, 'sha256'), 'hex');
    
    RETURN hash = expected_hash;
END;
$$ LANGUAGE plpgsql;

-- Create function for transaction management
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS VOID AS $$
BEGIN
    -- This is a placeholder for transaction management
    -- In practice, transactions are handled by the application layer
    RAISE NOTICE 'Transaction started at %', NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS VOID AS $$
BEGIN
    -- This is a placeholder for transaction management
    RAISE NOTICE 'Transaction committed at %', NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS VOID AS $$
BEGIN
    -- This is a placeholder for transaction management
    RAISE NOTICE 'Transaction rolled back at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Create application settings table for system configuration
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID, -- NULL for global settings
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    setting_type VARCHAR(50) DEFAULT 'string',
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE, -- Can be read by non-admin users
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT app_settings_unique UNIQUE (organization_id, setting_key)
);

-- Create indexes for app_settings
CREATE INDEX IF NOT EXISTS idx_app_settings_organization_id ON app_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_app_settings_public ON app_settings(is_public, organization_id) WHERE is_public = TRUE;

-- Insert default system settings
INSERT INTO app_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
('system_name', '"Audit Management System"', 'string', 'System display name', true),
('max_file_size_mb', '50', 'number', 'Maximum file upload size in MB', true),
('session_timeout_minutes', '480', 'number', 'Session timeout in minutes (8 hours)', false),
('password_min_length', '8', 'number', 'Minimum password length', true),
('password_require_uppercase', 'true', 'boolean', 'Require uppercase letters in passwords', true),
('password_require_lowercase', 'true', 'boolean', 'Require lowercase letters in passwords', true),
('password_require_numbers', 'true', 'boolean', 'Require numbers in passwords', true),
('password_require_symbols', 'true', 'boolean', 'Require symbols in passwords', true),
('invitation_expiry_days', '7', 'number', 'Invitation token expiry in days', false),
('max_login_attempts', '5', 'number', 'Maximum failed login attempts before lockout', false),
('lockout_duration_minutes', '30', 'number', 'Account lockout duration in minutes', false),
('audit_log_retention_years', '7', 'number', 'Audit log retention period in years', false),
('enable_email_notifications', 'true', 'boolean', 'Enable email notifications', false),
('enable_security_monitoring', 'true', 'boolean', 'Enable security event monitoring', false),
('default_user_role', '"auditor"', 'string', 'Default role for new users', false),
('allowed_file_types', '["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"]', 'array', 'Allowed file MIME types', true)
ON CONFLICT (organization_id, setting_key) DO NOTHING;

-- Create database schema version tracking
CREATE TABLE IF NOT EXISTS schema_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_by VARCHAR(100) DEFAULT current_user,
    script_checksum VARCHAR(64) -- SHA-256 checksum of the migration script
);

-- Insert initial schema version
INSERT INTO schema_versions (version, description, script_checksum) VALUES
('1.0.0', 'Initial database schema with multi-tenant RBAC', encode(digest('initial_schema', 'sha256'), 'hex'))
ON CONFLICT (version) DO NOTHING;

-- Create function to get application setting
CREATE OR REPLACE FUNCTION get_app_setting(
    p_organization_id UUID,
    p_setting_key VARCHAR,
    p_default_value JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Try organization-specific setting first
    IF p_organization_id IS NOT NULL THEN
        SELECT setting_value INTO result
        FROM app_settings
        WHERE organization_id = p_organization_id
        AND setting_key = p_setting_key;
        
        IF FOUND THEN
            RETURN result;
        END IF;
    END IF;
    
    -- Fall back to global setting
    SELECT setting_value INTO result
    FROM app_settings
    WHERE organization_id IS NULL
    AND setting_key = p_setting_key;
    
    -- Return default if not found
    RETURN COALESCE(result, p_default_value);
END;
$$ LANGUAGE plpgsql;

-- Create function to set application setting
CREATE OR REPLACE FUNCTION set_app_setting(
    p_organization_id UUID,
    p_setting_key VARCHAR,
    p_setting_value JSONB,
    p_setting_type VARCHAR DEFAULT 'string',
    p_created_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO app_settings (
        organization_id, setting_key, setting_value, setting_type, created_by
    ) VALUES (
        p_organization_id, p_setting_key, p_setting_value, p_setting_type, p_created_by
    )
    ON CONFLICT (organization_id, setting_key)
    DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        setting_type = EXCLUDED.setting_type,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for organization statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS organization_stats AS
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    COUNT(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL) as total_users,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'admin' AND u.deleted_at IS NULL) as admin_count,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'auditor' AND u.deleted_at IS NULL) as auditor_count,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'reviewer' AND u.deleted_at IS NULL) as reviewer_count,
    COUNT(DISTINCT p.id) FILTER (WHERE p.deleted_at IS NULL) as total_projects,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active' AND p.deleted_at IS NULL) as active_projects,
    COUNT(DISTINCT d.id) FILTER (WHERE d.deleted_at IS NULL) as total_documents,
    COUNT(DISTINCT ar.id) FILTER (WHERE ar.deleted_at IS NULL) as total_reports,
    o.created_at as org_created_at,
    NOW() as stats_updated_at
FROM organizations o
LEFT JOIN users u ON o.id = u.organization_id
LEFT JOIN projects p ON o.id = p.organization_id
LEFT JOIN documents d ON o.id = d.organization_id
LEFT JOIN audit_reports ar ON o.id = ar.organization_id
WHERE o.deleted_at IS NULL
GROUP BY o.id, o.name, o.created_at;

-- Create unique index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_stats_org_id ON organization_stats(organization_id);

-- Create function to refresh organization statistics
CREATE OR REPLACE FUNCTION refresh_organization_stats()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY organization_stats;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled job function for maintenance tasks
CREATE OR REPLACE FUNCTION run_maintenance_tasks()
RETURNS VOID AS $$
BEGIN
    -- Clean up expired invitations
    PERFORM expire_old_invitations();
    
    -- Clean up expired tokens
    PERFORM cleanup_expired_tokens();
    
    -- Clean up expired deletion requests
    PERFORM cleanup_expired_deletion_requests();
    
    -- Detect anomalous login patterns
    PERFORM detect_anomalous_logins();
    
    -- Refresh organization statistics
    PERFORM refresh_organization_stats();
    
    -- Log maintenance completion
    INSERT INTO system_health_logs (
        service_name, metric_name, message, severity
    ) VALUES (
        'maintenance', 'scheduled_tasks', 'Maintenance tasks completed successfully', 'info'
    );
END;
$$ LANGUAGE plpgsql;

-- Create health check function
CREATE OR REPLACE FUNCTION system_health_check()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    db_size BIGINT;
    active_connections INTEGER;
    org_count INTEGER;
    user_count INTEGER;
BEGIN
    -- Get database statistics
    SELECT pg_database_size(current_database()) INTO db_size;
    
    SELECT COUNT(*) INTO active_connections
    FROM pg_stat_activity
    WHERE state = 'active';
    
    SELECT COUNT(*) INTO org_count
    FROM organizations
    WHERE deleted_at IS NULL;
    
    SELECT COUNT(*) INTO user_count
    FROM users
    WHERE deleted_at IS NULL;
    
    -- Build health check result
    result := jsonb_build_object(
        'status', 'healthy',
        'timestamp', NOW(),
        'database_size_bytes', db_size,
        'active_connections', active_connections,
        'total_organizations', org_count,
        'total_users', user_count,
        'version', (SELECT version FROM schema_versions ORDER BY applied_at DESC LIMIT 1)
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create backup verification function
CREATE OR REPLACE FUNCTION verify_data_integrity()
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}';
    orphaned_records INTEGER;
BEGIN
    -- Check for orphaned users (no organization)
    SELECT COUNT(*) INTO orphaned_records
    FROM users u
    LEFT JOIN organizations o ON u.organization_id = o.id
    WHERE o.id IS NULL AND u.deleted_at IS NULL;
    
    result := jsonb_set(result, '{orphaned_users}', to_jsonb(orphaned_records));
    
    -- Check for orphaned projects
    SELECT COUNT(*) INTO orphaned_records
    FROM projects p
    LEFT JOIN organizations o ON p.organization_id = o.id
    WHERE o.id IS NULL AND p.deleted_at IS NULL;
    
    result := jsonb_set(result, '{orphaned_projects}', to_jsonb(orphaned_records));
    
    -- Check for orphaned documents
    SELECT COUNT(*) INTO orphaned_records
    FROM documents d
    LEFT JOIN projects p ON d.project_id = p.id
    WHERE p.id IS NULL AND d.deleted_at IS NULL;
    
    result := jsonb_set(result, '{orphaned_documents}', to_jsonb(orphaned_records));
    
    -- Add timestamp
    result := jsonb_set(result, '{checked_at}', to_jsonb(NOW()));
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions for application user
-- Note: These should be customized based on your specific database user setup
DO $$
BEGIN
    -- Grant usage on schema
    GRANT USAGE ON SCHEMA public TO postgres;
    
    -- Grant permissions on all tables
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
    
    -- Grant permissions on all sequences
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;
    
    -- Grant execute on all functions
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;
    
    -- Set default privileges for future objects
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO postgres;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO postgres;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO postgres;
    
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Insufficient privileges to grant permissions. Please run as superuser.';
    WHEN undefined_object THEN
        RAISE NOTICE 'Application user does not exist. Please create it first.';
END $$;

-- Create database documentation table
CREATE TABLE IF NOT EXISTS database_documentation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    column_name VARCHAR(100),
    documentation TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT database_documentation_unique UNIQUE (table_name, column_name)
);

-- Insert table documentation
INSERT INTO database_documentation (table_name, documentation) VALUES
('organizations', 'Root table for multi-tenant architecture. Each organization represents a separate customer/tenant.'),
('users', 'User accounts with RBAC (Admin/Auditor/Reviewer roles) and strict organization isolation.'),
('invitations', 'Secure invitation system for onboarding users to organizations with token-based authentication.'),
('audit_logs', 'Comprehensive audit trail for all sensitive operations with detailed context and metadata.'),
('deleted_entities', 'Soft delete tracking system that maintains data integrity while allowing safe restoration.'),
('pending_deletion_requests', 'Workflow system for deletion approval process between Auditors and Admins.'),
('projects', 'Main business entities for organizing audit work with assignment and tracking capabilities.'),
('documents', 'File management with security classifications, version control, and processing status.'),
('audit_reports', 'Generated reports with approval workflows, distribution tracking, and access controls.')
ON CONFLICT (table_name, column_name) DO NOTHING;

-- Log successful initialization
INSERT INTO system_health_logs (
    service_name, metric_name, message, severity
) VALUES (
    'database', 'initialization', 'Database schema initialized successfully', 'info'
);

-- Output completion message
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Database initialization completed successfully';
    RAISE NOTICE 'Schema version: 1.0.0';
    RAISE NOTICE 'Timestamp: %', NOW();
    RAISE NOTICE '===========================================';
END $$;