-- Esus Audit AI Database Initialization
-- This file sets up the initial database structure and essential data

-- Create initial admin user (password should be changed on first login)
-- Default password: 'EsusAdmin2024!' (hashed with bcrypt)
INSERT INTO users (email, password_hash, first_name, last_name, role, company, is_active, created_at, updated_at) VALUES
('admin@esusaudit.ai', '$2a$12$LQv3c1yqBwEHFqHALGMJ4.VQVn5UVUFMHDsLaeEay7NCWDyDq7/1e', 'System', 'Administrator', 'admin', 'Esus Audit AI', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (email) DO NOTHING;

-- Create indexes for better performance (if not already created in schema)
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_name);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_analysis_confidence ON analysis_results(confidence_score);

-- Insert application settings/configuration
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'general',
    is_sensitive BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by VARCHAR(255)
);

-- Create trigger for app_settings updated_at
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION update_app_settings_updated_at();

INSERT INTO app_settings (key, value, description, category, is_sensitive, last_updated_by) VALUES
('app_version', '1.0.0', 'Current application version', 'system', false, 'admin@esusaudit.ai'),
('max_file_size_mb', '50', 'Maximum file upload size in MB', 'upload', false, 'admin@esusaudit.ai'),
('supported_file_types', 'pdf,xlsx,xls,docx,doc,csv', 'Comma-separated list of supported file extensions', 'upload', false, 'admin@esusaudit.ai'),
('ai_confidence_threshold', '0.7', 'Minimum confidence score for AI analysis results', 'ai', false, 'admin@esusaudit.ai'),
('session_timeout_hours', '24', 'User session timeout in hours', 'security', false, 'admin@esusaudit.ai'),
('enable_email_notifications', 'true', 'Enable email notifications for users', 'notifications', false, 'admin@esusaudit.ai'),
('maintenance_mode', 'false', 'Application maintenance mode flag', 'system', false, 'admin@esusaudit.ai'),
('max_login_attempts', '5', 'Maximum failed login attempts before account lockout', 'security', false, 'admin@esusaudit.ai'),
('account_lockout_duration_minutes', '30', 'Account lockout duration in minutes', 'security', false, 'admin@esusaudit.ai'),
('password_min_length', '8', 'Minimum password length requirement', 'security', false, 'admin@esusaudit.ai'),
('require_password_complexity', 'true', 'Require complex passwords (uppercase, lowercase, numbers, symbols)', 'security', false, 'admin@esusaudit.ai'),
('jwt_expiry_hours', '24', 'JWT token expiry time in hours', 'security', true, 'admin@esusaudit.ai'),
('enable_audit_logging', 'true', 'Enable detailed audit logging', 'system', false, 'admin@esusaudit.ai'),
('default_analysis_timeout_seconds', '300', 'Default timeout for document analysis in seconds', 'ai', false, 'admin@esusaudit.ai'),
('enable_demo_mode', 'false', 'Enable demo mode with sample data', 'system', false, 'admin@esusaudit.ai')
ON CONFLICT (key) DO NOTHING;