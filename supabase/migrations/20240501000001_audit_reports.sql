-- Audit Report Generation System
-- Migration: 20250125_audit_reports.sql

-- Create audit_engagements table
CREATE TABLE IF NOT EXISTS audit_engagements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name VARCHAR(255) NOT NULL,
    client_id UUID,
    engagement_type VARCHAR(100) NOT NULL,
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,
    audit_standard VARCHAR(50) NOT NULL DEFAULT 'Nigerian',
    entity_type VARCHAR(100) NOT NULL,
    
    -- Audit findings
    significant_matters TEXT[] DEFAULT '{}',
    key_audit_matters TEXT[] DEFAULT '{}',
    material_weaknesses TEXT[] DEFAULT '{}',
    management_letter_points TEXT[] DEFAULT '{}',
    
    -- Additional engagement data
    engagement_data JSONB DEFAULT '{}',
    
    -- Multi-tenancy and metadata
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Constraints
    CONSTRAINT valid_period CHECK (reporting_period_end >= reporting_period_start),
    CONSTRAINT valid_audit_standard CHECK (audit_standard IN ('ISA', 'ASA', 'PCAOB', 'Nigerian'))
);

-- Create audit_report_templates table
CREATE TABLE IF NOT EXISTS audit_report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('statutory', 'management', 'special', 'interim', 'compilation')),
    audit_standard VARCHAR(50) NOT NULL,
    applicable_entities TEXT[] DEFAULT '{}',
    sections JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Template can be global (organization_id = NULL) or organization-specific
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Constraints
    CONSTRAINT template_org_or_global CHECK (
        organization_id IS NULL OR organization_id IS NOT NULL
    )
);

-- Create audit_reports table
CREATE TABLE IF NOT EXISTS audit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    engagement_id UUID NOT NULL REFERENCES audit_engagements(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES audit_report_templates(id),
    report_type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    
    -- Report content
    sections JSONB NOT NULL DEFAULT '[]',
    audit_opinion JSONB NOT NULL DEFAULT '{}',
    key_findings JSONB NOT NULL DEFAULT '{}',
    recommendations TEXT[] DEFAULT '{}',
    
    -- Report metadata
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'issued')),
    word_count INTEGER DEFAULT 0,
    page_count INTEGER DEFAULT 0,
    version VARCHAR(20) DEFAULT '1.0',
    parent_report_id UUID REFERENCES audit_reports(id),
    
    -- Multi-tenancy and metadata
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Approval workflow
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    issued_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    report_period_start DATE,
    report_period_end DATE,
    published_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT '{}'
);

-- Create audit_report_sections table for detailed section management
CREATE TABLE IF NOT EXISTS audit_report_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
    section_id VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    generated_content TEXT,
    order_number INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT false,
    word_count INTEGER DEFAULT 0,
    
    -- Template variables and metadata
    template_variables JSONB DEFAULT '{}',
    last_generated_at TIMESTAMP WITH TIME ZONE,
    
    -- Multi-tenancy
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Constraints
    UNIQUE(report_id, section_id)
);

-- Create audit_report_history table for version tracking
CREATE TABLE IF NOT EXISTS audit_report_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('created', 'content_updated', 'status_changed', 'approved', 'issued')),
    changes JSONB,
    change_summary TEXT,
    
    -- User and timestamp
    changed_by UUID NOT NULL REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Multi-tenancy
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
);

-- Create audit_report_attachments table
CREATE TABLE IF NOT EXISTS audit_report_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    attachment_type VARCHAR(50) NOT NULL CHECK (attachment_type IN ('working_paper', 'evidence', 'supporting_document', 'export')),
    description TEXT,
    
    -- Multi-tenancy and metadata
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_audit_engagements_org_id ON audit_engagements(organization_id);
CREATE INDEX idx_audit_engagements_client ON audit_engagements(client_name);
CREATE INDEX idx_audit_engagements_period ON audit_engagements(reporting_period_end);
CREATE INDEX idx_audit_engagements_type ON audit_engagements(engagement_type);

