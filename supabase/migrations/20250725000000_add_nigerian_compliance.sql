-- Add Nigerian compliance assessment table to support FRS and CAMA compliance checks
-- This table stores compliance assessment results and recommendations

-- Create compliance_assessments table
CREATE TABLE compliance_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Assessment metadata
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'private_company', 'public_company', 'small_company', 'medium_company', 
        'large_company', 'listed_company', 'financial_institution', 'ngo', 'cooperative'
    )),
    reporting_period TEXT NOT NULL,
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Overall compliance scores (0-100)
    overall_compliance_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    frs_compliance_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    cama_compliance_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- Issue counts
    critical_issues_count INTEGER NOT NULL DEFAULT 0,
    high_priority_issues_count INTEGER NOT NULL DEFAULT 0,
    
    -- Rule compliance counts
    total_frs_rules INTEGER NOT NULL DEFAULT 0,
    compliant_frs_rules INTEGER NOT NULL DEFAULT 0,
    total_cama_rules INTEGER NOT NULL DEFAULT 0,
    compliant_cama_rules INTEGER NOT NULL DEFAULT 0,
    
    -- Detailed assessment data
    company_data JSONB NOT NULL,
    assessment_results JSONB NOT NULL,
    compliance_report TEXT,
    recommended_actions JSONB DEFAULT '[]',
    
    -- Processing metadata
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policy for compliance_assessments
ALTER TABLE compliance_assessments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see compliance assessments from their organization
CREATE POLICY "Users can view compliance assessments from their organization" ON compliance_assessments
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Policy: Users can create compliance assessments for their organization
CREATE POLICY "Users can create compliance assessments for their organization" ON compliance_assessments
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own compliance assessments" ON compliance_assessments
    FOR UPDATE USING (
        created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) AND
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own compliance assessments" ON compliance_assessments
    FOR DELETE USING (
        created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()) AND
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Create indexes for better performance
CREATE INDEX idx_compliance_assessments_project_id ON compliance_assessments(project_id);
CREATE INDEX idx_compliance_assessments_organization_id ON compliance_assessments(organization_id);
CREATE INDEX idx_compliance_assessments_entity_type ON compliance_assessments(entity_type);
CREATE INDEX idx_compliance_assessments_reporting_period ON compliance_assessments(reporting_period);
CREATE INDEX idx_compliance_assessments_assessment_date ON compliance_assessments(assessment_date DESC);
CREATE INDEX idx_compliance_assessments_overall_score ON compliance_assessments(overall_compliance_score);
CREATE INDEX idx_compliance_assessments_critical_issues ON compliance_assessments(critical_issues_count) WHERE critical_issues_count > 0;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_compliance_assessments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_compliance_assessments_updated_at
    BEFORE UPDATE ON compliance_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_compliance_assessments_updated_at();

-- Create compliance summary view for dashboard reporting
CREATE VIEW compliance_assessment_summary AS
SELECT 
    ca.organization_id,
    ca.project_id,
    p.name as project_name,
    ca.entity_type,
    ca.reporting_period,
    ca.assessment_date,
    ca.overall_compliance_score,
    ca.frs_compliance_score,
    ca.cama_compliance_score,
    ca.critical_issues_count,
    ca.high_priority_issues_count,
    ca.created_at,
    (pr.first_name || ' ' || pr.last_name) as created_by_name,
    
    -- Calculate compliance grade
    CASE 
        WHEN ca.overall_compliance_score >= 90 THEN 'EXCELLENT'
        WHEN ca.overall_compliance_score >= 80 THEN 'GOOD'
        WHEN ca.overall_compliance_score >= 70 THEN 'SATISFACTORY'
        WHEN ca.overall_compliance_score >= 60 THEN 'NEEDS IMPROVEMENT'
        ELSE 'POOR'
    END as compliance_grade,
    
    -- Calculate risk level based on critical and high priority issues
    CASE 
        WHEN ca.critical_issues_count > 3 THEN 'CRITICAL'
        WHEN ca.critical_issues_count > 0 OR ca.high_priority_issues_count > 5 THEN 'HIGH'
        WHEN ca.high_priority_issues_count > 0 THEN 'MEDIUM'
        ELSE 'LOW'
    END as risk_level,
    
    -- Calculate overall health score (0-100)
    GREATEST(0, 
        ca.overall_compliance_score - 
        (ca.critical_issues_count * 10) - 
        (ca.high_priority_issues_count * 3)
    ) as health_score
    
FROM compliance_assessments ca
JOIN projects p ON ca.project_id = p.id
LEFT JOIN users pr ON ca.created_by = pr.id
ORDER BY ca.created_at DESC;

-- Grant access to the view
ALTER VIEW compliance_assessment_summary OWNER TO postgres;
GRANT SELECT ON compliance_assessment_summary TO authenticated;

-- RLS for the compliance_assessment_summary view is inherited from the underlying tables.

-- Add chart of accounts table for Nigerian templates
CREATE TABLE nigerian_chart_of_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    template_id TEXT NOT NULL,
    template_name TEXT NOT NULL,
    
    -- Account details
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    account_category TEXT NOT NULL,
    account_subcategory TEXT,
    parent_account_code TEXT,
    level INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    
    -- Nigerian-specific fields
    vat_applicable BOOLEAN DEFAULT false,
    wht_applicable BOOLEAN DEFAULT false,
    wht_category TEXT CHECK (wht_category IN ('dividends', 'interest', 'rent', 'royalties', 'professional_fees', 'commissions')),
    reporting_category TEXT CHECK (reporting_category IN ('current', 'non_current')),
    frs_disclosure_note TEXT,
    cama_requirement TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policy for nigerian_chart_of_accounts
