-- Migration: Enhanced Security and Performance Features
-- Version: 1.1.0
-- Date: 2024-01-20
-- Description: Adds enhanced security features, performance optimizations, and audit logging

-- Begin transaction
BEGIN;

-- Add new columns to users table for enhanced security
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

-- Add email validation constraint
DO $$
BEGIN
    ALTER TABLE users ADD CONSTRAINT users_email_format_check 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add name validation constraints
DO $$
BEGIN
    ALTER TABLE users ADD CONSTRAINT users_first_name_not_empty_check 
    CHECK (LENGTH(TRIM(first_name)) > 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE users ADD CONSTRAINT users_last_name_not_empty_check 
    CHECK (LENGTH(TRIM(last_name)) > 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enhance app_settings table
DO $$
BEGIN
    ALTER TABLE app_settings 
    ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS is_sensitive BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_updated_by VARCHAR(255);
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- Create new indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_name);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_to ON projects USING GIN(assigned_to);

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_project_status ON documents(project_id, status);

CREATE INDEX IF NOT EXISTS idx_analysis_confidence ON analysis_results(confidence_score);
CREATE INDEX IF NOT EXISTS idx_analysis_created_at ON analysis_results(created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_processing_time ON analysis_results(processing_time_ms);

CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_history_project_user ON chat_history(project_id, user_id);

CREATE INDEX IF NOT EXISTS idx_audit_reports_generated_by ON audit_reports(generated_by);
CREATE INDEX IF NOT EXISTS idx_audit_reports_status ON audit_reports(status);
CREATE INDEX IF NOT EXISTS idx_audit_reports_created_at ON audit_reports(created_at);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

-- App settings indexes
CREATE INDEX IF NOT EXISTS idx_app_settings_category ON app_settings(category);
CREATE INDEX IF NOT EXISTS idx_app_settings_sensitive ON app_settings(is_sensitive);
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_by ON app_settings(last_updated_by);

-- Create password change tracking function
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
$$ language 'plpgsql';

-- Create password change trigger
DROP TRIGGER IF EXISTS track_user_password_change ON users;
CREATE TRIGGER track_user_password_change 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION track_password_change();

-- Add app_settings update trigger
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at 
    BEFORE UPDATE ON app_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert new application settings
INSERT INTO app_settings (key, value, description, category, is_sensitive, last_updated_by) VALUES
('max_login_attempts', '5', 'Maximum failed login attempts before account lockout', 'security', false, 'system'),
('account_lockout_duration_minutes', '30', 'Account lockout duration in minutes', 'security', false, 'system'),
('password_min_length', '8', 'Minimum password length requirement', 'security', false, 'system'),
('require_password_complexity', 'true', 'Require complex passwords (uppercase, lowercase, numbers, symbols)', 'security', false, 'system'),
('jwt_expiry_hours', '24', 'JWT token expiry time in hours', 'security', true, 'system'),
('enable_audit_logging', 'true', 'Enable detailed audit logging', 'system', false, 'system'),
('default_analysis_timeout_seconds', '300', 'Default timeout for document analysis in seconds', 'ai', false, 'system'),
('enable_demo_mode', 'false', 'Enable demo mode with sample data', 'system', false, 'system')
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_sensitive = EXCLUDED.is_sensitive,
    last_updated_by = EXCLUDED.last_updated_by,
    updated_at = CURRENT_TIMESTAMP;

-- Update existing settings with categories
UPDATE app_settings SET 
    category = CASE 
        WHEN key IN ('app_version', 'maintenance_mode', 'enable_audit_logging', 'enable_demo_mode') THEN 'system'
        WHEN key IN ('max_file_size_mb', 'supported_file_types') THEN 'upload'
        WHEN key IN ('ai_confidence_threshold', 'default_analysis_timeout_seconds') THEN 'ai'
        WHEN key IN ('session_timeout_hours', 'max_login_attempts', 'account_lockout_duration_minutes', 'password_min_length', 'require_password_complexity', 'jwt_expiry_hours') THEN 'security'
        WHEN key IN ('enable_email_notifications') THEN 'notifications'
        ELSE 'general'
    END,
    is_sensitive = CASE 
        WHEN key IN ('jwt_expiry_hours') THEN true
        ELSE false
    END,
    last_updated_by = COALESCE(last_updated_by, 'system'),
    updated_at = CURRENT_TIMESTAMP
WHERE category IS NULL OR category = 'general';

-- Create audit log entry for this migration
INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, success, created_at)
VALUES (
    NULL,
    'database_migration',
    'schema',
    NULL,
    '{"migration": "001_enhanced_security_and_performance", "version": "1.1.0", "description": "Enhanced security features, performance optimizations, and audit logging"}'::jsonb,
    true,
    CURRENT_TIMESTAMP
);

-- Commit transaction
COMMIT;

-- Analyze tables for better query planning
ANALYZE users;
ANALYZE projects;
ANALYZE documents;
ANALYZE analysis_results;
ANALYZE chat_history;
ANALYZE audit_reports;
ANALYZE audit_logs;
ANALYZE app_settings;

-- Display migration summary
DO $$
BEGIN
    RAISE NOTICE 'Migration 001_enhanced_security_and_performance completed successfully';
    RAISE NOTICE 'Added security features: email validation, login tracking, account lockout';
    RAISE NOTICE 'Added performance features: comprehensive indexing strategy';
    RAISE NOTICE 'Added audit logging: comprehensive activity tracking';
    RAISE NOTICE 'Enhanced app settings: categorization and sensitivity flags';
END $$;
