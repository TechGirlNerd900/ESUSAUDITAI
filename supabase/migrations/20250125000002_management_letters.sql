-- Management Letter System
-- Migration: 20250125_management_letters.sql

-- Create management_letter_findings table
CREATE TABLE IF NOT EXISTS management_letter_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES audit_engagements(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('internal_control', 'compliance', 'operational', 'financial_reporting', 'governance', 'it_controls')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    current_situation TEXT NOT NULL,
    risks TEXT[] DEFAULT '{}',
    business_impact TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    
    -- Management response and action plan
    management_response TEXT,
    agreed_action_plan TEXT,
    target_date DATE,
    responsible_person VARCHAR(255),
    
    -- Finding status and metadata
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'management_accepted', 'management_rejected')),
    audit_evidence TEXT[] DEFAULT '{}',
    related_accounts TEXT[] DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 1,
    estimated_implementation_effort VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (estimated_implementation_effort IN ('low', 'medium', 'high')),
    cost_benefit_analysis TEXT,
    
    -- Multi-tenancy and metadata
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create management_letters table
CREATE TABLE IF NOT EXISTS management_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES audit_engagements(id) ON DELETE CASCADE,
    template_id UUID REFERENCES audit_report_templates(id),
    title VARCHAR(500) NOT NULL,
    executive_summary TEXT NOT NULL,
    
    -- Letter content
    sections JSONB NOT NULL DEFAULT '[]',
    overall_assessment JSONB NOT NULL DEFAULT '{}',
    
    -- Letter metadata
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'issued')),
    word_count INTEGER DEFAULT 0,
    finding_count INTEGER DEFAULT 0,
    critical_finding_count INTEGER DEFAULT 0,
    version VARCHAR(20) DEFAULT '1.0',
    
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
    issued_at TIMESTAMP WITH TIME ZONE
);

-- Create management_letter_templates table
CREATE TABLE IF NOT EXISTS management_letter_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN ('annual', 'interim', 'special', 'follow_up')),
    client_type TEXT[] DEFAULT '{}',
    sections JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Template can be global (organization_id = NULL) or organization-specific
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Constraints
    CONSTRAINT template_letter_org_or_global CHECK (
        organization_id IS NULL OR organization_id IS NOT NULL
    )
);

-- Create management_letter_finding_templates table
CREATE TABLE IF NOT EXISTS management_letter_finding_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    template_data JSONB NOT NULL DEFAULT '{}',
    usage_count INTEGER DEFAULT 0,
    
    -- Template can be global or organization-specific
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create management_letter_history table
CREATE TABLE IF NOT EXISTS management_letter_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_id UUID NOT NULL REFERENCES management_letters(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('created', 'content_updated', 'status_changed', 'finding_added', 'finding_removed', 'approved', 'issued')),
    changes JSONB,
    change_summary TEXT,
    
    -- User and timestamp
    changed_by UUID NOT NULL REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Multi-tenancy
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
);

