-- ===================================================
-- ESUS AUDIT AI - SCHEMA ADAPTATION RECOMMENDATIONS
-- ===================================================
-- Based on the audit findings, these schema changes will support
-- enhanced features and fix current inconsistencies

-- ===================================================
-- CRITICAL FIXES REQUIRED
-- ===================================================

-- 1. Fix table name inconsistency (AdminPanel expects 'profiles' but schema has 'users')
-- Option A: Rename users table to profiles (RECOMMENDED)
-- ALTER TABLE users RENAME TO profiles;

-- Option B: Create a view for compatibility
CREATE OR REPLACE VIEW profiles AS 
SELECT 
    id,
    email,
    first_name,
    last_name,
    role,
    company,
    is_active as status,
    created_at,
    updated_at,
    last_login_at as last_sign_in_at
FROM users;

-- 2. Add missing status field to users table (referenced in AdminPanel)
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
CHECK (status IN ('active', 'inactive', 'suspended', 'pending'));

-- 3. Fix projects table to match API expectations
-- Add user_id field that some API routes expect (or fix the API routes)
-- ALTER TABLE projects ADD COLUMN user_id UUID REFERENCES users(id);
-- Or better: Update API routes to use created_by instead of user_id

-- ===================================================
-- ENHANCED FEATURES SUPPORT
-- ===================================================

-- 4. Support for "Key Findings" feature (Ask Esus enhancement)
CREATE TABLE IF NOT EXISTS key_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chat_message_id UUID REFERENCES chat_history(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    auditor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    importance_level VARCHAR(20) DEFAULT 'medium' CHECK (importance_level IN ('low', 'medium', 'high', 'critical')),
    tags TEXT[],
    is_included_in_report BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Document version control support
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_current_version BOOLEAN DEFAULT true;

-- 6. Custom report templates support
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_content JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false,
    template_type VARCHAR(50) DEFAULT 'general',
    red_flag_filters JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Enhanced audit trail for compliance
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

-- 8. File duplicate detection support
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES documents(id);

-- 9. Project-specific reviewer assignments
CREATE TABLE IF NOT EXISTS project_reviewers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_notes TEXT,
    status VARCHAR(20) DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'declined', 'completed')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(project_id, reviewer_id)
);

-- 10. Chat interaction limits for reviewers (limited Ask Esus)
CREATE TABLE IF NOT EXISTS user_chat_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    daily_question_limit INTEGER DEFAULT 10,
    questions_used_today INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(user_id, project_id)
);

-- ===================================================
-- PERFORMANCE IMPROVEMENTS
-- ===================================================

-- 11. Additional indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(file_hash) WHERE file_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_key_findings_project ON key_findings(project_id);
CREATE INDEX IF NOT EXISTS idx_key_findings_importance ON key_findings(importance_level);
CREATE INDEX IF NOT EXISTS idx_project_reviewers_status ON project_reviewers(status);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_version ON documents(parent_document_id, version_number);

-- ===================================================
-- TRIGGERS FOR NEW TABLES
-- ===================================================

-- Trigger for key_findings updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_key_findings_updated_at
    BEFORE UPDATE ON key_findings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_templates_updated_at
    BEFORE UPDATE ON report_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to reset daily chat limits
CREATE OR REPLACE FUNCTION reset_daily_chat_limits()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_reset_date < CURRENT_DATE THEN
        NEW.questions_used_today = 0;
        NEW.last_reset_date = CURRENT_DATE;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER reset_chat_limits_daily
    BEFORE UPDATE ON user_chat_limits
    FOR EACH ROW EXECUTE FUNCTION reset_daily_chat_limits();

-- ===================================================
-- DATA INTEGRITY CONSTRAINTS
-- ===================================================

-- Ensure only one current version per document group
CREATE UNIQUE INDEX idx_documents_current_version 
ON documents (parent_document_id) 
WHERE is_current_version = true AND parent_document_id IS NOT NULL;

-- Ensure reviewers can only be assigned to projects they have access to
-- (This constraint should be enforced at the application level)

-- ===================================================
-- RLS POLICIES RECOMMENDATIONS
-- ===================================================

-- Enable RLS on new tables if using Supabase
-- ALTER TABLE key_findings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE project_reviewers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_chat_limits ENABLE ROW LEVEL SECURITY;

-- Example RLS policy for key_findings
-- CREATE POLICY "Users can only access key findings for their projects" ON key_findings
-- FOR ALL USING (
--     project_id IN (
--         SELECT id FROM projects 
--         WHERE created_by = auth.uid() 
--         OR auth.uid() = ANY(assigned_to)
--     )
-- );

-- ===================================================
-- MIGRATION NOTES
-- ===================================================
-- 1. Test all changes in a development environment first
-- 2. Create backups before applying changes
-- 3. Update application code to use new fields
-- 4. Consider data migration for existing records
-- 5. Update API documentation to reflect schema changes
-- ===================================================