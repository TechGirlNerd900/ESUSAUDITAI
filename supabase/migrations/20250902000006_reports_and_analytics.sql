-- Reports and Analytics Schema
-- Implements reporting, analytics, and business intelligence tables

-- Audit reports table - generated reports for projects
CREATE TABLE IF NOT EXISTS audit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Report metadata
    title VARCHAR(500) NOT NULL,
    description TEXT,
    report_type VARCHAR(50) DEFAULT 'audit' CHECK (report_type IN ('audit', 'compliance', 'risk_assessment', 'summary', 'detailed', 'executive')),
    report_format VARCHAR(20) DEFAULT 'pdf' CHECK (report_format IN ('pdf', 'html', 'docx', 'xlsx')),
    
    -- Report content
    template_id UUID, -- Reference to report template
    report_data JSONB NOT NULL, -- Structured report data
    executive_summary TEXT,
    findings JSONB DEFAULT '[]', -- Array of findings
    recommendations JSONB DEFAULT '[]', -- Array of recommendations
    conclusions TEXT,
    
    -- Status and workflow
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
    version_number INTEGER DEFAULT 1,
    parent_report_id UUID REFERENCES audit_reports(id), -- For report versioning
    
    -- Ownership and approvals
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewed_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    published_by UUID REFERENCES users(id),
    
    -- File information
    file_path VARCHAR(1000), -- Path to generated report file
    file_size BIGINT,
    file_hash VARCHAR(128), -- SHA-256 hash for integrity
    
    -- Access control
    access_level VARCHAR(20) DEFAULT 'internal' CHECK (access_level IN ('public', 'internal', 'confidential', 'restricted')),
    share_with_client BOOLEAN DEFAULT FALSE,
    client_accessible BOOLEAN DEFAULT FALSE,
    password_protected BOOLEAN DEFAULT FALSE,
    
    -- Timeline
    report_period_start DATE,
    report_period_end DATE,
    generated_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- For time-sensitive reports
    
    -- Distribution
    distribution_list JSONB DEFAULT '[]', -- List of recipients
    external_recipients JSONB DEFAULT '[]', -- External email addresses
    
    -- Metadata
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- Soft delete
    archived_at TIMESTAMP WITH TIME ZONE,
    archived_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add the deleted_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_reports' AND column_name = 'deleted_at') THEN
        ALTER TABLE audit_reports ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    END IF;
END
$$;

