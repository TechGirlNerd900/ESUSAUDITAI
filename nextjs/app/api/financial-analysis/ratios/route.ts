import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getUserProfile } from '@/lib/apiAuth';
import {
  calculateAllFinancialRatios,
  TrialBalanceData,
  FinancialRatio,
} from '@/lib/financialRatios';

interface CalculateRatiosRequest {
  projectId: string;
  trialBalance: TrialBalanceData[];
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  saveToDatabase?: boolean;
}

/**
 * POST /api/financial-analysis/ratios
 * Calculate financial ratios from trial balance data
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get user profile
    const userProfile = await getUserProfile(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not authenticated or profile not found' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CalculateRatiosRequest = await request.json();
    const {
      projectId,
      trialBalance,
      reportingPeriodStart,
      reportingPeriodEnd,
      saveToDatabase = false,
    } = body;

    // Validate input
    if (!projectId || !trialBalance || !Array.isArray(trialBalance)) {
      return NextResponse.json(
        { error: 'Invalid input: projectId and trialBalance are required' },
        { status: 400 }
      );
    }

    if (trialBalance.length === 0) {
      return NextResponse.json({ error: 'Trial balance data cannot be empty' }, { status: 400 });
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, organization_id, name')
      .eq('id', projectId)
      .eq('organization_id', userProfile.organization_id)
      .eq('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Calculate financial ratios
    const calculatedRatios = calculateAllFinancialRatios(trialBalance);

    // Save to database if requested
    if (saveToDatabase && calculatedRatios.length > 0) {
      const ratioInsertData = calculatedRatios.map((ratio) => ({
        organization_id: userProfile.organization_id,
        project_id: projectId,
        reporting_period_start: reportingPeriodStart,
        reporting_period_end: reportingPeriodEnd,
        ratio_category: ratio.category,
        ratio_name: ratio.name,
        ratio_formula: ratio.formula,
        ratio_value: ratio.value,
        numerator: ratio.numerator,
        denominator: ratio.denominator,
        industry_benchmark: ratio.industryBenchmark,
        interpretation: ratio.interpretation,
        risk_level: ratio.riskLevel,
        analysis_notes: ratio.analysisNotes,
        calculation_method: 'automated',
        data_source: 'trial_balance',
        created_by: userProfile.id,
      }));

      const { error: insertError } = await supabase
        .from('financial_ratios')
        .insert(ratioInsertData);

      if (insertError) {
        console.error('Error saving financial ratios:', insertError);
        // Continue without failing - ratios are still calculated
      }
    }

    // Generate summary
    const summary = generateRatioSummary(calculatedRatios);

    // Log audit trail
    await supabase.from('audit_logs').insert({
      organization_id: userProfile.organization_id,
      user_id: userProfile.id,
      action: 'financial_ratio_calculation',
      entity_type: 'project',
      entity_id: projectId,
      details: {
        ratios_calculated: calculatedRatios.length,
        period_start: reportingPeriodStart,
        period_end: reportingPeriodEnd,
        saved_to_database: saveToDatabase,
      },
      ip_address:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        projectName: project.name,
        reportingPeriod: {
          start: reportingPeriodStart,
          end: reportingPeriodEnd,
        },
        ratios: calculatedRatios,
        summary,
        calculatedAt: new Date().toISOString(),
        savedToDatabase: saveToDatabase,
      },
    });
  } catch (error) {
    console.error('Error calculating financial ratios:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate financial ratios',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/financial-analysis/ratios?projectId=xxx&period=xxx
 * Retrieve previously calculated financial ratios
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get user profile
    const userProfile = await getUserProfile(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not authenticated or profile not found' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const period = searchParams.get('period'); // 'latest' or specific date range
    const category = searchParams.get('category'); // Optional filter by category

    if (!projectId) {
      return NextResponse.json({ error: 'projectId parameter is required' }, { status: 400 });
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, organization_id, name')
      .eq('id', projectId)
      .eq('organization_id', userProfile.organization_id)
      .eq('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('financial_ratios')
      .select('*')
      .eq('organization_id', userProfile.organization_id)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    // Add category filter if provided
    if (category) {
      query = query.eq('ratio_category', category);
    }

    // Add period filter
    if (period === 'latest') {
      // Get the most recent calculation date first
      const { data: latestRatio } = await supabase
        .from('financial_ratios')
        .select('reporting_period_start, reporting_period_end')
        .eq('organization_id', userProfile.organization_id)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestRatio) {
        query = query
          .eq('reporting_period_start', latestRatio.reporting_period_start)
          .eq('reporting_period_end', latestRatio.reporting_period_end);
      }
    } else if (period) {
      // Parse period range (format: YYYY-MM-DD:YYYY-MM-DD)
      const [startDate, endDate] = period.split(':');
      if (startDate && endDate) {
        query = query.eq('reporting_period_start', startDate).eq('reporting_period_end', endDate);
      }
    }

    const { data: ratios, error: ratiosError } = await query;

    if (ratiosError) {
      console.error('Error fetching financial ratios:', ratiosError);
      return NextResponse.json({ error: 'Failed to fetch financial ratios' }, { status: 500 });
    }

    // Group ratios by category
    const ratiosByCategory = groupRatiosByCategory(ratios || []);
    const summary = generateRatioSummary(ratios || []);

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        projectName: project.name,
        ratios: ratios || [],
        ratiosByCategory,
        summary,
        totalRatios: ratios?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching financial ratios:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch financial ratios',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a summary of financial ratios
 */
