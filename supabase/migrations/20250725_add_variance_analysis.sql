-- Add variance analysis table to support comprehensive variance analysis
-- This table stores variance analysis results for budget vs actual and period comparisons

-- Create variance_analyses table
CREATE TABLE variance_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Analysis metadata
    reporting_period TEXT NOT NULL,
    period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly', 'custom')),
    company_name TEXT,
    
    -- Summary statistics
    total_variances INTEGER NOT NULL DEFAULT 0,
    critical_variances INTEGER NOT NULL DEFAULT 0,
    high_variances INTEGER NOT NULL DEFAULT 0,
    unfavorable_variances INTEGER NOT NULL DEFAULT 0,
    total_budget_variance DECIMAL(15,2) DEFAULT 0,
    total_period_variance DECIMAL(15,2) DEFAULT 0,
    
    -- Configuration and data
    thresholds_used JSONB NOT NULL,
    variance_data JSONB NOT NULL, -- Array of VarianceResult objects
    summary_data JSONB NOT NULL,  -- VarianceSummary object
    report_text TEXT,             -- Generated analysis report
    
    -- Processing metadata
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policy for variance_analyses
ALTER TABLE variance_analyses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see variance analyses from their organization
CREATE POLICY "Users can view variance analyses from their organization" ON variance_analyses
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Users can create variance analyses for their organization
CREATE POLICY "Users can create variance analyses for their organization" ON variance_analyses
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Users can update variance analyses they created
CREATE POLICY "Users can update their own variance analyses" ON variance_analyses
    FOR UPDATE USING (
        created_by = auth.uid() AND
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Users can delete variance analyses they created (soft delete would be better)
CREATE POLICY "Users can delete their own variance analyses" ON variance_analyses
    FOR DELETE USING (
        created_by = auth.uid() AND
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Create indexes for better performance
CREATE INDEX idx_variance_analyses_project_id ON variance_analyses(project_id);
CREATE INDEX idx_variance_analyses_organization_id ON variance_analyses(organization_id);
CREATE INDEX idx_variance_analyses_reporting_period ON variance_analyses(reporting_period);
CREATE INDEX idx_variance_analyses_created_at ON variance_analyses(created_at DESC);
CREATE INDEX idx_variance_analyses_critical_variances ON variance_analyses(critical_variances) WHERE critical_variances > 0;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_variance_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_variance_analyses_updated_at
    BEFORE UPDATE ON variance_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_variance_analyses_updated_at();

-- Add variance analysis summary view for dashboard reporting
CREATE VIEW variance_analysis_summary AS
SELECT 
    va.organization_id,
    va.project_id,
    p.name as project_name,
    va.reporting_period,
    va.period_type,
    va.total_variances,
    va.critical_variances,
    va.high_variances,
    va.unfavorable_variances,
    va.total_budget_variance,
    va.total_period_variance,
    va.created_at,
    pr.full_name as created_by_name,
    
    -- Calculate risk score based on variance counts and amounts
    CASE 
        WHEN va.critical_variances > 5 OR ABS(va.total_budget_variance) > 1000000 THEN 'HIGH'
        WHEN va.critical_variances > 0 OR va.high_variances > 10 THEN 'MEDIUM'
        ELSE 'LOW'
    END as risk_level,
    
    -- Calculate overall variance health score (0-100)
    GREATEST(0, 
        100 - 
        (va.critical_variances * 10) - 
        (va.high_variances * 5) - 
        LEAST(50, ABS(va.total_budget_variance) / 100000)
    ) as health_score
    
FROM variance_analyses va
JOIN projects p ON va.project_id = p.id
LEFT JOIN profiles pr ON va.created_by = pr.id
ORDER BY va.created_at DESC;

-- Grant access to the view
ALTER VIEW variance_analysis_summary OWNER TO postgres;
GRANT SELECT ON variance_analysis_summary TO authenticated;

-- Add RLS to the view
ALTER VIEW variance_analysis_summary ENABLE ROW LEVEL SECURITY;

-- Policy for variance analysis summary view
CREATE POLICY "Users can view variance analysis summary from their organization" ON variance_analysis_summary
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Add helpful functions for variance analysis queries

-- Function to get variance trends for a project
CREATE OR REPLACE FUNCTION get_variance_trends(
    p_project_id UUID,
    p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
    reporting_period TEXT,
    critical_variances INTEGER,
    high_variances INTEGER,
    total_budget_variance DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user has access to this project
    IF NOT EXISTS (
        SELECT 1 FROM projects pr
        JOIN profiles pf ON pr.organization_id = pf.organization_id
        WHERE pr.id = p_project_id AND pf.id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied to project';
    END IF;

    RETURN QUERY
    SELECT 
        va.reporting_period,
        va.critical_variances,
        va.high_variances,
        va.total_budget_variance,
        va.created_at
    FROM variance_analyses va
    WHERE va.project_id = p_project_id
    ORDER BY va.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Function to get top variance accounts across all analyses
CREATE OR REPLACE FUNCTION get_top_variance_accounts(
    p_organization_id UUID,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    account_code TEXT,
    account_name TEXT,
    account_type TEXT,
    variance_count INTEGER,
    avg_variance_amount DECIMAL(15,2),
    max_variance_amount DECIMAL(15,2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user belongs to this organization
    IF NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'Access denied to organization';
    END IF;

    RETURN QUERY
    WITH variance_accounts AS (
        SELECT 
            (jsonb_array_elements(variance_data)->>'accountCode')::TEXT as account_code,
            (jsonb_array_elements(variance_data)->>'accountName')::TEXT as account_name,
            (jsonb_array_elements(variance_data)->>'accountType')::TEXT as account_type,
            (jsonb_array_elements(variance_data)->>'budgetVariance')::DECIMAL as budget_variance
        FROM variance_analyses 
        WHERE organization_id = p_organization_id
          AND variance_data IS NOT NULL
    )
    SELECT 
        va.account_code,
        va.account_name,
        va.account_type,
        COUNT(*)::INTEGER as variance_count,
        AVG(ABS(va.budget_variance))::DECIMAL(15,2) as avg_variance_amount,
        MAX(ABS(va.budget_variance))::DECIMAL(15,2) as max_variance_amount
    FROM variance_accounts va
    WHERE va.budget_variance IS NOT NULL
    GROUP BY va.account_code, va.account_name, va.account_type
    HAVING COUNT(*) >= 2  -- Only accounts that appear in multiple analyses
    ORDER BY AVG(ABS(va.budget_variance)) DESC
    LIMIT p_limit;
END;
$$;

-- Add comments for documentation
COMMENT ON TABLE variance_analyses IS 'Stores comprehensive variance analysis results including budget vs actual and period-to-period comparisons';
COMMENT ON COLUMN variance_analyses.variance_data IS 'JSON array of VarianceResult objects containing detailed variance calculations';
COMMENT ON COLUMN variance_analyses.summary_data IS 'JSON object containing VarianceSummary with aggregated statistics';
COMMENT ON COLUMN variance_analyses.thresholds_used IS 'JSON object containing the variance thresholds used for significance analysis';
COMMENT ON VIEW variance_analysis_summary IS 'Aggregated view of variance analyses with risk scoring for dashboard reporting';
COMMENT ON FUNCTION get_variance_trends IS 'Returns variance trend data for a specific project over time';
COMMENT ON FUNCTION get_top_variance_accounts IS 'Returns frequently varying accounts across all analyses for an organization';