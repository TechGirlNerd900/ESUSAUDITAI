import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getUserProfile } from '@/lib/apiAuth';
import { importTrialBalanceFromExcel } from '@/lib/trialBalanceImporter';

/**
 * POST /api/financial-analysis/trial-balance/upload
 * Upload and process Excel file containing trial balance data
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const reportingPeriodStart = formData.get('reportingPeriodStart') as string;
    const reportingPeriodEnd = formData.get('reportingPeriodEnd') as string;
    const periodType = (formData.get('periodType') as string) || 'monthly';
    const worksheetName = formData.get('worksheetName') as string;
    const headerRow = parseInt(formData.get('headerRow') as string) || 1;
    const startRow = parseInt(formData.get('startRow') as string) || 2;
    const endRow = formData.get('endRow') ? parseInt(formData.get('endRow') as string) : undefined;
    const autoDetectAccountTypes = formData.get('autoDetectAccountTypes') === 'true';

    // Validate input
    if (!file || !projectId || !reportingPeriodStart || !reportingPeriodEnd) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: file, projectId, reportingPeriodStart, reportingPeriodEnd',
        },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload Excel (.xlsx, .xls) or CSV files only.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 10MB.' },
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

    // Convert file to ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Import trial balance from Excel
    const importResult = await importTrialBalanceFromExcel(fileBuffer, {
      worksheetName: worksheetName || undefined,
      headerRow,
      startRow,
      endRow,
      autoDetectAccountTypes,
    });

    if (!importResult.success) {
      return NextResponse.json(
        {
          error: 'Failed to import trial balance from Excel',
          details: importResult.errors,
          warnings: importResult.warnings,
        },
        { status: 400 }
      );
    }

    // Process the imported data similar to the main trial balance route
    if (importResult.data.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid trial balance data found in the file',
          warnings: importResult.warnings,
        },
        { status: 400 }
      );
    }

    // Ensure chart of accounts exists
    const chartOfAccountsMap = await ensureChartOfAccounts(
      supabase,
      userProfile.organization_id,
      projectId,
      importResult.data,
      userProfile.id
    );

    // Prepare trial balance insert data
    const trialBalanceInsertData = importResult.data.map((entry) => ({
      organization_id: userProfile.organization_id,
      project_id: projectId,
      reporting_period_start: reportingPeriodStart,
      reporting_period_end: reportingPeriodEnd,
      period_type: periodType,
      account_id: chartOfAccountsMap[entry.accountCode],
      debit_balance: entry.debitBalance,
      credit_balance: entry.creditBalance,
      net_balance: entry.netBalance,
      is_balanced: importResult.summary.isBalanced,
      balance_difference: importResult.summary.balanceDifference,
      validation_status: 'validated',
      validation_errors: JSON.stringify(importResult.errors),
      imported_from: 'excel_upload',
      import_reference: file.name,
      created_by: userProfile.id,
    }));

    // Insert trial balance data
    const { error: insertError } = await supabase
      .from('trial_balances')
      .insert(trialBalanceInsertData);

    if (insertError) {
      console.error('Error inserting trial balance:', insertError);
      return NextResponse.json(
        { error: 'Failed to save trial balance data to database' },
        { status: 500 }
      );
    }

    // Log audit trail
    await supabase.from('audit_logs').insert({
      organization_id: userProfile.organization_id,
      user_id: userProfile.id,
      action: 'trial_balance_excel_upload',
      entity_type: 'project',
      entity_id: projectId,
      details: {
        filename: file.name,
        file_size: file.size,
        accounts_processed: importResult.data.length,
        period_start: reportingPeriodStart,
        period_end: reportingPeriodEnd,
        is_balanced: importResult.summary.isBalanced,
        balance_difference: importResult.summary.balanceDifference,
        import_summary: importResult.summary,
      },
      ip_address:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        projectName: project.name,
        filename: file.name,
        reportingPeriod: {
          start: reportingPeriodStart,
          end: reportingPeriodEnd,
          type: periodType,
        },
        importSummary: importResult.summary,
        accountsProcessed: importResult.data.length,
        errors: importResult.errors,
        warnings: importResult.warnings,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error uploading trial balance Excel:', error);
    return NextResponse.json(
      {
        error: 'Failed to process Excel upload',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Ensure chart of accounts exists for all trial balance entries
 */
async function ensureChartOfAccounts(
  supabase: any,
  organizationId: string,
  projectId: string,
  trialBalanceData: any[],
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