-- Create management_letter_attachments table
CREATE TABLE IF NOT EXISTS management_letter_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_id UUID NOT NULL REFERENCES management_letters(id) ON DELETE CASCADE,
    finding_id UUID REFERENCES management_letter_findings(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    attachment_type VARCHAR(50) NOT NULL CHECK (attachment_type IN ('evidence', 'supporting_document', 'response', 'action_plan')),
    description TEXT,
    
    -- Multi-tenancy and metadata
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_management_letter_findings_engagement ON management_letter_findings(engagement_id);
CREATE INDEX idx_management_letter_findings_org_id ON management_letter_findings(organization_id);
CREATE INDEX idx_management_letter_findings_category ON management_letter_findings(category);
CREATE INDEX idx_management_letter_findings_severity ON management_letter_findings(severity);
CREATE INDEX idx_management_letter_findings_status ON management_letter_findings(status);
CREATE INDEX idx_management_letter_findings_priority ON management_letter_findings(priority DESC);

CREATE INDEX idx_management_letters_engagement ON management_letters(engagement_id);
CREATE INDEX idx_management_letters_org_id ON management_letters(organization_id);
CREATE INDEX idx_management_letters_status ON management_letters(status);
CREATE INDEX idx_management_letters_generated_at ON management_letters(generated_at);

CREATE INDEX idx_management_letter_templates_org_id ON management_letter_templates(organization_id);
CREATE INDEX idx_management_letter_templates_type ON management_letter_templates(letter_type);

CREATE INDEX idx_management_letter_finding_templates_org_id ON management_letter_finding_templates(organization_id);
CREATE INDEX idx_management_letter_finding_templates_category ON management_letter_finding_templates(category);

CREATE INDEX idx_management_letter_history_letter_id ON management_letter_history(letter_id);
CREATE INDEX idx_management_letter_history_changed_at ON management_letter_history(changed_at);

CREATE INDEX idx_management_letter_attachments_letter_id ON management_letter_attachments(letter_id);
CREATE INDEX idx_management_letter_attachments_finding_id ON management_letter_attachments(finding_id);
CREATE INDEX idx_management_letter_attachments_type ON management_letter_attachments(attachment_type);

-- Row Level Security (RLS) Policies
ALTER TABLE management_letter_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE management_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE management_letter_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE management_letter_finding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE management_letter_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE management_letter_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for management_letter_findings
CREATE POLICY "Users can view their organization's findings" ON management_letter_findings
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their organization's findings" ON management_letter_findings
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

-- RLS Policies for management_letters
CREATE POLICY "Users can view their organization's management letters" ON management_letters
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their organization's management letters" ON management_letters
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

-- RLS Policies for management_letter_templates
CREATE POLICY "Users can view global templates or their organization's templates" ON management_letter_templates
    FOR SELECT USING (
        organization_id IS NULL OR 
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create templates for their organization" ON management_letter_templates
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their organization's templates" ON management_letter_templates
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

-- RLS Policies for management_letter_finding_templates
CREATE POLICY "Users can view global finding templates or their organization's templates" ON management_letter_finding_templates
    FOR SELECT USING (
        organization_id IS NULL OR 
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their organization's finding templates" ON management_letter_finding_templates
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

-- RLS Policies for management_letter_history
CREATE POLICY "Users can view their organization's letter history" ON management_letter_history
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "System can insert letter history" ON management_letter_history
    FOR INSERT WITH CHECK (true);

-- RLS Policies for management_letter_attachments
CREATE POLICY "Users can view their organization's letter attachments" ON management_letter_attachments
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their organization's letter attachments" ON management_letter_attachments
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
        )
    );

-- Create functions for management letter operations

-- Function to get management letter analytics
CREATE OR REPLACE FUNCTION get_management_letter_analytics(org_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    total_letters INTEGER;
    total_findings INTEGER;
    by_status JSONB;
    by_severity JSONB;
    by_category JSONB;
    recent_activity JSONB;
BEGIN
    -- Get total letters count
    SELECT COUNT(*) INTO total_letters
    FROM management_letters
    WHERE organization_id = org_id;
    
    -- Get total findings count
    SELECT COUNT(*) INTO total_findings
    FROM management_letter_findings
    WHERE organization_id = org_id;
    
    -- Count letters by status
    SELECT jsonb_object_agg(status, count)
    INTO by_status
    FROM (
        SELECT status, COUNT(*) as count
        FROM management_letters
        WHERE organization_id = org_id
        GROUP BY status
    ) t;
    
    -- Count findings by severity
    SELECT jsonb_object_agg(severity, count)
    INTO by_severity
    FROM (
        SELECT severity, COUNT(*) as count
        FROM management_letter_findings
        WHERE organization_id = org_id
        GROUP BY severity
    ) t;
    
    -- Count findings by category
    SELECT jsonb_object_agg(category, count)
    INTO by_category
    FROM (
        SELECT category, COUNT(*) as count
        FROM management_letter_findings
        WHERE organization_id = org_id
        GROUP BY category
    ) t;
    
    -- Get recent activity (last 30 days)
    SELECT jsonb_agg(
        jsonb_build_object(
            'letterId', id,
            'title', title,
            'status', status,
            'findingCount', finding_count,
            'generatedAt', generated_at
        )
    )
    INTO recent_activity
    FROM (
        SELECT id, title, status, finding_count, generated_at
        FROM management_letters
        WHERE organization_id = org_id 
        AND generated_at > now() - interval '30 days'
        ORDER BY generated_at DESC
        LIMIT 10
    ) recent;
    
    -- Build result object
    result := jsonb_build_object(
        'totalLetters', total_letters,
        'totalFindings', total_findings,
        'lettersByStatus', COALESCE(by_status, '{}'),
        'findingsBySeverity', COALESCE(by_severity, '{}'),
        'findingsByCategory', COALESCE(by_category, '{}'),
        'recentActivity', COALESCE(recent_activity, '[]'),
        'generatedAt', now()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to prioritize findings based on severity and business impact
CREATE OR REPLACE FUNCTION prioritize_findings(findings JSONB)
RETURNS JSONB AS $$
DECLARE
    severity_weights JSONB := '{"critical": 4, "high": 3, "medium": 2, "low": 1}';
    prioritized_findings JSONB;
BEGIN
    SELECT jsonb_agg(
        finding ORDER BY 
        (severity_weights->>(finding->>'severity'))::INTEGER DESC,
        (finding->>'priority')::INTEGER DESC
    )
    INTO prioritized_findings
    FROM jsonb_array_elements(findings) AS finding;
    
    RETURN COALESCE(prioritized_findings, '[]');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate implementation effort distribution
CREATE OR REPLACE FUNCTION calculate_implementation_effort(org_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    effort_distribution JSONB;
    total_findings INTEGER;
BEGIN
    -- Get total findings count
    SELECT COUNT(*) INTO total_findings
    FROM management_letter_findings
    WHERE organization_id = org_id;
    
    -- Calculate effort distribution
    SELECT jsonb_object_agg(estimated_implementation_effort, count)
    INTO effort_distribution
    FROM (
        SELECT estimated_implementation_effort, COUNT(*) as count
        FROM management_letter_findings
        WHERE organization_id = org_id
        GROUP BY estimated_implementation_effort
    ) t;
    
    -- Build result with percentages
    result := jsonb_build_object(
        'distribution', COALESCE(effort_distribution, '{}'),
        'totalFindings', total_findings,
        'percentages', (
            SELECT jsonb_object_agg(
                effort, 
                CASE WHEN total_findings > 0 
                     THEN ROUND((count::decimal / total_findings) * 100, 1)
                     ELSE 0 
                END
            )
            FROM jsonb_each_text(COALESCE(effort_distribution, '{}')) AS e(effort, count)
        )
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update management letter status with validation
CREATE OR REPLACE FUNCTION update_management_letter_status(
    letter_id UUID,
    new_status TEXT,
    id UUID,
    change_summary TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    old_status TEXT;
    org_id UUID;
    result JSONB;
BEGIN
    -- Get current status and organization ID
    SELECT status, organization_id INTO old_status, org_id
    FROM management_letters
    WHERE id = letter_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Management letter not found'
        );
    END IF;
    
    -- Validate status transition
    IF NOT (
        (old_status = 'draft' AND new_status IN ('review', 'approved')) OR
        (old_status = 'review' AND new_status IN ('draft', 'approved')) OR
        (old_status = 'approved' AND new_status = 'issued') OR
        (old_status = 'issued' AND new_status = 'approved') -- Allow reverting issued letters
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid status transition from ' || old_status || ' to ' || new_status
        );
    END IF;
    
    -- Update letter status
    UPDATE management_letters
    SET 
        status = new_status,
        updated_at = now(),
        updated_by = id,
        reviewed_at = CASE WHEN new_status = 'review' THEN now() ELSE reviewed_at END,
        reviewed_by = CASE WHEN new_status = 'review' THEN id ELSE reviewed_by END,
        approved_at = CASE WHEN new_status = 'approved' THEN now() ELSE approved_at END,
        approved_by = CASE WHEN new_status = 'approved' THEN id ELSE approved_by END,
        issued_at = CASE WHEN new_status = 'issued' THEN now() ELSE issued_at END
    WHERE id = letter_id;
    
    -- Create history record
    INSERT INTO management_letter_history (
        letter_id,
        version,
        change_type,
        changes,
        change_summary,
        changed_by,
        organization_id
    )
    SELECT 
        letter_id,
        version,
        'status_changed',
        jsonb_build_object(
            'oldStatus', old_status,
            'newStatus', new_status
        ),
        COALESCE(change_summary, 'Status changed from ' || old_status || ' to ' || new_status),
        id,
        org_id
    FROM management_letters
    WHERE id = letter_id;
    
    result := jsonb_build_object(
        'success', true,
        'oldStatus', old_status,
        'newStatus', new_status,
        'updatedAt', now()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create history record on management_letters changes
CREATE OR REPLACE FUNCTION create_management_letter_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO management_letter_history (
            letter_id,
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
            'Management letter created',
            NEW.created_by,
            NEW.organization_id
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Create history for significant changes
        IF OLD.sections IS DISTINCT FROM NEW.sections OR
           OLD.executive_summary IS DISTINCT FROM NEW.executive_summary OR
           OLD.overall_assessment IS DISTINCT FROM NEW.overall_assessment THEN
            
            INSERT INTO management_letter_history (
                letter_id,
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
                        'executiveSummary', OLD.executive_summary,
                        'overallAssessment', OLD.overall_assessment
                    ),
                    'newContent', jsonb_build_object(
                        'sections', NEW.sections,
                        'executiveSummary', NEW.executive_summary,
                        'overallAssessment', NEW.overall_assessment
                    )
                ),
                'Management letter content updated',
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
CREATE TRIGGER management_letter_history_trigger
    AFTER INSERT OR UPDATE ON management_letters
    FOR EACH ROW EXECUTE FUNCTION create_management_letter_history();

-- Trigger to update finding counts in management letters
CREATE OR REPLACE FUNCTION update_management_letter_finding_counts()
RETURNS TRIGGER AS $$
DECLARE
    eng_id UUID;
    letter_rec RECORD;
BEGIN
    -- Get engagement ID from the finding
    IF TG_OP = 'DELETE' THEN
        eng_id := OLD.engagement_id;
    ELSE
        eng_id := NEW.engagement_id;
    END IF;
    
    -- Update all management letters for this engagement  
    FOR letter_rec IN 
        SELECT id FROM management_letters WHERE engagement_id = eng_id
    LOOP
        UPDATE management_letters
        SET 
            finding_count = (
                SELECT COUNT(*) 
                FROM management_letter_findings 
                WHERE engagement_id = eng_id
            ),
            critical_finding_count = (
                SELECT COUNT(*) 
                FROM management_letter_findings 
                WHERE engagement_id = eng_id AND severity = 'critical'
            ),
            updated_at = now()
        WHERE id = letter_rec.id;
    END LOOP;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for finding count updates
CREATE TRIGGER update_finding_counts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON management_letter_findings
    FOR EACH ROW EXECUTE FUNCTION update_management_letter_finding_counts();





COMMENT ON TABLE management_letter_findings IS 'Individual findings and recommendations for management letters';
COMMENT ON TABLE management_letters IS 'Generated management letters with executive summaries and overall assessments';
COMMENT ON TABLE management_letter_templates IS 'Templates for different types of management letters';
COMMENT ON TABLE management_letter_finding_templates IS 'Reusable templates for common audit findings';
COMMENT ON TABLE management_letter_history IS 'Version history and change tracking for management letters';
COMMENT ON TABLE management_letter_attachments IS 'File attachments associated with management letters and findings';