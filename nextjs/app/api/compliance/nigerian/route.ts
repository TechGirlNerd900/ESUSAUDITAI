import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserProfile } from '@/lib/auth/apiAuth';
import {
  performComplianceAssessment,
  generateComplianceReport,
  EntityType,
  ComplianceAssessment,
} from '@/lib/nigerian/nigerianCompliance';
import { withAuth } from '@/lib/auth/apiAuth'

interface ComplianceAssessmentRequest {
  projectId: string;
  entityType: EntityType;
  reportingPeriod: string;
  companyData: {
    // Financial data
    financialData?: {
      revenue: number;
      totalAssets: number;
      retainedEarnings: number;
    };

    // Going concern assessment
    goingConcernIndicators?: {
      assessmentPerformed: boolean;
      netLiabilitiesPosition?: boolean;
      loanDefaultsOrCovenantBreaches?: boolean;
      substantialOperatingLosses?: boolean;
      significantDependenceOnSpecificCustomers?: boolean;
      lossOfKeyManagement?: boolean;
    };

    // Related party disclosures
    relatedParties?: {
      disclosed: boolean;
      natureOfRelationship?: boolean;
      transactionDescriptions?: boolean;
      transactionAmounts?: boolean;
      outstandingBalances?: boolean;
      provisionsForDoubtfulDebts?: boolean;
    };

    // PPE information
    propertyPlantEquipment?: {
      valuationMethod?: 'cost' | 'revaluation';
      depreciationPolicyDocumented?: boolean;
    };

    // Impairment assessment
    impairmentAssessment?: {
      assessmentPerformed: boolean;
      indicatorsIdentified?: boolean;
      impairmentTestPerformed?: boolean;
    };

    // Business combinations
    businessCombinations?: {
      occurred: boolean;
    };

    // CAMA compliance data
    annualReturn?: {
      agmDate?: string;
      filingDate?: string;
    };

    financialStatementsFiling?: {
      filed: boolean;
      audited?: boolean;
    };

    boardComposition?: {
      numberOfDirectors: number;
    };

    auditRequirements?: {
      audited: boolean;
    };

    dividends?: {
      declared: boolean;
      amount?: number;
    };
  };
  saveToDatabase?: boolean;
}

