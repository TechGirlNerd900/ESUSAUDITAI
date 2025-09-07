import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserProfile } from '@/lib/auth/apiAuth';
import {
  calculateVarianceAnalysis,
  generateVarianceSummary,
  generateVarianceReport,
  exportVarianceAnalysis,
  VarianceAnalysisData,
  VarianceThresholds,
  DEFAULT_VARIANCE_THRESHOLDS,
} from '@/lib/financial/varianceAnalysis';

interface VarianceAnalysisRequest {
  projectId: string;
  companyName?: string;
  reportingPeriod: string;
  periodType: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  varianceData: VarianceAnalysisData[];
  customThresholds?: Partial<VarianceThresholds>;
  includeReport?: boolean;
  saveToDatabase?: boolean;
}

/**
 * POST /api/financial-analysis/variance
 * Perform comprehensive variance analysis on financial data
 */
export async function POST(request: NextRequest) {
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

    const body: VarianceAnalysisRequest = await request.json();

    // Validate required fields
    if (!body.projectId || !body.varianceData || !Array.isArray(body.varianceData)) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, varianceData' },
        { status: 400 }
      );
    }

    if (body.varianceData.length === 0) {
      return NextResponse.json({ error: 'Variance data array cannot be empty' }, { status: 400 });
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

    // Merge custom thresholds with defaults
    const thresholds: VarianceThresholds = {
      ...DEFAULT_VARIANCE_THRESHOLDS,
      ...body.customThresholds,
    };

    // Validate variance data structure
    const validationErrors: string[] = [];
    body.varianceData.forEach((item, index) => {
      if (!item.accountCode || !item.accountName) {
        validationErrors.push(`Item ${index}: accountCode and accountName are required`);
      }
      if (!['asset', 'liability', 'equity', 'revenue', 'expense'].includes(item.accountType)) {
        validationErrors.push(`Item ${index}: invalid accountType`);
      }
      if (typeof item.actualAmount !== 'number') {
        validationErrors.push(`Item ${index}: actualAmount must be a number`);
      }
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Data validation failed', details: validationErrors },
        { status: 400 }
      );
    }

    // Perform variance analysis
    const startTime = Date.now();
    const variances = calculateVarianceAnalysis(body.varianceData, thresholds);
    const summary = generateVarianceSummary(variances);
    const processingTime = Date.now() - startTime;

    // Generate report if requested
    let report: string | undefined;
    if (body.includeReport) {
      report = generateVarianceReport(
        variances,
        summary,
        body.companyName || project.name,
        body.reportingPeriod
      );
    }

    // Export structured data
    const exportData = exportVarianceAnalysis(variances, summary);

    // Save to database if requested
    let savedAnalysisId: string | undefined;
    if (body.saveToDatabase) {
      try {
        const { data: savedAnalysis, error: saveError } = await supabase
          .from('variance_analyses')
          .insert({
            project_id: body.projectId,
            organization_id: userProfile.organization_id,
            reporting_period: body.reportingPeriod,
            period_type: body.periodType,
            company_name: body.companyName || project.name,
            total_variances: summary.totalVariances,
            critical_variances: summary.criticalVariances,
            high_variances: summary.highVariances,
            unfavorable_variances: summary.unfavorableBudgetVariances,
            total_budget_variance: summary.totalBudgetVarianceAmount,
            total_period_variance: summary.totalPeriodVarianceAmount,
            thresholds_used: thresholds,
            variance_data: variances,
            summary_data: summary,
            report_text: report,
            created_by: userProfile.id,
            processing_time_ms: processingTime,
          })
          .select('id')
          .single();

        if (saveError) {
          console.error('Error saving variance analysis:', saveError);
          // Don't fail the request, just log the error
        } else {
          savedAnalysisId = savedAnalysis?.id;
        }
      } catch (saveError) {
        console.error('Exception saving variance analysis:', saveError);
      }
    }

    // Log the analysis
    await supabase.from('audit_logs').insert({
      organization_id: userProfile.organization_id,
      user_id: userProfile.id,
      action: 'variance_analysis_performed',
      resource_type: 'variance_analysis',
      resource_id: savedAnalysisId || body.projectId,
      details: {
        project_id: body.projectId,
        project_name: project.name,
        reporting_period: body.reportingPeriod,
        period_type: body.periodType,
        accounts_analyzed: body.varianceData.length,
        critical_variances: summary.criticalVariances,
        high_variances: summary.highVariances,
        processing_time_ms: processingTime,
        saved_to_database: !!savedAnalysisId,
      },
      ip_address:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    });

    // Return comprehensive response
    return NextResponse.json({
      success: true,
      data: {
        analysisId: savedAnalysisId,
        projectId: body.projectId,
        projectName: project.name,
        reportingPeriod: body.reportingPeriod,
        periodType: body.periodType,
        processingTime: processingTime,

        // Core results
        variances,
        summary,

        // Optional outputs
        ...(report && { report }),
        exportData,

        // Metadata
        metadata: {
          accountsAnalyzed: body.varianceData.length,
          thresholdsUsed: thresholds,
          generatedAt: new Date().toISOString(),
          savedToDatabase: !!savedAnalysisId,
        },
      },
    });
  } catch (error) {
    console.error('Error in variance analysis:', error);

    return NextResponse.json(
      {
        error: 'Internal server error during variance analysis',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/financial-analysis/variance?projectId=xxx&analysisId=xxx
 * Retrieve saved variance analysis
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
    const analysisId = searchParams.get('analysisId');

    if (!projectId && !analysisId) {
      return NextResponse.json(
        { error: 'Either projectId or analysisId is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('variance_analyses')
      .select(
        `
        id,
        project_id,
        reporting_period,
        period_type,
        company_name,
        total_variances,
        critical_variances,
        high_variances,
        unfavorable_variances,
        total_budget_variance,
        total_period_variance,
        thresholds_used,
        variance_data,
        summary_data,
        report_text,
        processing_time_ms,
        created_at,
        created_by,
        projects!inner(name, organization_id)
      `
      )
      .eq('organization_id', userProfile.organization_id);

    if (analysisId) {
      query = query.eq('id', analysisId);
    } else {
      query = query.eq('project_id', projectId);
    }

    const { data: analyses, error } = await query
      .order('created_at', { ascending: false })
      .limit(analysisId ? 1 : 10);

    if (error) {
      return NextResponse.json({ error: 'Failed to retrieve variance analyses' }, { status: 500 });
    }

    if (analysisId && (!analyses || analyses.length === 0)) {
      return NextResponse.json({ error: 'Variance analysis not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: analysisId ? analyses[0] : analyses,
    });
  } catch (error) {
    console.error('Error retrieving variance analysis:', error);

    return NextResponse.json(
      {
        error: 'Internal server error retrieving variance analysis',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