ALTER TABLE nigerian_chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Policies for chart of accounts
CREATE POLICY "Users can view chart of accounts from their organization" ON nigerian_chart_of_accounts
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create chart of accounts for their organization" ON nigerian_chart_of_accounts
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update chart of accounts in their organization" ON nigerian_chart_of_accounts
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete chart of accounts in their organization" ON nigerian_chart_of_accounts
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Create indexes for chart of accounts
CREATE INDEX idx_nigerian_coa_organization_id ON nigerian_chart_of_accounts(organization_id);
CREATE INDEX idx_nigerian_coa_template_id ON nigerian_chart_of_accounts(template_id);
CREATE INDEX idx_nigerian_coa_account_code ON nigerian_chart_of_accounts(account_code);
CREATE INDEX idx_nigerian_coa_account_type ON nigerian_chart_of_accounts(account_type);
CREATE INDEX idx_nigerian_coa_vat_applicable ON nigerian_chart_of_accounts(vat_applicable) WHERE vat_applicable = true;
CREATE INDEX idx_nigerian_coa_wht_applicable ON nigerian_chart_of_accounts(wht_applicable) WHERE wht_applicable = true;

-- Add trigger for chart of accounts updated_at
CREATE TRIGGER trigger_update_nigerian_coa_updated_at
    BEFORE UPDATE ON nigerian_chart_of_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_compliance_assessments_updated_at();

-- Helpful functions for compliance analysis

-- Function to get compliance trends for a project
CREATE OR REPLACE FUNCTION get_compliance_trends(
    p_project_id UUID,
    p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
    assessment_date DATE,
    overall_score DECIMAL(5,2),
    frs_score DECIMAL(5,2),
    cama_score DECIMAL(5,2),
    critical_issues INTEGER,
    high_priority_issues INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user has access to this project
    IF NOT EXISTS (
        SELECT 1 FROM projects pr
        JOIN users pf ON pr.organization_id = pf.organization_id
        WHERE pr.id = p_project_id AND pf.auth_user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied to project';
    END IF;

    RETURN QUERY
    SELECT 
        ca.assessment_date::DATE,
        ca.overall_compliance_score,
        ca.frs_compliance_score,
        ca.cama_compliance_score,
        ca.critical_issues_count,
        ca.high_priority_issues_count
    FROM compliance_assessments ca
    WHERE ca.project_id = p_project_id
    ORDER BY ca.assessment_date DESC
    LIMIT p_limit;
END;
$$;

-- Function to get compliance benchmarks by entity type
CREATE OR REPLACE FUNCTION get_compliance_benchmarks(
    p_organization_id UUID,
    p_entity_type TEXT
)
RETURNS TABLE (
    entity_type TEXT,
    avg_overall_score DECIMAL(5,2),
    avg_frs_score DECIMAL(5,2),
    avg_cama_score DECIMAL(5,2),
    avg_critical_issues DECIMAL(5,2),
    assessment_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user belongs to this organization
    IF NOT EXISTS (
        SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'Access denied to organization';
    END IF;

    RETURN QUERY
    SELECT 
        ca.entity_type,
        AVG(ca.overall_compliance_score)::DECIMAL(5,2),
        AVG(ca.frs_compliance_score)::DECIMAL(5,2),
        AVG(ca.cama_compliance_score)::DECIMAL(5,2),
        AVG(ca.critical_issues_count)::DECIMAL(5,2),
        COUNT(*)::INTEGER
    FROM compliance_assessments ca
    WHERE ca.organization_id = p_organization_id
      AND (p_entity_type IS NULL OR ca.entity_type = p_entity_type)
    GROUP BY ca.entity_type
    ORDER BY AVG(ca.overall_compliance_score) DESC;
END;
$$;

-- Add comments for documentation
COMMENT ON TABLE compliance_assessments IS 'Stores Nigerian regulatory compliance assessments including FRS and CAMA 2020 compliance checks';
COMMENT ON COLUMN compliance_assessments.assessment_results IS 'JSON object containing detailed ComplianceAssessment results';
COMMENT ON COLUMN compliance_assessments.company_data IS 'JSON object containing company data used for compliance assessment';
COMMENT ON COLUMN compliance_assessments.recommended_actions IS 'JSON array of recommended actions to improve compliance';

COMMENT ON TABLE nigerian_chart_of_accounts IS 'Nigerian chart of accounts templates with VAT/WHT classifications and regulatory requirements';
COMMENT ON COLUMN nigerian_chart_of_accounts.vat_applicable IS 'Whether VAT applies to transactions in this account';
COMMENT ON COLUMN nigerian_chart_of_accounts.wht_applicable IS 'Whether WHT applies to transactions in this account';
COMMENT ON COLUMN nigerian_chart_of_accounts.frs_disclosure_note IS 'Reference to relevant FRS disclosure requirements';
COMMENT ON COLUMN nigerian_chart_of_accounts.cama_requirement IS 'Reference to relevant CAMA 2020 requirements';

COMMENT ON VIEW compliance_assessment_summary IS 'Aggregated view of compliance assessments with risk scoring and grading';
COMMENT ON FUNCTION get_compliance_trends IS 'Returns compliance score trends over time for a specific project';
COMMENT ON FUNCTION get_compliance_benchmarks IS 'Returns compliance benchmarks by entity type for an organization';