/**
 * POST /api/compliance/nigerian
 * Perform Nigerian regulatory compliance assessment (FRS + CAMA 2020)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get user profile and verify access
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ComplianceAssessmentRequest = await request.json();

    // Validate required fields
    if (!body.projectId || !body.entityType || !body.reportingPeriod) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, entityType, reportingPeriod' },
        { status: 400 }
      );
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, organization_id')
      .eq('id', body.projectId)
      .eq('organization_id', userProfile.organization_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Validate entity type
    const validEntityTypes: EntityType[] = [
      'private_company',
      'public_company',
      'small_company',
      'medium_company',
      'large_company',
      'listed_company',
      'financial_institution',
      'ngo',
      'cooperative',
    ];

    if (!validEntityTypes.includes(body.entityType)) {
      return NextResponse.json(
        { error: `Invalid entity type. Must be one of: ${validEntityTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Perform compliance assessment
    const startTime = Date.now();
    const assessment = performComplianceAssessment(
      body.entityType,
      body.companyData,
      body.reportingPeriod
    );
    const processingTime = Date.now() - startTime;

    // Generate compliance report
    const report = generateComplianceReport(assessment);

    // Save to database if requested
    let savedAssessmentId: string | undefined;
    if (body.saveToDatabase) {
      try {
        const { data: savedAssessment, error: saveError } = await supabase
          .from('compliance_assessments')
          .insert({
            project_id: body.projectId,
            organization_id: userProfile.organization_id,
            entity_type: body.entityType,
            reporting_period: body.reportingPeriod,
            assessment_date: assessment.assessmentDate,

            // Overall scores
            overall_compliance_score: assessment.overallComplianceScore,
            frs_compliance_score: assessment.frsCompliance.overallScore,
            cama_compliance_score: assessment.camaCompliance.overallScore,

            // Issue counts
            critical_issues_count: assessment.criticalIssues.length,
            high_priority_issues_count: assessment.highPriorityIssues.length,
            total_frs_rules: assessment.frsCompliance.totalRules,
            compliant_frs_rules: assessment.frsCompliance.compliantRules,
            total_cama_rules: assessment.camaCompliance.totalRules,
            compliant_cama_rules: assessment.camaCompliance.compliantRules,

            // Detailed data
            company_data: body.companyData,
            assessment_results: assessment,
            compliance_report: report,
            recommended_actions: assessment.recommendedActions,

            // Metadata
            created_by: userProfile.id,
            processing_time_ms: processingTime,
          })
          .select('id')
          .single();

        if (saveError) {
          console.error('Error saving compliance assessment:', saveError);
          // Don't fail the request, just log the error
        } else {
          savedAssessmentId = savedAssessment?.id;
        }
      } catch (saveError) {
        console.error('Exception saving compliance assessment:', saveError);
      }
    }

    // Log the assessment
    await supabase.from('audit_logs').insert({
      organization_id: userProfile.organization_id,
      user_id: userProfile.id,
      action: 'compliance_assessment_performed',
      resource_type: 'compliance_assessment',
      resource_id: savedAssessmentId || body.projectId,
      details: {
        project_id: body.projectId,
        project_name: project.name,
        entity_type: body.entityType,
        reporting_period: body.reportingPeriod,
        overall_score: assessment.overallComplianceScore,
        critical_issues: assessment.criticalIssues.length,
        high_priority_issues: assessment.highPriorityIssues.length,
        processing_time_ms: processingTime,
        saved_to_database: !!savedAssessmentId,
      },
      ip_address:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    });

    // Return comprehensive response
    return NextResponse.json({
      success: true,
      data: {
        assessmentId: savedAssessmentId,
        projectId: body.projectId,
        projectName: project.name,
        entityType: body.entityType,
        reportingPeriod: body.reportingPeriod,
        processingTime,

        // Core assessment results
        assessment,
        report,

        // Summary metrics
        summary: {
          overallComplianceScore: assessment.overallComplianceScore,
          criticalIssuesCount: assessment.criticalIssues.length,
          highPriorityIssuesCount: assessment.highPriorityIssues.length,
          frsComplianceScore: assessment.frsCompliance.overallScore,
          camaComplianceScore: assessment.camaCompliance.overallScore,
          recommendedActionsCount: assessment.recommendedActions.length,
        },

        // Metadata
        metadata: {
          assessmentDate: assessment.assessmentDate,
          standardsAssessed: ['FRS_102', 'CAMA_2020'],
          entityType: body.entityType,
          generatedAt: new Date().toISOString(),
          savedToDatabase: !!savedAssessmentId,
        },
      },
    });
  } catch (error) {
    console.error('Error in Nigerian compliance assessment:', error);

    return NextResponse.json(
      {
        error: 'Internal server error during compliance assessment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/compliance/nigerian?projectId=xxx&assessmentId=xxx
 * Retrieve saved compliance assessments
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get user profile
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const assessmentId = searchParams.get('assessmentId');

    if (!projectId && !assessmentId) {
      return NextResponse.json(
        { error: 'Either projectId or assessmentId is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('compliance_assessments')
      .select(
        `
        id,
        project_id,
        entity_type,
        reporting_period,
        assessment_date,
        overall_compliance_score,
        frs_compliance_score,
        cama_compliance_score,
        critical_issues_count,
        high_priority_issues_count,
        total_frs_rules,
        compliant_frs_rules,
        total_cama_rules,
        compliant_cama_rules,
        company_data,
        assessment_results,
        compliance_report,
        recommended_actions,
        processing_time_ms,
        created_at,
        created_by,
        projects!inner(name, organization_id)
      `
      )
      .eq('organization_id', userProfile.organization_id);

    if (assessmentId) {
      query = query.eq('id', assessmentId);
    } else {
      query = query.eq('project_id', projectId);
    }

    const { data: assessments, error } = await query
      .order('created_at', { ascending: false })
      .limit(assessmentId ? 1 : 10);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to retrieve compliance assessments' },
        { status: 500 }
      );
    }

    if (assessmentId && (!assessments || assessments.length === 0)) {
      return NextResponse.json({ error: 'Compliance assessment not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: assessmentId ? assessments[0] : assessments,
    });
  } catch (error) {
    console.error('Error retrieving compliance assessment:', error);

    return NextResponse.json(
      {
        error: 'Internal server error retrieving compliance assessment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(async (request: NextRequest, user) => {
  // Return placeholder compliance data for now
  return new Response(
    JSON.stringify({ 
      compliance: {
        overall_score: 85,
        status: 'compliant',
        framework: 'nigerian_frs',
        last_updated: new Date().toISOString(),
        checks: {
          passed: 17,
          total: 20
        },
        recommendations: [
          'Review financial statement disclosures',
          'Update chart of accounts mapping'
        ]
      }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
