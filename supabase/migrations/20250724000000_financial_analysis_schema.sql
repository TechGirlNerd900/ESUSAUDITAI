-- Financial Analysis Schema
-- Implements financial analysis, ratio calculations, and accounting data structures

-- Chart of Accounts table - Account hierarchy and classifications
CREATE TABLE chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- Optional: project-specific chart
    
    -- Account identification
    account_code VARCHAR(50) NOT NULL, -- e.g., '1000', '1100', '2000'
    account_name VARCHAR(255) NOT NULL,
    account_description TEXT,
    
    -- Account classification
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    account_category VARCHAR(100), -- Current Assets, Fixed Assets, Current Liabilities, etc.
    account_subcategory VARCHAR(100), -- Cash, Inventory, Accounts Receivable, etc.
    
    -- Financial statement mapping
    balance_sheet_section VARCHAR(50), -- assets, liabilities, equity
    income_statement_section VARCHAR(50), -- revenue, cost_of_sales, operating_expense, etc.
    cash_flow_section VARCHAR(50), -- operating, investing, financing
    
    -- Accounting standards compliance
    ifrs_classification VARCHAR(100), -- IFRS standard classification
    gaap_classification VARCHAR(100), -- GAAP standard classification
    frs_classification VARCHAR(100), -- Nigerian FRS classification
    
    -- Account hierarchy
    parent_account_id UUID REFERENCES chart_of_accounts(id),
    account_level INTEGER DEFAULT 1, -- 1=main, 2=sub, 3=detail
    account_path VARCHAR(500), -- Hierarchical path like '1000.1100.1110'
    
    -- Account properties
    is_active BOOLEAN DEFAULT TRUE,
    is_system_account BOOLEAN DEFAULT FALSE, -- Cannot be deleted
    normal_balance VARCHAR(10) CHECK (normal_balance IN ('debit', 'credit')),
    
    -- Nigerian localization
    cama_classification VARCHAR(100), -- CAMA 2020 classification
    tax_category VARCHAR(50), -- WHT, VAT, CIT categories
    
    -- Metadata
    custom_fields JSONB DEFAULT '{}',
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Trial Balance table - Store trial balance data
CREATE TABLE trial_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Period information
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,
    period_type VARCHAR(20) DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'quarterly', 'yearly', 'custom')),
    
    -- Trial balance data
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    debit_balance DECIMAL(18,2) DEFAULT 0.00,
    credit_balance DECIMAL(18,2) DEFAULT 0.00,
    net_balance DECIMAL(18,2) DEFAULT 0.00,
    
    -- Prior period comparisons
    prior_period_balance DECIMAL(18,2),
    variance_amount DECIMAL(18,2),
    variance_percentage DECIMAL(8,4),
    
    -- Adjustments
    adjustment_amount DECIMAL(18,2) DEFAULT 0.00,
    adjustment_reason TEXT,
    is_adjusted BOOLEAN DEFAULT FALSE,
    
    -- Validation
    is_balanced BOOLEAN DEFAULT TRUE,
    balance_difference DECIMAL(18,2) DEFAULT 0.00,
    validation_status VARCHAR(20) DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'failed')),
    validation_errors JSONB DEFAULT '[]',
    
    -- Metadata
    imported_from VARCHAR(100), -- Source system
    import_reference VARCHAR(255), -- Reference in source system
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial Ratios table - Store calculated financial ratios
CREATE TABLE financial_ratios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Period information
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,
    
    -- Ratio identification
    ratio_category VARCHAR(50) NOT NULL CHECK (ratio_category IN ('liquidity', 'profitability', 'leverage', 'efficiency', 'market')),
    ratio_name VARCHAR(100) NOT NULL,
    ratio_formula TEXT NOT NULL,
    
    -- Calculated values
    ratio_value DECIMAL(15,6),
    numerator DECIMAL(18,2),
    denominator DECIMAL(18,2),
    
    -- Analysis
    industry_benchmark DECIMAL(15,6),
    prior_period_value DECIMAL(15,6),
    variance_from_benchmark DECIMAL(15,6),
    variance_from_prior DECIMAL(15,6),
    
    -- Interpretation
    interpretation VARCHAR(20) CHECK (interpretation IN ('excellent', 'good', 'acceptable', 'poor', 'critical')),
    risk_level VARCHAR(20) DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    analysis_notes TEXT,
    
    -- Calculation metadata
    calculation_method VARCHAR(50), -- manual, automated, imported
    data_source VARCHAR(100), -- trial_balance, financial_statements, etc.
    calculation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial Statements table - Generated financial statements