CREATE INDEX idx_audit_report_templates_org_id ON audit_report_templates(organization_id);
CREATE INDEX idx_audit_report_templates_type ON audit_report_templates(report_type);
CREATE INDEX idx_audit_report_templates_standard ON audit_report_templates(audit_standard);

CREATE INDEX idx_audit_reports_org_id ON audit_reports(organization_id);

CREATE INDEX idx_audit_reports_template_id ON audit_reports(template_id);
DROP INDEX IF EXISTS idx_audit_reports_status;
CREATE INDEX IF NOT EXISTS idx_audit_reports_status ON audit_reports(status);
DROP INDEX IF EXISTS idx_audit_reports_type;
CREATE INDEX IF NOT EXISTS idx_audit_reports_type ON audit_reports(report_type);
CREATE INDEX idx_audit_reports_generated_at ON audit_reports(generated_at);

CREATE INDEX idx_audit_report_sections_report_id ON audit_report_sections(report_id);
CREATE INDEX idx_audit_report_sections_order ON audit_report_sections(report_id, order_number);

CREATE INDEX idx_audit_report_history_report_id ON audit_report_history(report_id);
CREATE INDEX idx_audit_report_history_changed_at ON audit_report_history(changed_at);

CREATE INDEX idx_audit_report_attachments_report_id ON audit_report_attachments(report_id);
CREATE INDEX idx_audit_report_attachments_type ON audit_report_attachments(attachment_type);

-- Row Level Security (RLS) Policies
ALTER TABLE audit_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_report_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_report_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_report_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_engagements
CREATE POLICY "Users can view their organization's engagements" ON audit_engagements
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their organization's engagements" ON audit_engagements
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

