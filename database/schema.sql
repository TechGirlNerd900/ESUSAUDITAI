-- Esus Audit AI Database Schema
-- PostgreSQL Database Schema

-- Enable UUID extension first
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing triggers first to avoid conflicts
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
DROP TRIGGER IF EXISTS update_audit_reports_updated_at ON audit_reports;
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
DROP TRIGGER IF EXISTS track_user_password_change ON users;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS track_password_change();

-- Drop existing indexes
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
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audit_reports_updated_at 
    BEFORE UPDATE ON audit_reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at 
    BEFORE UPDATE ON app_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Audit Management System Database Schema
-- Create all tables needed for the audit management system

-- Create audit_programs table
CREATE TABLE audit_programs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    standard_reference VARCHAR(100),
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    required_procedures JSONB,
    compliance_requirements JSONB,
    status VARCHAR(20) CHECK (status IN ('draft', 'approved', 'archived')) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

-- Create projects table (referenced by other tables)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    project_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) CHECK (status IN ('planning', 'execution', 'completion', 'archived')) DEFAULT 'planning',
    budget DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create workpapers table
CREATE TABLE workpapers (
    id SERIAL PRIMARY KEY,
    audit_program_id INTEGER REFERENCES audit_programs(id),
    project_id UUID REFERENCES projects(id),
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    procedure_steps JSONB,
    status VARCHAR(20) CHECK (status IN ('draft', 'in_progress', 'review', 'completed', 'archived')) DEFAULT 'draft',
    prepared_by INTEGER,
    reviewed_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create risk_assessments table
CREATE TABLE risk_assessments (
    id SERIAL PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    audit_program_id INTEGER REFERENCES audit_programs(id),
    area VARCHAR(255) NOT NULL,
    risk_description TEXT,
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    impact_assessment TEXT,
    likelihood VARCHAR(20) CHECK (likelihood IN ('remote', 'unlikely', 'possible', 'likely', 'certain')),
    mitigating_controls TEXT,
    residual_risk_level VARCHAR(20) CHECK (residual_risk_level IN ('low', 'medium', 'high', 'critical')),
    assessed_by INTEGER,
    assessment_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_samples table
CREATE TABLE audit_samples (
    id SERIAL PRIMARY KEY,
    workpaper_id INTEGER REFERENCES workpapers(id),
    project_id UUID REFERENCES projects(id),
    population_size INTEGER,
    sample_size INTEGER,
    confidence_level DECIMAL(5,2),
    materiality_threshold DECIMAL(10,6),
    sampling_method VARCHAR(50),
    selected_items JSONB,
    selection_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    user_id INTEGER,
    details JSONB,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Create users table (referenced by other tables)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) CHECK (role IN ('auditor', 'senior_auditor', 'manager', 'partner', 'admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create findings table
CREATE TABLE findings (
    id SERIAL PRIMARY KEY,
    workpaper_id INTEGER REFERENCES workpapers(id),
    project_id UUID REFERENCES projects(id),
    finding_type VARCHAR(50) CHECK (finding_type IN ('deficiency', 'significant_deficiency', 'material_weakness', 'observation')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    impact_assessment TEXT,
    recommendation TEXT,
    management_response TEXT,
    status VARCHAR(20) CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    identified_by UUID REFERENCES users(id),  -- Changed INTEGER to UUID
    identified_date DATE DEFAULT CURRENT_DATE,
    target_resolution_date DATE,
    actual_resolution_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create evidence table
CREATE TABLE evidence (
    id SERIAL PRIMARY KEY,
    workpaper_id INTEGER REFERENCES workpapers(id),
    finding_id INTEGER REFERENCES findings(id),
    evidence_type VARCHAR(50) CHECK (evidence_type IN ('document', 'screenshot', 'data_extract', 'correspondence', 'observation')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),
    hash_value VARCHAR(128),
    collected_by UUID REFERENCES users(id),  -- Changed INTEGER to UUID
    collected_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_audit_programs_status ON audit_programs(status);
CREATE INDEX idx_audit_programs_risk_level ON audit_programs(risk_level);
CREATE INDEX idx_workpapers_audit_program ON workpapers(audit_program_id);
CREATE INDEX idx_workpapers_project ON workpapers(project_id);
CREATE INDEX idx_workpapers_status ON workpapers(status);
CREATE INDEX idx_risk_assessments_project ON risk_assessments(project_id);
CREATE INDEX idx_risk_assessments_risk_level ON risk_assessments(risk_level);
CREATE INDEX idx_audit_samples_workpaper ON audit_samples(workpaper_id);
CREATE INDEX idx_findings_project ON findings(project_id);
CREATE INDEX idx_findings_status ON findings(status);
CREATE INDEX idx_evidence_workpaper ON evidence(workpaper_id);

-- Create triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_audit_programs_updated_at BEFORE UPDATE ON audit_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workpapers_updated_at BEFORE UPDATE ON workpapers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_risk_assessments_updated_at BEFORE UPDATE ON risk_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_findings_updated_at BEFORE UPDATE ON findings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE audit_programs IS 'Standard audit programs and procedures based on industry standards';
COMMENT ON TABLE workpapers IS 'Individual workpapers and procedures within audit programs';
COMMENT ON TABLE risk_assessments IS 'Risk assessments for audit areas and procedures';
COMMENT ON TABLE audit_samples IS 'Sampling configurations and selections for audit procedures';
COMMENT ON TABLE findings IS 'Audit findings, deficiencies, and observations';
COMMENT ON TABLE evidence IS 'Supporting evidence and documentation for findings and procedures';
COMMENT ON TABLE audit_logs IS 'System audit trail for all actions and changes';