CREATE TABLE financial_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Statement information
    statement_type VARCHAR(50) NOT NULL CHECK (statement_type IN ('balance_sheet', 'income_statement', 'cash_flow', 'equity_statement')),
    statement_title VARCHAR(255) NOT NULL,
    
    -- Period information
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,
    statement_date DATE NOT NULL,
    
    -- Statement data
    line_items JSONB NOT NULL, -- Array of statement line items with amounts
    totals JSONB NOT NULL, -- Key totals (total assets, net income, etc.)
    comparative_data JSONB DEFAULT '{}', -- Prior period data for comparison
    
    -- Formatting and presentation
    presentation_currency VARCHAR(3) DEFAULT 'NGN',
    rounding_unit VARCHAR(20) DEFAULT 'ones', -- ones, thousands, millions
    
    -- Compliance
    accounting_standard VARCHAR(20) DEFAULT 'IFRS' CHECK (accounting_standard IN ('IFRS', 'GAAP', 'FRS')),
    compliance_notes TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published')),
    
    -- File information
    file_path VARCHAR(1000), -- Path to generated PDF/Excel
    file_hash VARCHAR(128),
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Variance Analysis table - Budget vs actual analysis
CREATE TABLE variance_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Analysis period
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,
    analysis_type VARCHAR(50) DEFAULT 'budget_vs_actual' CHECK (analysis_type IN ('budget_vs_actual', 'prior_period', 'benchmark')),
    
    -- Account information
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    
    -- Amounts
    actual_amount DECIMAL(18,2) NOT NULL,
    budget_amount DECIMAL(18,2),
    prior_amount DECIMAL(18,2),
    benchmark_amount DECIMAL(18,2),
    
    -- Variance calculations
    absolute_variance DECIMAL(18,2),
    percentage_variance DECIMAL(8,4),
    
    -- Analysis
    variance_threshold DECIMAL(8,4) DEFAULT 5.00, -- 5% threshold
    is_significant BOOLEAN DEFAULT FALSE,
    variance_explanation TEXT,
    
    -- Risk assessment
    risk_impact VARCHAR(20) CHECK (risk_impact IN ('low', 'medium', 'high', 'critical')),
    requires_investigation BOOLEAN DEFAULT FALSE,
    investigation_notes TEXT,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_chart_of_accounts_organization_id ON chart_of_accounts(organization_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_chart_of_accounts_project_id ON chart_of_accounts(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_chart_of_accounts_code ON chart_of_accounts(account_code, organization_id);
CREATE INDEX idx_chart_of_accounts_type ON chart_of_accounts(account_type, organization_id);
CREATE INDEX idx_chart_of_accounts_parent ON chart_of_accounts(parent_account_id) WHERE parent_account_id IS NOT NULL;

CREATE INDEX idx_trial_balances_organization_id ON trial_balances(organization_id);
CREATE INDEX idx_trial_balances_project_id ON trial_balances(project_id);
CREATE INDEX idx_trial_balances_period ON trial_balances(reporting_period_start, reporting_period_end);
CREATE INDEX idx_trial_balances_account ON trial_balances(account_id);

CREATE INDEX idx_financial_ratios_organization_id ON financial_ratios(organization_id);
CREATE INDEX idx_financial_ratios_project_id ON financial_ratios(project_id);
CREATE INDEX idx_financial_ratios_category ON financial_ratios(ratio_category, organization_id);
CREATE INDEX idx_financial_ratios_period ON financial_ratios(reporting_period_start, reporting_period_end);

CREATE INDEX idx_financial_statements_organization_id ON financial_statements(organization_id);
CREATE INDEX idx_financial_statements_project_id ON financial_statements(project_id);
CREATE INDEX idx_financial_statements_type ON financial_statements(statement_type, organization_id);
CREATE INDEX idx_financial_statements_date ON financial_statements(statement_date, organization_id);

CREATE INDEX idx_variance_analysis_organization_id ON variance_analysis(organization_id);
CREATE INDEX idx_variance_analysis_project_id ON variance_analysis(project_id);
CREATE INDEX idx_variance_analysis_account ON variance_analysis(account_id);
CREATE INDEX idx_variance_analysis_period ON variance_analysis(analysis_period_start, analysis_period_end);

-- Enable RLS for multi-tenant isolation
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_ratios ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE variance_analysis ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY chart_of_accounts_isolation_policy ON chart_of_accounts
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

CREATE POLICY trial_balances_isolation_policy ON trial_balances
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

CREATE POLICY financial_ratios_isolation_policy ON financial_ratios
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

CREATE POLICY financial_statements_isolation_policy ON financial_statements
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

CREATE POLICY variance_analysis_isolation_policy ON variance_analysis
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- Update triggers
CREATE TRIGGER update_chart_of_accounts_updated_at BEFORE UPDATE ON chart_of_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trial_balances_updated_at BEFORE UPDATE ON trial_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_statements_updated_at BEFORE UPDATE ON financial_statements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();