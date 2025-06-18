-- Standard Audit Templates and Procedures
-- This file contains initial audit programs, procedures, and templates based on industry standards

-- Insert standard audit programs
INSERT INTO audit_programs (name, standard_reference, risk_level, required_procedures, compliance_requirements, status) VALUES
(
    'Financial Statement Audit Program',
    'ISA 200-700',
    'high',
    '{
        "planning": {
            "materiality_calculation": true,
            "risk_assessment": true,
            "understand_entity": true,
            "identify_significant_accounts": true
        },
        "execution": {
            "test_controls": true,
            "substantive_procedures": true,
            "analytical_procedures": true
        },
        "completion": {
            "evaluate_misstatements": true,
            "form_opinion": true,
            "prepare_reports": true
        }
    }'::jsonb,
    '{
        "standards": ["ISA 200", "ISA 315", "ISA 320", "ISA 330", "ISA 450", "ISA 700"],
        "regulatory": ["Local GAAP", "IFRS"]
    }'::jsonb,
    'approved'
),
(
    'Revenue Recognition Audit Program',
    'ISA 315/330',
    'high',
    '{
        "procedures": [
            {
                "step": "Review revenue recognition policy",
                "type": "documentation",
                "required": true
            },
            {
                "step": "Test of controls over revenue",
                "type": "control_testing",
                "required": true,
                "sample_size_basis": "risk_based"
            },
            {
                "step": "Substantive testing of revenue transactions",
                "type": "substantive",
                "required": true,
                "sampling_method": "monetary_unit"
            },
            {
                "step": "Cut-off testing",
                "type": "substantive",
                "required": true
            }
        ]
    }'::jsonb,
    '{
        "standards": ["ISA 315", "ISA 330", "IFRS 15"],
        "regulatory": ["Revenue Recognition Guidelines"]
    }'::jsonb,
    'approved'
),
(
    'Inventory Audit Program',
    'ISA 501',
    'high',
    '{
        "procedures": [
            {
                "step": "Physical inventory observation",
                "type": "observation",
                "required": true
            },
            {
                "step": "Cost verification",
                "type": "substantive",
                "required": true
            },
            {
                "step": "Net realizable value testing",
                "type": "analytical",
                "required": true
            }
        ]
    }'::jsonb,
    '{
        "standards": ["ISA 501", "IAS 2"],
        "regulatory": ["Inventory Valuation Guidelines"]
    }'::jsonb,
    'approved'
);

-- Insert standard workpaper templates
INSERT INTO workpapers (
    audit_program_id,
    reference_number,
    name,
    description,
    procedure_steps,
    status
) VALUES
(
    (SELECT id FROM audit_programs WHERE name = 'Financial Statement Audit Program' LIMIT 1),
    'FS-1.0',
    'Materiality Calculation Worksheet',
    'Template for calculating overall and performance materiality',
    '{
        "steps": [
            {
                "id": 1,
                "description": "Determine basis for materiality",
                "guidance": "Consider: Revenue, Profit before tax, Total assets",
                "required": true
            },
            {
                "id": 2,
                "description": "Calculate overall materiality",
                "formula": "basis * percentage",
                "required": true
            },
            {
                "id": 3,
                "description": "Calculate performance materiality",
                "formula": "overall_materiality * 75%",
                "required": true
            }
        ]
    }'::jsonb,
    'draft'
),
(
    (SELECT id FROM audit_programs WHERE name = 'Revenue Recognition Audit Program' LIMIT 1),
    'REV-1.0',
    'Revenue Testing Worksheet',
    'Template for revenue recognition testing',
    '{
        "steps": [
            {
                "id": 1,
                "description": "Document revenue streams",
                "required": true
            },
            {
                "id": 2,
                "description": "Test sample transactions",
                "worksteps": [
                    "Verify contract existence",
                    "Check performance obligations",
                    "Verify transaction price",
                    "Confirm revenue timing"
                ],
                "required": true
            }
        ],
        "sampling": {
            "method": "monetary_unit",
            "confidence_level": 95,
            "precision": "materiality * 0.5"
        }
    }'::jsonb,
    'draft'
);

-- Insert risk assessment templates
INSERT INTO risk_assessments (
    project_id,
    area,
    risk_description,
    risk_level,
    impact_assessment,
    likelihood,
    mitigating_controls,
    residual_risk_level
) VALUES
(
    NULL, -- Template, not tied to specific project
    'Revenue Recognition',
    'Risk of improper revenue recognition due to complex contracts or premature recognition',
    'high',
    'Material misstatement in financial statements and potential regulatory non-compliance',
    'possible',
    'Automated contract review system, Multi-level approval process, Regular reconciliations',
    'medium'
),
(
    NULL,
    'Inventory Valuation',
    'Risk of incorrect inventory valuation due to obsolescence or cost allocation errors',
    'high',
    'Material misstatement in financial statements affecting profit margins',
    'possible',
    'Regular stock counts, Automated aging analysis, Quarterly obsolescence review',
    'medium'
);

-- Insert sampling templates
INSERT INTO audit_samples (
    workpaper_id,
    population_size,
    sample_size,
    confidence_level,
    materiality_threshold,
    sampling_method,
    selected_items
) VALUES
(
    (SELECT id FROM workpapers WHERE reference_number = 'REV-1.0' LIMIT 1),
    1000, -- Example population size
    60,   -- Example sample size
    95.0, -- 95% confidence level
    0.02, -- 2% materiality threshold
    'monetary_unit',
    '{
        "method_details": {
            "interval_size": "population_value / sample_size",
            "random_start": true,
            "stratification": {
                "high_value": "top 10% by amount",
                "medium_value": "next 30% by amount",
                "low_value": "remaining items"
            }
        }
    }'::jsonb
);

-- Create audit log entry for templates
INSERT INTO audit_logs (
    action,
    resource_type,
    details,
    success
) VALUES (
    'template_initialization',
    'audit_programs',
    '{"type": "standard_templates", "count": "3 programs, 2 workpapers, 2 risk_assessments"}'::jsonb,
    true
);