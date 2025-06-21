-- Esus Audit AI Database Initialization
-- This file sets up the initial database structure and essential data

-- Create app_settings table if it doesn't exist
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

-- Esus Audit AI Database Schema
-- PostgreSQL Database Schema

-- Enable UUID extension first
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing indexes first (if they exist)
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_active;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_company;
DROP INDEX IF EXISTS idx_users_last_login;
DROP INDEX IF EXISTS idx_projects_created_by;
DROP INDEX IF EXISTS idx_projects_status;
DROP INDEX IF EXISTS idx_projects_client;
DROP INDEX IF EXISTS idx_projects_dates;
DROP INDEX IF EXISTS idx_projects_assigned_to;
DROP INDEX IF EXISTS idx_documents_project_id;
DROP INDEX IF EXISTS idx_documents_uploaded_by;
DROP INDEX IF EXISTS idx_documents_status;
DROP INDEX IF EXISTS idx_documents_file_type;
DROP INDEX IF EXISTS idx_documents_created_at;
DROP INDEX IF EXISTS idx_documents_project_status;
DROP INDEX IF EXISTS idx_analysis_results_document_id;
DROP INDEX IF EXISTS idx_analysis_confidence;
DROP INDEX IF EXISTS idx_analysis_created_at;
DROP INDEX IF EXISTS idx_analysis_processing_time;
DROP INDEX IF EXISTS idx_chat_history_project_id;
DROP INDEX IF EXISTS idx_chat_history_user_id;
DROP INDEX IF EXISTS idx_chat_history_created_at;
DROP INDEX IF EXISTS idx_chat_history_project_user;
DROP INDEX IF EXISTS idx_audit_reports_project_id;
DROP INDEX IF EXISTS idx_audit_reports_generated_by;
DROP INDEX IF EXISTS idx_audit_reports_status;
DROP INDEX IF EXISTS idx_audit_reports_created_at;
DROP INDEX IF EXISTS idx_audit_logs_user_id;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_resource;
DROP INDEX IF EXISTS idx_audit_logs_created_at;
DROP INDEX IF EXISTS idx_audit_logs_success;
DROP INDEX IF EXISTS idx_audit_logs_ip_address;
DROP INDEX IF EXISTS idx_app_settings_category;
DROP INDEX IF EXISTS idx_app_settings_sensitive;
DROP INDEX IF EXISTS idx_app_settings_updated_by;

-- Drop existing tables in correct order (dependent tables first)
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS chat_history;
DROP TABLE IF EXISTS analysis_results;
DROP TABLE IF EXISTS audit_reports;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS users;

-- Drop existing functions (after tables are dropped)
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS track_password_change();


-- Create tables
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL CHECK (LENGTH(TRIM(first_name)) > 0),
    last_name VARCHAR(100) NOT NULL CHECK (LENGTH(TRIM(last_name)) > 0),
    role VARCHAR(20) DEFAULT 'auditor' CHECK (role IN ('admin', 'auditor', 'reviewer')),
    company VARCHAR(255),
    last_login_at TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    assigned_to UUID[] DEFAULT '{}',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES users(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(100),
    blob_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'analyzed', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    extracted_data JSONB,
    ai_summary TEXT,
    red_flags TEXT[],
    highlights TEXT[],
    confidence_score DECIMAL(3,2),
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    context_documents UUID[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    generated_by UUID REFERENCES users(id) ON DELETE CASCADE,
    report_name VARCHAR(255) NOT NULL,
    report_data JSONB,
    pdf_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
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

CREATE TABLE app_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'general',
    is_sensitive BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by VARCHAR(255)
);

-- Create functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

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

-- Create triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_audit_reports_updated_at ON audit_reports;
CREATE TRIGGER update_audit_reports_updated_at 
    BEFORE UPDATE ON audit_reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at 
    BEFORE UPDATE ON app_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS track_user_password_change ON users;
CREATE TRIGGER track_user_password_change 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION track_password_change();

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_company ON users(company);
CREATE INDEX idx_users_last_login ON users(last_login_at);

CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_client ON projects(client_name);
CREATE INDEX idx_projects_dates ON projects(start_date, end_date);
CREATE INDEX idx_projects_assigned_to ON projects USING GIN(assigned_to);

CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_file_type ON documents(file_type);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_project_status ON documents(project_id, status);

CREATE INDEX idx_analysis_results_document_id ON analysis_results(document_id);
CREATE INDEX idx_analysis_confidence ON analysis_results(confidence_score);
CREATE INDEX idx_analysis_created_at ON analysis_results(created_at);
CREATE INDEX idx_analysis_processing_time ON analysis_results(processing_time_ms);

CREATE INDEX idx_chat_history_project_id ON chat_history(project_id);
CREATE INDEX idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX idx_chat_history_created_at ON chat_history(created_at);
CREATE INDEX idx_chat_history_project_user ON chat_history(project_id, user_id);

CREATE INDEX idx_audit_reports_project_id ON audit_reports(project_id);
CREATE INDEX idx_audit_reports_generated_by ON audit_reports(generated_by);
CREATE INDEX idx_audit_reports_status ON audit_reports(status);
CREATE INDEX idx_audit_reports_created_at ON audit_reports(created_at);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_success ON audit_logs(success);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);

CREATE INDEX idx_app_settings_category ON app_settings(category);
CREATE INDEX idx_app_settings_sensitive ON app_settings(is_sensitive);
CREATE INDEX idx_app_settings_updated_by ON app_settings(last_updated_by);