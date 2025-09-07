-- Account Classification and Chart of Accounts Management
-- Migration: 20250125_account_classification.sql

-- Create account_mappings table
CREATE TABLE IF NOT EXISTS account_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    account_subtype VARCHAR(100),
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    is_current_account BOOLEAN DEFAULT false,
    normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    financial_statement_section VARCHAR(100) NOT NULL,
    
    -- Standards mapping
    ifrs_mapping JSONB,
    gaap_mapping JSONB,
    frs_mapping JSONB,
    
    -- Tax and compliance attributes
    tax_attributes JSONB,
    audit_attributes JSONB NOT NULL DEFAULT '{
        "riskLevel": "medium",
        "significanceThreshold": 0.05,
        "typicalTestingProcedures": [],
        "commonMisstatements": [],
        "keyAssertions": []
    }',
    compliance_requirements TEXT[],
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Constraints
    UNIQUE(account_code, organization_id)
);

-- Create chart_of_accounts_templates table
CREATE TABLE IF NOT EXISTS chart_of_accounts_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    industry_type VARCHAR(100) NOT NULL,
    applicable_standards TEXT[] NOT NULL DEFAULT '{}',
    accounts JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Multi-tenancy
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Template can be global (organization_id = NULL) or organization-specific
    CONSTRAINT template_org_or_global CHECK (
        organization_id IS NULL OR organization_id IS NOT NULL
    )
);

-- Create account_categorization_rules table
CREATE TABLE IF NOT EXISTS account_categorization_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL UNIQUE,
    priority INTEGER NOT NULL DEFAULT 50,
    conditions JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    
    -- Multi-tenancy support
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create account_classification_history table for audit trail
CREATE TABLE IF NOT EXISTS account_classification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_mapping_id UUID NOT NULL REFERENCES account_mappings(id) ON DELETE CASCADE,
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'categorize')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID NOT NULL REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    change_reason TEXT,
    
    -- Organization context
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_mappings_org_id ON account_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_account_mappings_account_code ON account_mappings(account_code);
CREATE INDEX IF NOT EXISTS idx_account_mappings_account_type ON account_mappings(account_type);
CREATE INDEX IF NOT EXISTS idx_account_mappings_category ON account_mappings(category);
CREATE INDEX IF NOT EXISTS idx_account_mappings_active ON account_mappings(is_active);
CREATE INDEX IF NOT EXISTS idx_account_mappings_ifrs ON account_mappings USING GIN (ifrs_mapping);
CREATE INDEX IF NOT EXISTS idx_account_mappings_gaap ON account_mappings USING GIN (gaap_mapping);
CREATE INDEX IF NOT EXISTS idx_account_mappings_frs ON account_mappings USING GIN (frs_mapping);

CREATE INDEX IF NOT EXISTS idx_templates_org_id ON chart_of_accounts_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_industry ON chart_of_accounts_templates(industry_type);

CREATE INDEX IF NOT EXISTS idx_categorization_rules_org_id ON account_categorization_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_categorization_rules_priority ON account_categorization_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_categorization_rules_active ON account_categorization_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_classification_history_account ON account_classification_history(account_mapping_id);
CREATE INDEX IF NOT EXISTS idx_classification_history_org ON account_classification_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_classification_history_date ON account_classification_history(changed_at);

