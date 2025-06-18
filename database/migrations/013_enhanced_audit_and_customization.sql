-- Enhanced Audit and Customization Migration
-- Version: 1.0.0
-- Date: 2025-06-18

BEGIN;

-- 1. Add custom_fields and tags
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE documents ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- 2. Add soft delete (deleted_at)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. Enhance audit_logs table
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS field_changes JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS event_type VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'info';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 4. Audit log retention setting
INSERT INTO app_settings (key, value, description, category, is_sensitive, last_updated_by)
VALUES ('audit_log_retention_days', '365', 'Number of days to retain audit logs', 'system', false, 'system')
ON CONFLICT (key) DO NOTHING;

-- 5. Field-level change tracking function
CREATE OR REPLACE FUNCTION log_field_changes()
RETURNS TRIGGER AS $$
DECLARE
    changes JSONB := '{}';
    col TEXT;
BEGIN
    FOREACH col IN ARRAY TG_ARGV LOOP
        IF (TG_OP = 'UPDATE' AND (OLD.*)::jsonb -> col IS DISTINCT FROM (NEW.*)::jsonb -> col) THEN
            changes := jsonb_set(changes, ARRAY[col], jsonb_build_object('old', (OLD.*)::jsonb -> col, 'new', (NEW.*)::jsonb -> col));
        END IF;
    END LOOP;
    IF changes != '{}'::jsonb THEN
        INSERT INTO audit_logs (
            organization_id, user_id, action, resource_type, resource_id, field_changes, event_type, severity, tags, created_at
        ) VALUES (
            NEW.organization_id,
            NEW.updated_by,
            TG_OP,
            TG_TABLE_NAME,
            NEW.id,
            changes,
            'field_change',
            'info',
            ARRAY['field_change'],
            CURRENT_TIMESTAMP
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Triggers for field-level change tracking
DROP TRIGGER IF EXISTS audit_projects_field_changes ON projects;
CREATE TRIGGER audit_projects_field_changes
    AFTER UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION log_field_changes('name', 'description', 'status', 'custom_fields', 'tags');

DROP TRIGGER IF EXISTS audit_documents_field_changes ON documents;
CREATE TRIGGER audit_documents_field_changes
    AFTER UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION log_field_changes('original_name', 'file_path', 'file_type', 'status', 'custom_fields', 'tags');

DROP TRIGGER IF EXISTS audit_users_field_changes ON users;
CREATE TRIGGER audit_users_field_changes
    AFTER UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION log_field_changes('email', 'first_name', 'last_name', 'role', 'custom_fields');

-- 7. Utility function for audit log search/filtering
CREATE OR REPLACE FUNCTION search_audit_logs(
    p_organization_id UUID,
    p_event_type VARCHAR DEFAULT NULL,
    p_severity VARCHAR DEFAULT NULL,
    p_tag TEXT DEFAULT NULL,
    p_limit INT DEFAULT 100
) RETURNS SETOF audit_logs AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM audit_logs
    WHERE organization_id = p_organization_id
      AND (p_event_type IS NULL OR event_type = p_event_type)
      AND (p_severity IS NULL OR severity = p_severity)
      AND (p_tag IS NULL OR p_tag = ANY(tags))
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Utility function for soft delete
CREATE OR REPLACE FUNCTION soft_delete(table_name TEXT, row_id UUID, org_id UUID, user_id UUID) RETURNS VOID AS $$
DECLARE
    sql TEXT;
BEGIN
    sql := format('UPDATE %I SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2', table_name);
    EXECUTE sql USING row_id, org_id;
    INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, event_type, severity, tags, created_at)
    VALUES (org_id, user_id, 'SOFT_DELETE', table_name, row_id, 'soft_delete', 'warning', ARRAY['soft_delete'], CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Comments for clarity
COMMENT ON COLUMN projects.custom_fields IS 'Custom fields for extensibility (JSONB)';
COMMENT ON COLUMN projects.tags IS 'Tags for flexible categorization';
COMMENT ON COLUMN projects.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN documents.custom_fields IS 'Custom fields for extensibility (JSONB)';
COMMENT ON COLUMN documents.tags IS 'Tags for flexible categorization';
COMMENT ON COLUMN documents.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN users.custom_fields IS 'Custom fields for extensibility (JSONB)';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN audit_logs.field_changes IS 'Field-level before/after changes (JSONB)';
COMMENT ON COLUMN audit_logs.event_type IS 'Type of event (e.g., login, data_export, field_change)';
COMMENT ON COLUMN audit_logs.severity IS 'Severity of event (info, warning, critical)';
COMMENT ON COLUMN audit_logs.tags IS 'Tags for flexible filtering';

COMMIT; 