function generateRatioSummary(ratios: FinancialRatio[]) {
  const summary = {
    totalRatios: ratios.length,
    categories: {
      liquidity: 0,
      profitability: 0,
      leverage: 0,
      efficiency: 0,
      market: 0,
    },
    riskLevels: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    },
    interpretations: {
      excellent: 0,
      good: 0,
      acceptable: 0,
      poor: 0,
      critical: 0,
    },
    overallRiskLevel: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    keyFindings: [] as string[],
  };

  // Count categories, risk levels, and interpretations
  ratios.forEach((ratio) => {
    summary.categories[ratio.category]++;
    summary.riskLevels[ratio.riskLevel]++;
    summary.interpretations[ratio.interpretation]++;
  });

  // Determine overall risk level
  const criticalCount = summary.riskLevels.critical;
  const highCount = summary.riskLevels.high;
  const totalRatios = ratios.length;

  if (criticalCount > 0) {
    summary.overallRiskLevel = 'critical';
  } else if (highCount / totalRatios > 0.3) {
    summary.overallRiskLevel = 'high';
  } else if (highCount > 0 || summary.riskLevels.medium / totalRatios > 0.5) {
    summary.overallRiskLevel = 'medium';
  } else {
    summary.overallRiskLevel = 'low';
  }

  // Generate key findings
  const criticalRatios = ratios.filter((r) => r.riskLevel === 'critical');
  const excellentRatios = ratios.filter((r) => r.interpretation === 'excellent');
  const poorRatios = ratios.filter(
    (r) => r.interpretation === 'poor' || r.interpretation === 'critical'
  );

  if (criticalRatios.length > 0) {
    summary.keyFindings.push(
      `${criticalRatios.length} ratio(s) at critical risk level require immediate attention`
    );
  }

  if (excellentRatios.length > 0) {
    summary.keyFindings.push(`${excellentRatios.length} ratio(s) show excellent performance`);
  }

  if (poorRatios.length > 0) {
    summary.keyFindings.push(
      `${poorRatios.length} ratio(s) show poor performance and need improvement`
    );
  }

  // Category-specific findings
  const liquidityRatios = ratios.filter((r) => r.category === 'liquidity');
  const profitabilityRatios = ratios.filter((r) => r.category === 'profitability');

  const poorLiquidity = liquidityRatios.filter(
    (r) => r.riskLevel === 'high' || r.riskLevel === 'critical'
  ).length;

  const poorProfitability = profitabilityRatios.filter(
    (r) => r.interpretation === 'poor' || r.interpretation === 'critical'
  ).length;

  if (poorLiquidity > 0) {
    summary.keyFindings.push(
      'Liquidity concerns identified - may affect ability to meet short-term obligations'
    );
  }

  if (poorProfitability > 0) {
    summary.keyFindings.push('Profitability challenges identified - review operational efficiency');
  }

  return summary;
}

/**
 * Group ratios by category
 */
function groupRatiosByCategory(ratios: any[]) {
  return ratios.reduce(
    (groups, ratio) => {
      const category = ratio.ratio_category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(ratio);
      return groups;
    },
    {} as Record<string, any[]>
  );
}