-- Row Level Security (RLS) Policies
ALTER TABLE account_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_classification_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account_mappings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their organization''s account mappings') THEN
        CREATE POLICY "Users can view their organization's account mappings" ON account_mappings
            FOR SELECT USING (
                organization_id IN (
                    SELECT organization_id FROM users 
                    WHERE id = auth.uid()
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert account mappings for their organization') THEN
        CREATE POLICY "Users can insert account mappings for their organization" ON account_mappings
            FOR INSERT WITH CHECK (
                organization_id IN (
                    SELECT organization_id FROM users 
                    WHERE id = auth.uid()
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their organization''s account mappings') THEN
        CREATE POLICY "Users can update their organization's account mappings" ON account_mappings
            FOR UPDATE USING (
                organization_id IN (
                    SELECT organization_id FROM users 
                    WHERE id = auth.uid()
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their organization''s account mappings') THEN
        CREATE POLICY "Users can delete their organization's account mappings" ON account_mappings
            FOR DELETE USING (
                organization_id IN (
                    SELECT organization_id FROM users 
                    WHERE id = auth.uid()
                )
            );
    END IF;
END
$$;

-- RLS Policies for chart_of_accounts_templates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view global templates or their organization''s templates') THEN
        CREATE POLICY "Users can view global templates or their organization's templates" ON chart_of_accounts_templates
            FOR SELECT USING (
                organization_id IS NULL OR 
                organization_id IN (
                    SELECT organization_id FROM users 
                    WHERE id = auth.uid()
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create templates for their organization') THEN
        CREATE POLICY "Users can create templates for their organization" ON chart_of_accounts_templates
            FOR INSERT WITH CHECK (
                organization_id IN (
                    SELECT organization_id FROM users 
                    WHERE id = auth.uid()
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their organization''s templates') THEN
        CREATE POLICY "Users can update their organization's templates" ON chart_of_accounts_templates
            FOR UPDATE USING (
                organization_id IN (
                    SELECT organization_id FROM users 
                    WHERE id = auth.uid()
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their organization''s templates') THEN
        CREATE POLICY "Users can delete their organization's templates" ON chart_of_accounts_templates
            FOR DELETE USING (
                organization_id IN (
                    SELECT organization_id FROM users 
                    WHERE id = auth.uid()
                )
            );
    END IF;
END
$$;

-- RLS Policies for account_categorization_rules
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their organization''s categorization rules') THEN
        CREATE POLICY "Users can view their organization's categorization rules" ON account_categorization_rules
            FOR SELECT USING (
                organization_id IN (
                    SELECT organization_id FROM users 
                    WHERE id = auth.uid()
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their organization''s categorization rules') THEN
        CREATE POLICY "Users can manage their organization's categorization rules" ON account_categorization_rules
            FOR ALL USING (
                organization_id IN (
                    SELECT organization_id FROM users 
                    WHERE id = auth.uid()
                )
            );
    END IF;
END
$$;

-- RLS Policies for account_classification_history
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their organization''s classification history') THEN
        CREATE POLICY "Users can view their organization's classification history" ON account_classification_history
            FOR SELECT USING (
                organization_id IN (
                    SELECT organization_id FROM users 
                    WHERE id = auth.uid()
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can insert classification history') THEN
        CREATE POLICY "System can insert classification history" ON account_classification_history
            FOR INSERT WITH CHECK (true);
    END IF;
END
$$;

-- Create functions for account classification operations

-- Function to get account classification analytics
CREATE OR REPLACE FUNCTION get_account_classification_analytics(org_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    total_accounts INTEGER;
    by_type JSONB;
    by_category JSONB;
    by_risk_level JSONB;
    completeness_stats JSONB;
BEGIN
    -- Get total accounts count
    SELECT COUNT(*) INTO total_accounts
    FROM account_mappings
    WHERE organization_id = org_id AND is_active = true;
    
    -- Count by account type
    SELECT jsonb_object_agg(account_type, count)
    INTO by_type
    FROM (
        SELECT account_type, COUNT(*) as count
        FROM account_mappings
        WHERE organization_id = org_id AND is_active = true
        GROUP BY account_type
    ) t;
    
    -- Count by category
    SELECT jsonb_object_agg(category, count)
    INTO by_category
    FROM (
        SELECT category, COUNT(*) as count
        FROM account_mappings
        WHERE organization_id = org_id AND is_active = true
        GROUP BY category
    ) t;
    
    -- Count by risk level
    SELECT jsonb_object_agg(risk_level, count)
    INTO by_risk_level
    FROM (
        SELECT 
            audit_attributes->>'riskLevel' as risk_level,
            COUNT(*) as count
        FROM account_mappings
        WHERE organization_id = org_id AND is_active = true
        GROUP BY audit_attributes->>'riskLevel'
    ) t;
    
    -- Calculate completeness statistics
    SELECT jsonb_build_object(
        'fullyMapped', COUNT(*) FILTER (WHERE ifrs_mapping IS NOT NULL AND gaap_mapping IS NOT NULL),
        'partiallyMapped', COUNT(*) FILTER (WHERE ifrs_mapping IS NOT NULL OR gaap_mapping IS NOT NULL),
        'unmapped', COUNT(*) FILTER (WHERE ifrs_mapping IS NULL AND gaap_mapping IS NULL)
    )
    INTO completeness_stats
    FROM account_mappings
    WHERE organization_id = org_id AND is_active = true;
    
    -- Build result object
    result := jsonb_build_object(
        'totalAccounts', total_accounts,
        'byType', COALESCE(by_type, '{}'),
        'byCategory', COALESCE(by_category, '{}'),
        'byRiskLevel', COALESCE(by_risk_level, '{}'),
        'completenessStats', COALESCE(completeness_stats, '{}'),
        'generatedAt', now()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate account classification completeness
CREATE OR REPLACE FUNCTION validate_account_classification(account_data JSONB)
RETURNS JSONB AS $$
DECLARE
    errors TEXT[] := '{}';
    warnings TEXT[] := '{}';
    completeness_score INTEGER := 0;
    total_fields INTEGER := 15;
    result JSONB;
BEGIN
    -- Check required fields
    IF account_data->>'accountCode' IS NULL OR account_data->>'accountCode' = '' THEN
        errors := array_append(errors, 'Account code is required');
    ELSE
        completeness_score := completeness_score + 1;
    END IF;
    
    IF account_data->>'accountName' IS NULL OR account_data->>'accountName' = '' THEN
        errors := array_append(errors, 'Account name is required');
    ELSE
        completeness_score := completeness_score + 1;
    END IF;
    
    IF account_data->>'accountType' IS NULL OR account_data->>'accountType' = '' THEN
        errors := array_append(errors, 'Account type is required');
    ELSE
        completeness_score := completeness_score + 1;
    END IF;
    
    IF account_data->>'normalBalance' IS NULL OR account_data->>'normalBalance' = '' THEN
        errors := array_append(errors, 'Normal balance is required');
    ELSE
        completeness_score := completeness_score + 1;
    END IF;
    
    IF account_data->>'financialStatementSection' IS NULL OR account_data->>'financialStatementSection' = '' THEN
        errors := array_append(errors, 'Financial statement section is required');
    ELSE
        completeness_score := completeness_score + 1;
    END IF;
    
    -- Check optional but recommended fields
    IF account_data->'ifrsMapping' IS NOT NULL THEN
        completeness_score := completeness_score + 1;
    END IF;
    
    IF account_data->'gaapMapping' IS NOT NULL THEN
        completeness_score := completeness_score + 1;
    END IF;
    
    IF account_data->'frsMapping' IS NOT NULL THEN
        completeness_score := completeness_score + 1;
    END IF;
    
    IF account_data->'taxAttributes' IS NOT NULL THEN
        completeness_score := completeness_score + 1;
    END IF;
    
    IF account_data->'auditAttributes' IS NOT NULL THEN
        completeness_score := completeness_score + 1;
    END IF;
    
    -- Business logic validation
    IF account_data->>'accountType' IN ('asset', 'expense') AND account_data->>'normalBalance' != 'debit' THEN
        warnings := array_append(warnings, 'Assets and expenses typically have debit normal balance');
    END IF;
    
    IF account_data->>'accountType' IN ('liability', 'equity', 'revenue') AND account_data->>'normalBalance' != 'credit' THEN
        warnings := array_append(warnings, 'Liabilities, equity, and revenue typically have credit normal balance');
    END IF;
    
    -- Build result
    result := jsonb_build_object(
        'isValid', array_length(errors, 1) IS NULL OR array_length(errors, 1) = 0,
        'errors', errors,
        'warnings', warnings,
        'completenessScore', ROUND((completeness_score::decimal / total_fields) * 100),
        'validatedAt', now()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically categorize account based on rules
CREATE OR REPLACE FUNCTION auto_categorize_account(
    account_code TEXT,
    account_name TEXT,
    org_id UUID
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
    rule RECORD;
    account_data JSONB;
BEGIN
    -- Initialize account data
    account_data := jsonb_build_object(
        'accountCode', account_code,
        'accountName', account_name
    );
    
    -- Apply categorization rules in priority order
    FOR rule IN 
        SELECT * FROM account_categorization_rules 
        WHERE organization_id = org_id AND is_active = true
        ORDER BY priority DESC
    LOOP
        -- Apply rule logic here (simplified for this example)
        -- In practice, you'd evaluate the conditions and apply actions
        IF account_name ILIKE '%cash%' OR account_name ILIKE '%bank%' THEN
            account_data := account_data || jsonb_build_object(
                'accountType', 'asset',
                'category', 'Current Assets',
                'subcategory', 'Cash and Cash Equivalents',
                'isCurrentAccount', true,
                'normalBalance', 'debit',
                'financialStatementSection', 'Balance Sheet - Assets'
            );
            EXIT; -- Exit after first match
        END IF;
        
        IF account_name ILIKE '%revenue%' OR account_name ILIKE '%sales%' OR account_name ILIKE '%income%' THEN
            account_data := account_data || jsonb_build_object(
                'accountType', 'revenue',
                'category', 'Revenue',
                'normalBalance', 'credit',
                'financialStatementSection', 'Income Statement - Revenue'
            );
            EXIT;
        END IF;
    END LOOP;
    
    -- Apply default values if not set by rules
    IF account_data->>'accountType' IS NULL THEN
        -- Intelligent type detection based on account code patterns
        IF account_code ~ '^1' OR account_name ILIKE '%asset%' THEN
            account_data := account_data || jsonb_build_object('accountType', 'asset');
        ELSIF account_code ~ '^2' OR account_name ILIKE '%liabilit%' THEN
            account_data := account_data || jsonb_build_object('accountType', 'liability');
        ELSIF account_code ~ '^3' OR account_name ILIKE '%equity%' THEN
            account_data := account_data || jsonb_build_object('accountType', 'equity');
        ELSIF account_code ~ '^4' OR account_name ILIKE '%revenue%' THEN
            account_data := account_data || jsonb_build_object('accountType', 'revenue');
        ELSIF account_code ~ '^5' OR account_name ILIKE '%expense%' THEN
            account_data := account_data || jsonb_build_object('accountType', 'expense');
        END IF;
    END IF;
    
    -- Set normal balance based on account type
    IF account_data->>'normalBalance' IS NULL THEN
        IF account_data->>'accountType' IN ('asset', 'expense') THEN
            account_data := account_data || jsonb_build_object('normalBalance', 'debit');
        ELSE
            account_data := account_data || jsonb_build_object('normalBalance', 'credit');
        END IF;
    END IF;
    
    RETURN account_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create history record on account_mappings changes
CREATE OR REPLACE FUNCTION create_account_classification_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO account_classification_history (
            account_mapping_id,
            change_type,
            new_values,
            changed_by,
            organization_id,
            change_reason
        ) VALUES (
            NEW.id,
            'create',
            to_jsonb(NEW),
            NEW.created_by,
            NEW.organization_id,
            'Account created'
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO account_classification_history (
            account_mapping_id,
            change_type,
            old_values,
            new_values,
            changed_by,
            organization_id,
            change_reason
        ) VALUES (
            NEW.id,
            'update',
            to_jsonb(OLD),
            to_jsonb(NEW),
            NEW.updated_by,
            NEW.organization_id,
            'Account updated'
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO account_classification_history (
            account_mapping_id,
            change_type,
            old_values,
            changed_by,
            organization_id,
            change_reason
        ) VALUES (
            OLD.id,
            'delete',
            to_jsonb(OLD),
            OLD.updated_by,
            OLD.organization_id,
            'Account deleted'
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'account_classification_history_trigger') THEN
        CREATE TRIGGER account_classification_history_trigger
            AFTER INSERT OR UPDATE OR DELETE ON account_mappings
            FOR EACH ROW EXECUTE FUNCTION create_account_classification_history();
    END IF;
END
$$;



COMMENT ON TABLE account_mappings IS 'Stores account classifications and mappings for different accounting standards';
COMMENT ON TABLE chart_of_accounts_templates IS 'Predefined chart of accounts templates for different industries and standards';
COMMENT ON TABLE account_categorization_rules IS 'Rules for automatically categorizing accounts based on patterns';
COMMENT ON TABLE account_classification_history IS 'Audit trail for all account classification changes';