-- RLS Policies for audit_report_templates
CREATE POLICY "Users can view global templates or their organization's templates" ON audit_report_templates
    FOR SELECT USING (
        organization_id IS NULL OR 
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create templates for their organization" ON audit_report_templates
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their organization's templates" ON audit_report_templates
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

-- RLS Policies for audit_reports
CREATE POLICY "Users can view their organization's reports" ON audit_reports
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their organization's reports" ON audit_reports
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

-- RLS Policies for audit_report_sections
CREATE POLICY "Users can view their organization's report sections" ON audit_report_sections
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their organization's report sections" ON audit_report_sections
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

-- RLS Policies for audit_report_history
CREATE POLICY "Users can view their organization's report history" ON audit_report_history
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "System can insert report history" ON audit_report_history
    FOR INSERT WITH CHECK (true);

-- RLS Policies for audit_report_attachments
CREATE POLICY "Users can view their organization's report attachments" ON audit_report_attachments
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their organization's report attachments" ON audit_report_attachments
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

-- Create functions for audit report operations

-- Function to get audit report analytics
CREATE OR REPLACE FUNCTION get_audit_report_analytics(org_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    total_reports INTEGER;
    by_status JSONB;
    by_type JSONB;
    recent_activity JSONB;
    word_count_stats JSONB;
BEGIN
    -- Get total reports count
    SELECT COUNT(*) INTO total_reports
    FROM audit_reports
    WHERE organization_id = org_id;
    
    -- Count by status
    SELECT jsonb_object_agg(status, count)
    INTO by_status
    FROM (
        SELECT status, COUNT(*) as count
        FROM audit_reports
        WHERE organization_id = org_id
        GROUP BY status
    ) t;
    
    -- Count by report type
    SELECT jsonb_object_agg(report_type, count)
    INTO by_type
    FROM (
        SELECT report_type, COUNT(*) as count
        FROM audit_reports
        WHERE organization_id = org_id
        GROUP BY report_type
    ) t;
    
    -- Get recent activity (last 30 days)
    SELECT jsonb_agg(
        jsonb_build_object(
            'reportId', id,
            'title', title,
            'status', status,
            'generatedAt', generated_at
        )
    )
    INTO recent_activity
    FROM (
        SELECT id, title, status, generated_at
        FROM audit_reports
        WHERE organization_id = org_id 
        AND generated_at > now() - interval '30 days'
        ORDER BY generated_at DESC
        LIMIT 10
    ) recent;
    
    -- Calculate word count statistics
    SELECT jsonb_build_object(
        'totalWords', COALESCE(SUM(word_count), 0),
        'averageWords', COALESCE(AVG(word_count), 0),
        'maxWords', COALESCE(MAX(word_count), 0),
        'minWords', COALESCE(MIN(word_count), 0)
    )
    INTO word_count_stats
    FROM audit_reports
    WHERE organization_id = org_id AND word_count > 0;
    
    -- Build result object
    result := jsonb_build_object(
        'totalReports', total_reports,
        'byStatus', COALESCE(by_status, '{}'),
        'byType', COALESCE(by_type, '{}'),
        'recentActivity', COALESCE(recent_activity, '[]'),
        'wordCountStats', COALESCE(word_count_stats, '{}'),
        'generatedAt', now()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate audit report completeness
CREATE OR REPLACE FUNCTION validate_audit_report(report_id UUID)
RETURNS JSONB AS $$
DECLARE
    report_record RECORD;
    template_record RECORD;
    missing_sections TEXT[] := '{}';
    warnings TEXT[] := '{}';
    completeness_score INTEGER := 0;
    total_required_sections INTEGER := 0;
    result JSONB;
BEGIN
    -- Get report data
    SELECT * INTO report_record
    FROM audit_reports
    WHERE id = report_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'isValid', false,
            'error', 'Report not found'
        );
    END IF;
    
    -- Get template data
    SELECT * INTO template_record
    FROM audit_report_templates
    WHERE id = report_record.template_id;
    
    -- Count required sections from template
    SELECT 
        COUNT(*) FILTER (WHERE (section->>'isRequired')::boolean = true)
    INTO total_required_sections
    FROM jsonb_array_elements(template_record.sections) AS section;
    
    -- Check for missing required sections
    SELECT array_agg(section->>'title')
    INTO missing_sections
    FROM jsonb_array_elements(template_record.sections) AS section
    WHERE (section->>'isRequired')::boolean = true
    AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(report_record.sections) AS report_section
        WHERE report_section->>'id' = section->>'id'
        AND COALESCE(report_section->>'generatedContent', '') != ''
    );
    
    -- Calculate completeness score
    completeness_score := total_required_sections - COALESCE(array_length(missing_sections, 1), 0);
    
    -- Check for warnings
    IF report_record.word_count < 500 THEN
        warnings := array_append(warnings, 'Report appears to be too short (< 500 words)');
    END IF;
    
    IF report_record.audit_opinion->>'basis' IS NULL OR report_record.audit_opinion->>'basis' = '' THEN
        warnings := array_append(warnings, 'Audit opinion basis is not specified');
    END IF;
    
    -- Check for placeholder text in sections
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(report_record.sections) AS section
        WHERE section->>'generatedContent' LIKE '%{{%'
        OR section->>'generatedContent' LIKE '%}}%'
    ) THEN
        warnings := array_append(warnings, 'Report contains unreplaced template variables');
    END IF;
    
    -- Build result
    result := jsonb_build_object(
        'isValid', COALESCE(array_length(missing_sections, 1), 0) = 0,
        'missingRequiredSections', COALESCE(missing_sections, '{}'),
        'warnings', warnings,
        'completenessScore', CASE 
            WHEN total_required_sections = 0 THEN 100
            ELSE ROUND((completeness_score::decimal / total_required_sections) * 100)
        END,
        'totalRequiredSections', total_required_sections,
        'completedRequiredSections', completeness_score,
        'validatedAt', now()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update report status with history tracking
CREATE OR REPLACE FUNCTION update_report_status(
    report_id UUID,
    new_status TEXT,
    id UUID,
    change_summary TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    old_status TEXT;
    result JSONB;
BEGIN
    -- Get current status
    SELECT status INTO old_status
    FROM audit_reports
    WHERE id = report_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Report not found'
        );
    END IF;
    
    -- Validate status transition
    IF NOT (
        (old_status = 'draft' AND new_status IN ('review', 'approved')) OR
        (old_status = 'review' AND new_status IN ('draft', 'approved')) OR
        (old_status = 'approved' AND new_status = 'issued') OR
        (old_status = 'issued' AND new_status = 'approved') -- Allow reverting issued reports
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid status transition from ' || old_status || ' to ' || new_status
        );
    END IF;
    
    -- Update report status
    UPDATE audit_reports
    SET 
        status = new_status,
        updated_at = now(),
        updated_by = id,
        reviewed_at = CASE WHEN new_status = 'review' THEN now() ELSE reviewed_at END,
        reviewed_by = CASE WHEN new_status = 'review' THEN id ELSE reviewed_by END,
        approved_at = CASE WHEN new_status = 'approved' THEN now() ELSE approved_at END,
        approved_by = CASE WHEN new_status = 'approved' THEN id ELSE approved_by END,
        issued_at = CASE WHEN new_status = 'issued' THEN now() ELSE issued_at END
    WHERE id = report_id;
    
    -- Create history record
    INSERT INTO audit_report_history (
        report_id,
        version,
        change_type,
        changes,
        change_summary,
        changed_by,
        organization_id
    )
    SELECT 
        report_id,
        version,
        'status_changed',
        jsonb_build_object(
            'oldStatus', old_status,
            'newStatus', new_status
        ),
        COALESCE(change_summary, 'Status changed from ' || old_status || ' to ' || new_status),
        id,
        organization_id
    FROM audit_reports
    WHERE id = report_id;
    
    result := jsonb_build_object(
        'success', true,
        'oldStatus', old_status,
        'newStatus', new_status,
        'updatedAt', now()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create history record on audit_reports changes
CREATE OR REPLACE FUNCTION create_audit_report_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_report_history (
            report_id,
            version,
            change_type,
            changes,
            change_summary,
            changed_by,
            organization_id
        ) VALUES (
            NEW.id,
            NEW.version,
            'created',
            to_jsonb(NEW),
            'Report created',
            NEW.created_by,
            NEW.organization_id
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only create history for significant changes
        IF OLD.sections IS DISTINCT FROM NEW.sections OR
           OLD.audit_opinion IS DISTINCT FROM NEW.audit_opinion OR
           OLD.key_findings IS DISTINCT FROM NEW.key_findings OR
           OLD.recommendations IS DISTINCT FROM NEW.recommendations THEN
            
            INSERT INTO audit_report_history (
                report_id,
                version,
                change_type,
                changes,
                change_summary,
                changed_by,
                organization_id
            ) VALUES (
                NEW.id,
                NEW.version,
                'content_updated',
                jsonb_build_object(
                    'oldContent', jsonb_build_object(
                        'sections', OLD.sections,
                        'auditOpinion', OLD.audit_opinion,
                        'keyFindings', OLD.key_findings,
                        'recommendations', OLD.recommendations
                    ),
                    'newContent', jsonb_build_object(
                        'sections', NEW.sections,
                        'auditOpinion', NEW.audit_opinion,
                        'keyFindings', NEW.key_findings,
                        'recommendations', NEW.recommendations
                    )
                ),
                'Report content updated',
                NEW.updated_by,
                NEW.organization_id
            );
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER audit_report_history_trigger
    AFTER INSERT OR UPDATE ON audit_reports
    FOR EACH ROW EXECUTE FUNCTION create_audit_report_history();



COMMENT ON TABLE audit_engagements IS 'Stores audit engagement information and findings';
COMMENT ON TABLE audit_report_templates IS 'Predefined templates for different types of audit reports';
COMMENT ON TABLE audit_reports IS 'Generated audit reports with content and metadata';
COMMENT ON TABLE audit_report_sections IS 'Individual sections of audit reports with detailed content';
COMMENT ON TABLE audit_report_history IS 'Version history and change tracking for audit reports';
COMMENT ON TABLE audit_report_attachments IS 'File attachments associated with audit reports';
