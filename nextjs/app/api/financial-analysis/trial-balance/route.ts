import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { authenticateApiRequest } from '@/lib/auth/apiAuth';
import { processExcelFile } from '@/lib/processing/excelProcessor';

interface TrialBalanceEntry {
  accountCode: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  accountCategory?: string;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
}

interface ProcessTrialBalanceRequest {
  projectId: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  periodType: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  trialBalanceData: TrialBalanceEntry[];
  importSource?: string;
  importReference?: string;
}

/**
 * POST /api/financial-analysis/trial-balance
 * Process and validate trial balance data
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate and get user profile
    const auth = await authenticateApiRequest(request);
    if (!auth.success || !auth.user || !auth.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userProfile = auth.profile;
    const user = auth.user; // Use the authenticated user from auth result

    // Parse request body
    const body: ProcessTrialBalanceRequest = await request.json();
    const {
      projectId,
      reportingPeriodStart,
      reportingPeriodEnd,
      periodType,
      trialBalanceData,
      importSource,
      importReference,
    } = body;

    // Validate input
    if (!projectId || !reportingPeriodStart || !reportingPeriodEnd || !trialBalanceData) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: projectId, reportingPeriodStart, reportingPeriodEnd, trialBalanceData',
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(trialBalanceData) || trialBalanceData.length === 0) {
      return NextResponse.json(
        { error: 'Trial balance data must be a non-empty array' },
        { status: 400 }
      );
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

    // Validate trial balance data
    const validationResult = validateTrialBalance(trialBalanceData);
    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          error: 'Trial balance validation failed',
          validationErrors: validationResult.errors,
        },
        { status: 400 }
      );
    }

    // Check if chart of accounts exists or create entries
    const chartOfAccountsMap = await ensureChartOfAccounts(
      supabase,
      userProfile.organization_id,
      projectId,
      trialBalanceData,
      userProfile.id
    );

    // Prepare trial balance insert data
    const trialBalanceInsertData = trialBalanceData.map((entry) => ({
      organization_id: userProfile.organization_id,
      project_id: projectId,
      reporting_period_start: reportingPeriodStart,
      reporting_period_end: reportingPeriodEnd,
      period_type: periodType,
      account_id: chartOfAccountsMap[entry.accountCode],
      debit_balance: entry.debitBalance,
      credit_balance: entry.creditBalance,
      net_balance: entry.netBalance,
      is_balanced: validationResult.isBalanced,
      balance_difference: validationResult.balanceDifference,
      validation_status: validationResult.isValid ? 'validated' : 'failed',
      validation_errors: JSON.stringify(validationResult.errors),
      imported_from: importSource,
      import_reference: importReference,
      created_by: userProfile.id,
    }));

    // Insert trial balance data
    const { error: insertError } = await supabase
      .from('trial_balances')
      .insert(trialBalanceInsertData);

    if (insertError) {
      console.error('Error inserting trial balance:', insertError);
      return NextResponse.json({ error: 'Failed to save trial balance data' }, { status: 500 });
    }

    // Log audit trail
    await supabase.from('audit_logs').insert({
      organization_id: userProfile.organization_id,
      user_id: userProfile.id,
      action: 'trial_balance_upload',
      entity_type: 'project',
      entity_id: projectId,
      details: {
        accounts_processed: trialBalanceData.length,
        period_start: reportingPeriodStart,
        period_end: reportingPeriodEnd,
        is_balanced: validationResult.isBalanced,
        balance_difference: validationResult.balanceDifference,
        import_source: importSource,
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
          type: periodType,
        },
        accountsProcessed: trialBalanceData.length,
        validation: validationResult,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error processing trial balance:', error);
    return NextResponse.json(
      {
        error: 'Failed to process trial balance',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/financial-analysis/trial-balance?projectId=xxx&period=xxx
 * Retrieve trial balance data for a project
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate and get user profile
    const auth = await authenticateApiRequest(request);
    if (!auth.success || !auth.user || !auth.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userProfile = auth.profile;
    const user = auth.user; // Use the authenticated user from auth result

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const period = searchParams.get('period'); // 'latest' or specific date range

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

    // Build query with account details
    let query = supabase
      .from('trial_balances')
      .select(
        `
        *,
        chart_of_accounts!inner(
          account_code,
          account_name,
          account_type,
          account_category,
          account_subcategory,
          normal_balance
        )
      `
      )
      .eq('organization_id', userProfile.organization_id)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    // Add period filter
    if (period === 'latest') {
      // Get the most recent trial balance date first
      const { data: latestTB } = await supabase
        .from('trial_balances')
        .select('reporting_period_start, reporting_period_end')
        .eq('organization_id', userProfile.organization_id)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestTB) {
        query = query
          .eq('reporting_period_start', latestTB.reporting_period_start)
          .eq('reporting_period_end', latestTB.reporting_period_end);
      }
    } else if (period) {
      // Parse period range (format: YYYY-MM-DD:YYYY-MM-DD)
      const [startDate, endDate] = period.split(':');
      if (startDate && endDate) {
        query = query.eq('reporting_period_start', startDate).eq('reporting_period_end', endDate);
      }
    }

    const { data: trialBalanceData, error: tbError } = await query;

    if (tbError) {
      console.error('Error fetching trial balance:', tbError);
      return NextResponse.json({ error: 'Failed to fetch trial balance data' }, { status: 500 });
    }

    // Calculate summary statistics
    const summary = calculateTrialBalanceSummary(trialBalanceData || []);

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        projectName: project.name,
        trialBalance: trialBalanceData || [],
        summary,
        totalAccounts: trialBalanceData?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching trial balance:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch trial balance',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Validate trial balance data
 */
