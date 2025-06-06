-- Migration: Core Audit Features
-- Version: 1.3.0
-- Date: 2024-06-02
-- Description: Adds essential audit-specific tables and functionality

BEGIN;

-- Audit Programs table
CREATE TABLE audit_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    standard_reference VARCHAR(100),
    risk_level VARCHAR(50) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    materiality_threshold DECIMAL,
    required_procedures JSONB,
    compliance_requirements JSONB,
    created_by UUID REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    status VARCHAR(50) CHECK (status IN ('draft', 'in_review', 'approved', 'in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workpapers table
CREATE TABLE workpapers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    audit_program_id UUID REFERENCES audit_programs(id),
    reference_number VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    procedure_steps JSONB,
    conclusion TEXT,
    prepared_by UUID REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    status VARCHAR(50) CHECK (status IN ('draft', 'in_review', 'reviewed', 'completed')),
    review_notes JSONB,
    risk_identified BOOLEAN DEFAULT false,
    materiality_impact DECIMAL,
    supporting_documents UUID[] REFERENCES documents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Financial Statements table
CREATE TABLE financial_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    statement_type VARCHAR(50) CHECK (statement_type IN ('balance_sheet', 'income_statement', 'cash_flow', 'equity_changes', 'notes')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    data JSONB NOT NULL,
    source_document_id UUID REFERENCES documents(id),
    status VARCHAR(50) CHECK (status IN ('draft', 'reviewed', 'final')),
    created_by UUID REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trial Balance table
CREATE TABLE trial_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    period_end DATE NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    opening_balance DECIMAL NOT NULL,
    debit_total DECIMAL NOT NULL,
    credit_total DECIMAL NOT NULL,
    closing_balance DECIMAL NOT NULL,
    source_document_id UUID REFERENCES documents(id),
    reconciled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Sampling table
CREATE TABLE audit_samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workpaper_id UUID REFERENCES workpapers(id) ON DELETE CASCADE,
    population_size INTEGER NOT NULL,
    sample_size INTEGER NOT NULL,
    confidence_level DECIMAL NOT NULL,
    materiality_threshold DECIMAL NOT NULL,
    sampling_method VARCHAR(50) CHECK (sampling_method IN ('random', 'systematic', 'monetary_unit', 'judgmental')),
    selected_items JSONB,
    exceptions_found INTEGER DEFAULT 0,
    conclusion TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Review Notes table
CREATE TABLE review_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workpaper_id UUID REFERENCES workpapers(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    severity VARCHAR(50) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(50) CHECK (status IN ('open', 'addressed', 'closed', 'rejected')),
    created_by UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Risk Assessment table
CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    area VARCHAR(255) NOT NULL,
    risk_description TEXT NOT NULL,
    risk_level VARCHAR(50) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    impact_assessment TEXT,
    likelihood VARCHAR(50) CHECK (likelihood IN ('rare', 'unlikely', 'possible', 'likely', 'almost_certain')),
    mitigating_controls TEXT,
    residual_risk_level VARCHAR(50) CHECK (residual_risk_level IN ('low', 'medium', 'high', 'critical')),
    created_by UUID REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_audit_programs_project ON audit_programs(project_id);
CREATE INDEX idx_audit_programs_status ON audit_programs(status);
CREATE INDEX idx_workpapers_reference ON workpapers(reference_number);
CREATE INDEX idx_workpapers_status ON workpapers(status);
CREATE INDEX idx_workpapers_project ON workpapers(project_id);
CREATE INDEX idx_financial_statements_project ON financial_statements(project_id);
CREATE INDEX idx_financial_statements_period ON financial_statements(period_start, period_end);
CREATE INDEX idx_trial_balances_project ON trial_balances(project_id);
CREATE INDEX idx_trial_balances_account ON trial_balances(account_number);
CREATE INDEX idx_audit_samples_workpaper ON audit_samples(workpaper_id);
CREATE INDEX idx_review_notes_workpaper ON review_notes(workpaper_id);
CREATE INDEX idx_review_notes_status ON review_notes(status);
CREATE INDEX idx_risk_assessments_project ON risk_assessments(project_id);
CREATE INDEX idx_risk_assessments_level ON risk_assessments(risk_level);

-- Add RLS policies
ALTER TABLE audit_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workpapers ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;

-- Project-based access policies
CREATE POLICY audit_programs_project_access ON audit_programs
    FOR ALL USING (
        project_id IN (
            SELECT id FROM projects
            WHERE created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
            OR auth.uid()::text = ANY(assigned_to::text[])
        )
    );

CREATE POLICY workpapers_project_access ON workpapers
    FOR ALL USING (
        project_id IN (
            SELECT id FROM projects
            WHERE created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
            OR auth.uid()::text = ANY(assigned_to::text[])
        )
    );

-- Add update triggers
CREATE TRIGGER update_audit_programs_timestamp BEFORE UPDATE ON audit_programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workpapers_timestamp BEFORE UPDATE ON workpapers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_statements_timestamp BEFORE UPDATE ON financial_statements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trial_balances_timestamp BEFORE UPDATE ON trial_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audit_samples_timestamp BEFORE UPDATE ON audit_samples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_review_notes_timestamp BEFORE UPDATE ON review_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_assessments_timestamp BEFORE UPDATE ON risk_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Log migration
INSERT INTO audit_logs (
    action,
    resource_type,
    details,
    success
) VALUES (
    'database_migration',
    'schema',
    '{"migration": "004_audit_core_features", "version": "1.3.0", "description": "Added core audit functionality tables and relationships"}'::jsonb,
    true
);

COMMIT;

-- Analyze new tables
ANALYZE audit_programs;
ANALYZE workpapers;
ANALYZE financial_statements;
ANALYZE trial_balances;
ANALYZE audit_samples;
ANALYZE review_notes;
ANALYZE risk_assessments;