-- Create indexes for audit_reports
CREATE INDEX IF NOT EXISTS idx_audit_reports_organization_id ON audit_reports(organization_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_reports_project_id ON audit_reports(project_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_reports_status ON audit_reports(status, organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_type ON audit_reports(report_type, organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_created_by ON audit_reports(created_by, organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_approved_by ON audit_reports(approved_by, organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_parent ON audit_reports(parent_report_id) WHERE parent_report_id IS NOT NULL;

-- Add the report_period columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_reports' AND column_name = 'report_period_start') THEN
        ALTER TABLE audit_reports ADD COLUMN report_period_start DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_reports' AND column_name = 'report_period_end') THEN
        ALTER TABLE audit_reports ADD COLUMN report_period_end DATE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_audit_reports_period ON audit_reports(report_period_start, report_period_end, organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_published_at ON audit_reports(published_at, organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_tags ON audit_reports USING GIN(tags);

-- Report templates table - reusable report templates
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type VARCHAR(50) NOT NULL, -- audit, compliance, risk, etc.
    category VARCHAR(100), -- Financial, IT, Operational, etc.
    
    -- Template structure
    template_schema JSONB NOT NULL, -- JSON schema for report structure
    default_content JSONB DEFAULT '{}', -- Default content/sections
    required_fields TEXT[] DEFAULT '{}', -- Required data fields
    optional_fields TEXT[] DEFAULT '{}', -- Optional data fields
    
    -- Styling and formatting
    styling_config JSONB DEFAULT '{}', -- CSS/styling configuration
    layout_config JSONB DEFAULT '{}', -- Layout configuration
    branding_config JSONB DEFAULT '{}', -- Organization branding
    
    -- Access and usage
    is_public BOOLEAN DEFAULT FALSE, -- Available to all orgs
    is_default BOOLEAN DEFAULT FALSE, -- Default template for type
    usage_count INTEGER DEFAULT 0,
    
    -- Versioning
    version VARCHAR(20) DEFAULT '1.0',
    parent_template_id UUID REFERENCES report_templates(id),
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Create indexes for report_templates
CREATE INDEX idx_report_templates_organization_id ON report_templates(organization_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_report_templates_type ON report_templates(template_type, organization_id);
CREATE INDEX idx_report_templates_category ON report_templates(category, organization_id);
CREATE INDEX idx_report_templates_public ON report_templates(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_report_templates_default ON report_templates(is_default, template_type) WHERE is_default = TRUE;

-- Analytics dashboards table - custom dashboards for data visualization
CREATE TABLE analytics_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    dashboard_type VARCHAR(50) DEFAULT 'custom' CHECK (dashboard_type IN ('custom', 'executive', 'operational', 'compliance', 'risk')),
    
    -- Dashboard configuration
    layout_config JSONB NOT NULL, -- Dashboard layout and widget configuration
    data_sources JSONB DEFAULT '[]', -- Data source configurations
    filters JSONB DEFAULT '{}', -- Default filters
    refresh_interval INTEGER DEFAULT 300, -- Refresh interval in seconds
    
    -- Access control
    visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'organization', 'public')),
    shared_with UUID[] DEFAULT '{}', -- Array of user IDs with access
    
    -- Ownership
    created_by UUID NOT NULL REFERENCES users(id),
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    
    -- Settings
    is_favorite BOOLEAN DEFAULT FALSE,
    auto_refresh BOOLEAN DEFAULT TRUE,
    email_reports BOOLEAN DEFAULT FALSE,
    email_schedule VARCHAR(20), -- daily, weekly, monthly
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Create indexes for analytics_dashboards
CREATE INDEX idx_analytics_dashboards_organization_id ON analytics_dashboards(organization_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_analytics_dashboards_created_by ON analytics_dashboards(created_by, organization_id);
CREATE INDEX idx_analytics_dashboards_type ON analytics_dashboards(dashboard_type, organization_id);
CREATE INDEX idx_analytics_dashboards_visibility ON analytics_dashboards(visibility, organization_id);
CREATE INDEX idx_analytics_dashboards_shared_with ON analytics_dashboards USING GIN(shared_with);

-- Metrics and KPIs table - track key performance indicators
CREATE TABLE metrics_kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Metric definition
    metric_name VARCHAR(100) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- count, percentage, amount, ratio, etc.
    metric_category VARCHAR(50), -- project, compliance, risk, efficiency, etc.
    description TEXT,
    
    -- Calculation
    calculation_formula TEXT, -- SQL or formula for calculation
    data_source VARCHAR(100), -- Source table/view
    aggregation_method VARCHAR(20) DEFAULT 'sum' CHECK (aggregation_method IN ('sum', 'avg', 'count', 'min', 'max', 'median')),
    
    -- Value and targets
    current_value DECIMAL(15,4),
    target_value DECIMAL(15,4),
    threshold_warning DECIMAL(15,4), -- Warning threshold
    threshold_critical DECIMAL(15,4), -- Critical threshold
    
    -- Time series data
    measurement_date DATE,
    reporting_period VARCHAR(20) DEFAULT 'monthly' CHECK (reporting_period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    trend VARCHAR(20), -- improving, stable, declining
    variance_percentage DECIMAL(8,4), -- Variance from target
    
    -- Metadata
    unit VARCHAR(20), -- %, $, count, etc.
    format_pattern VARCHAR(50), -- Display format pattern
    color_coding JSONB DEFAULT '{}', -- Color rules for visualization
    
    -- Ownership
    owner_id UUID REFERENCES users(id),
    last_calculated_at TIMESTAMP WITH TIME ZONE,
    next_calculation_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for metrics_kpis
CREATE INDEX idx_metrics_kpis_organization_id ON metrics_kpis(organization_id);
CREATE INDEX idx_metrics_kpis_name ON metrics_kpis(metric_name, organization_id);
CREATE INDEX idx_metrics_kpis_category ON metrics_kpis(metric_category, organization_id);
CREATE INDEX idx_metrics_kpis_status ON metrics_kpis(status, organization_id);
CREATE INDEX idx_metrics_kpis_measurement_date ON metrics_kpis(measurement_date, organization_id);
CREATE INDEX idx_metrics_kpis_next_calculation ON metrics_kpis(next_calculation_at) WHERE next_calculation_at IS NOT NULL;

-- Report distribution log - track report sharing and access
CREATE TABLE report_distribution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    report_id UUID NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
    
    -- Distribution details
    distribution_method VARCHAR(20) NOT NULL CHECK (distribution_method IN ('email', 'download', 'link_share', 'api', 'print')),
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('internal_user', 'external_email', 'client', 'regulator')),
    recipient_identifier VARCHAR(320), -- Email or user ID
    recipient_name VARCHAR(255),
    
    -- Access details
    accessed_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    download_count INTEGER DEFAULT 0,
    last_download_at TIMESTAMP WITH TIME ZONE,
    
    -- Security
    requires_authentication BOOLEAN DEFAULT TRUE,
    password_protected BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE,
    access_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id),
    
    -- Metadata
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'bounced')),
    delivery_attempts INTEGER DEFAULT 0,
    error_message TEXT,
    
    distributed_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for report_distribution_log
CREATE INDEX idx_report_distribution_log_organization_id ON report_distribution_log(organization_id);
CREATE INDEX idx_report_distribution_log_report_id ON report_distribution_log(report_id);
CREATE INDEX idx_report_distribution_log_recipient ON report_distribution_log(recipient_identifier, organization_id);
CREATE INDEX idx_report_distribution_log_distributed_by ON report_distribution_log(distributed_by, organization_id);
CREATE INDEX idx_report_distribution_log_accessed_at ON report_distribution_log(accessed_at, organization_id);

-- Add RLS policies for multi-tenant isolation
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_distribution_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit_reports
DROP POLICY IF EXISTS audit_reports_isolation_policy ON audit_reports;
CREATE POLICY audit_reports_isolation_policy ON audit_reports
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for report_templates
CREATE POLICY report_templates_isolation_policy ON report_templates
    FOR ALL USING (
        is_public = TRUE OR organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for analytics_dashboards
CREATE POLICY analytics_dashboards_isolation_policy ON analytics_dashboards
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for metrics_kpis
CREATE POLICY metrics_kpis_isolation_policy ON metrics_kpis
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for report_distribution_log
CREATE POLICY report_distribution_log_isolation_policy ON report_distribution_log
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- Function to generate report summary statistics
CREATE OR REPLACE FUNCTION get_report_statistics(p_organization_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_reports', COUNT(*),
        'draft_reports', COUNT(*) FILTER (WHERE status = 'draft'),
        'published_reports', COUNT(*) FILTER (WHERE status = 'published'),
        'reports_this_month', COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())),
        'reports_this_quarter', COUNT(*) FILTER (WHERE created_at >= date_trunc('quarter', NOW())),
        'average_review_time_days', AVG(EXTRACT(days FROM (approved_at - created_at))) FILTER (WHERE approved_at IS NOT NULL),
        'most_common_type', mode() WITHIN GROUP (ORDER BY report_type)
    ) INTO result
    FROM audit_reports
    WHERE organization_id = p_organization_id
    AND deleted_at IS NULL;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate metric trend
CREATE OR REPLACE FUNCTION calculate_metric_trend(
    p_metric_id UUID,
    p_periods INTEGER DEFAULT 3
)
RETURNS VARCHAR AS $$
DECLARE
    recent_values DECIMAL[];
    trend_result VARCHAR;
    slope DECIMAL;
BEGIN
    -- Get recent values for the metric
    SELECT ARRAY_AGG(current_value ORDER BY measurement_date DESC)
    INTO recent_values
    FROM (
        SELECT current_value, measurement_date
        FROM metrics_kpis
        WHERE id = p_metric_id
        AND measurement_date IS NOT NULL
        ORDER BY measurement_date DESC
        LIMIT p_periods
    ) recent;
    
    -- Calculate simple trend
    IF array_length(recent_values, 1) < 2 THEN
        RETURN 'insufficient_data';
    END IF;
    
    -- Simple linear trend calculation
    slope := (recent_values[1] - recent_values[array_length(recent_values, 1)]) / 
             GREATEST(array_length(recent_values, 1) - 1, 1);
    
    IF slope > 0.05 THEN
        trend_result := 'improving';
    ELSIF slope < -0.05 THEN
        trend_result := 'declining';
    ELSE
        trend_result := 'stable';
    END IF;
    
    -- Update the metric record
    UPDATE metrics_kpis
    SET trend = trend_result,
        updated_at = NOW()
    WHERE id = p_metric_id;
    
    RETURN trend_result;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate executive summary
CREATE OR REPLACE FUNCTION generate_executive_summary(p_report_id UUID)
RETURNS TEXT AS $$
DECLARE
    report_record RECORD;
    findings_count INTEGER;
    high_risk_findings INTEGER;
    summary_text TEXT;
BEGIN
    -- Get report data
    SELECT * INTO report_record
    FROM audit_reports
    WHERE id = p_report_id;
    
    IF NOT FOUND THEN
        RETURN 'Report not found';
    END IF;
    
    -- Count findings
    SELECT 
        jsonb_array_length(COALESCE(findings, '[]')),
        jsonb_array_length(jsonb_path_query_array(COALESCE(findings, '[]'), '$[*] ? (@.risk_level == "high")'))
    INTO findings_count, high_risk_findings;
    
    -- Generate summary
    summary_text := format(
        'This %s report covers the period from %s to %s. ' ||
        'The audit identified %s findings, of which %s are classified as high risk. ' ||
        'Detailed analysis and recommendations are provided in the following sections.',
        report_record.report_type,
        COALESCE(report_record.report_period_start::text, 'N/A'),
        COALESCE(report_record.report_period_end::text, 'N/A'),
        COALESCE(findings_count, 0),
        COALESCE(high_risk_findings, 0)
    );
    
    -- Update report with generated summary
    UPDATE audit_reports
    SET executive_summary = summary_text,
        updated_at = NOW()
    WHERE id = p_report_id;
    
    RETURN summary_text;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating timestamps
CREATE TRIGGER update_audit_reports_updated_at BEFORE UPDATE ON audit_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON report_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_dashboards_updated_at BEFORE UPDATE ON analytics_dashboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_metrics_kpis_updated_at BEFORE UPDATE ON metrics_kpis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