function validateTrialBalance(trialBalanceData: TrialBalanceEntry[]) {
  const errors: string[] = [];
  let totalDebits = 0;
  let totalCredits = 0;
  const accountCodes = new Set<string>();

  for (const entry of trialBalanceData) {
    // Check required fields
    if (!entry.accountCode || !entry.accountName) {
      errors.push(`Account ${entry.accountCode || 'UNKNOWN'}: Missing account code or name`);
      continue;
    }

    // Check for duplicate account codes
    if (accountCodes.has(entry.accountCode)) {
      errors.push(`Duplicate account code: ${entry.accountCode}`);
    }
    accountCodes.add(entry.accountCode);

    // Validate account type
    const validTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
    if (!validTypes.includes(entry.accountType)) {
      errors.push(`Account ${entry.accountCode}: Invalid account type "${entry.accountType}"`);
    }

    // Validate balance amounts
    if (typeof entry.debitBalance !== 'number' || typeof entry.creditBalance !== 'number') {
      errors.push(`Account ${entry.accountCode}: Invalid balance amounts`);
      continue;
    }

    if (entry.debitBalance < 0 || entry.creditBalance < 0) {
      errors.push(`Account ${entry.accountCode}: Negative balance amounts not allowed`);
    }

    // Check net balance calculation
    const calculatedNetBalance = entry.debitBalance - entry.creditBalance;
    if (Math.abs(calculatedNetBalance - entry.netBalance) > 0.01) {
      errors.push(`Account ${entry.accountCode}: Net balance calculation error`);
    }

    // Add to totals
    totalDebits += entry.debitBalance;
    totalCredits += entry.creditBalance;
  }

  // Check if trial balance is balanced
  const balanceDifference = totalDebits - totalCredits;
  const isBalanced = Math.abs(balanceDifference) < 0.01;

  if (!isBalanced) {
    errors.push(`Trial balance is not balanced. Difference: ${balanceDifference.toFixed(2)}`);
  }

  return {
    isValid: errors.length === 0,
    isBalanced,
    errors,
    balanceDifference,
    totalDebits,
    totalCredits,
    totalAccounts: trialBalanceData.length,
  };
}

/**
 * Ensure chart of accounts exists for all trial balance entries
 */
async function ensureChartOfAccounts(
  supabase: any,
  organizationId: string,
  projectId: string,
  trialBalanceData: TrialBalanceEntry[],
  userId: string
): Promise<Record<string, string>> {
  const chartOfAccountsMap: Record<string, string> = {};

  // Check existing accounts
  const { data: existingAccounts } = await supabase
    .from('chart_of_accounts')
    .select('id, account_code')
    .eq('organization_id', organizationId)
    .in(
      'account_code',
      trialBalanceData.map((entry) => entry.accountCode)
    )
    .eq('deleted_at', null);

  // Create map for existing accounts
  if (existingAccounts) {
    for (const account of existingAccounts) {
      chartOfAccountsMap[account.account_code] = account.id;
    }
  }

  // Create missing accounts
  const missingAccounts = trialBalanceData.filter(
    (entry) => !chartOfAccountsMap[entry.accountCode]
  );

  if (missingAccounts.length > 0) {
    const newAccountsData = missingAccounts.map((entry) => ({
      organization_id: organizationId,
      project_id: projectId,
      account_code: entry.accountCode,
      account_name: entry.accountName,
      account_type: entry.accountType,
      account_category: entry.accountCategory || 'General',
      normal_balance: getNormalBalance(entry.accountType),
      created_by: userId,
    }));

    const { data: newAccounts, error } = await supabase
      .from('chart_of_accounts')
      .insert(newAccountsData)
      .select('id, account_code');

    if (error) {
      throw new Error(`Failed to create chart of accounts: ${error.message}`);
    }

    // Add new accounts to map
    if (newAccounts) {
      for (const account of newAccounts) {
        chartOfAccountsMap[account.account_code] = account.id;
      }
    }
  }

  return chartOfAccountsMap;
}

/**
 * Get normal balance for account type
 */
function getNormalBalance(accountType: string): 'debit' | 'credit' {
  switch (accountType) {
    case 'asset':
    case 'expense':
      return 'debit';
    case 'liability':
    case 'equity':
    case 'revenue':
      return 'credit';
    default:
      return 'debit';
  }
}

/**
 * Calculate trial balance summary statistics
 */
function calculateTrialBalanceSummary(trialBalanceData: any[]) {
  const summary = {
    totalAccounts: trialBalanceData.length,
    totalDebits: 0,
    totalCredits: 0,
    balanceDifference: 0,
    isBalanced: false,
    accountsByType: {
      asset: 0,
      liability: 0,
      equity: 0,
      revenue: 0,
      expense: 0,
    },
    balancesByType: {
      asset: 0,
      liability: 0,
      equity: 0,
      revenue: 0,
      expense: 0,
    },
  };

  for (const entry of trialBalanceData) {
    summary.totalDebits += entry.debit_balance;
    summary.totalCredits += entry.credit_balance;

    const accountType = entry.chart_of_accounts
      ?.account_type as keyof typeof summary.accountsByType;
    if (accountType && Object.prototype.hasOwnProperty.call(summary.accountsByType, accountType)) {
      summary.accountsByType[accountType]++;
      summary.balancesByType[accountType] += Math.abs(entry.net_balance);
    }
  }

  summary.balanceDifference = summary.totalDebits - summary.totalCredits;
  summary.isBalanced = Math.abs(summary.balanceDifference) < 0.01;

  return summary;
}
