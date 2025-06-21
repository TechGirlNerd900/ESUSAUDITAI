-- Create audit program templates
CREATE TABLE IF NOT EXISTS audit_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    procedures JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID
);

-- Create trigger for audit_templates
CREATE TRIGGER update_audit_templates_updated_at 
    BEFORE UPDATE ON audit_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert basic templates
INSERT INTO audit_templates (name, category, procedures) VALUES
('Internal Controls Review', 'Financial', '{
    "steps": [
        {"name": "Document Control Environment", "required": true},
        {"name": "Test Key Controls", "required": true},
        {"name": "Evaluate Design Effectiveness", "required": true}
    ]
}'::jsonb),
('Compliance Audit', 'Regulatory', '{
    "steps": [
        {"name": "Review Regulatory Requirements", "required": true},
        {"name": "Test Compliance Controls", "required": true},
        {"name": "Document Findings", "required": true}
    ]
}'::jsonb)
ON CONFLICT (id) DO NOTHING;