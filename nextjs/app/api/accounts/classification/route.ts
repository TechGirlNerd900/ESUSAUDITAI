import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  accountClassificationEngine,
  AccountMapping,
  ChartOfAccountsTemplate,
} from '@/lib/financial/accountClassification';

/**
 * Account Classification Management API
 * Handles chart of accounts, account mapping, and automated classification
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    switch (action) {
      case 'list':
        return await handleListAccounts(supabase, organizationId);

      case 'template': {
        const industryType = searchParams.get('industryType') || 'trading';
        const standard = (searchParams.get('standard') as 'IFRS' | 'GAAP' | 'FRS') || 'IFRS';
        return await handleGetTemplate(industryType, standard, organizationId);
      }
      case 'analytics':
        return await handleGetAnalytics(supabase, organizationId);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Account classification API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    switch (action) {
      case 'categorize':
        return await handleCategorizeAccount(body);

      case 'bulkImport':
        return await handleBulkImport(supabase, body, user.id);

      case 'createTemplate':
        return await handleCreateTemplate(supabase, body, user.id);

      case 'validate':
        return await handleValidateClassification(body);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Account classification POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { accountId, updates, organizationId } = body;

    if (!accountId || !organizationId) {
      return NextResponse.json(
        { error: 'Account ID and Organization ID required' },
        { status: 400 }
      );
    }

    return await handleUpdateAccount(supabase, accountId, updates, organizationId, user.id);
  } catch (error) {
    console.error('Account classification PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const organizationId = searchParams.get('organizationId');

    if (!accountId || !organizationId) {
      return NextResponse.json(
        { error: 'Account ID and Organization ID required' },
        { status: 400 }
      );
    }

    return await handleDeleteAccount(supabase, accountId, organizationId);
  } catch (error) {
    console.error('Account classification DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handler Functions
 */

async function handleListAccounts(supabase: any, organizationId: string) {
  const { data: accounts, error } = await supabase
    .from('account_mappings')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('account_code');

  if (error) {
    throw new Error(`Failed to fetch accounts: ${error.message}`);
  }

  // Get classification analytics
  const analytics = accountClassificationEngine.getClassificationAnalytics(accounts || []);

  return NextResponse.json({
    success: true,
    data: {
      accounts: accounts || [],
      analytics,
      total: accounts?.length || 0,
    },
  });
}

async function handleGetTemplate(
  industryType: string,
  standard: 'IFRS' | 'GAAP' | 'FRS',
  organizationId: string
) {
  const template = accountClassificationEngine.generateChartOfAccounts(
    industryType,
    standard,
    organizationId
  );

  return NextResponse.json({
    success: true,
    data: { template },
  });
}

async function handleGetAnalytics(supabase: any, organizationId: string) {
  const { data: accounts, error } = await supabase
    .from('account_mappings')
    .select('*')
    .eq('organization_id', organizationId);

  if (error) {
    throw new Error(`Failed to fetch accounts for analytics: ${error.message}`);
  }

  const analytics = accountClassificationEngine.getClassificationAnalytics(accounts || []);

  return NextResponse.json({
    success: true,
    data: { analytics },
  });
}

async function handleCategorizeAccount(body: any) {
  const { accountCode, accountName, existingData } = body;

  if (!accountCode || !accountName) {
    return NextResponse.json({ error: 'Account code and name are required' }, { status: 400 });
  }

  const categorizedAccount = accountClassificationEngine.categorizeAccount(
    accountCode,
    accountName,
    existingData
  );

  // Validate the categorization
  const validation = accountClassificationEngine.validateAccountClassification(
    categorizedAccount as AccountMapping
  );

  return NextResponse.json({
    success: true,
    data: {
      account: categorizedAccount,
      validation,
    },
  });
}

async function handleBulkImport(supabase: any, body: any, userId: string) {
  const { accounts, organizationId } = body;

  if (!accounts || !Array.isArray(accounts)) {
    return NextResponse.json({ error: 'Invalid accounts data' }, { status: 400 });
  }

  // Process bulk import
  const importResult = await accountClassificationEngine.bulkImportAccounts(
    accounts,
    organizationId
  );

  // Save successful accounts to database
  if (importResult.successful.length > 0) {
    const { error } = await supabase.from('account_mappings').insert(
      importResult.successful.map((account) => ({
        id: account.id,
        account_code: account.accountCode,
        account_name: account.accountName,
        account_type: account.accountType,
        account_subtype: account.accountSubtype,
        category: account.category,
        subcategory: account.subcategory,
        is_current_account: account.isCurrentAccount,
        normal_balance: account.normalBalance,
        financial_statement_section: account.financialStatementSection,
        ifrs_mapping: account.ifrsMapping,
        gaap_mapping: account.gaapMapping,
        frs_mapping: account.frsMapping,
        tax_attributes: account.taxAttributes,
        audit_attributes: account.auditAttributes,
        compliance_requirements: account.complianceRequirements,
        is_active: account.isActive,
        organization_id: account.organizationId,
        created_by: userId,
        last_updated: account.lastUpdated,
      }))
    );

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json({ error: 'Failed to save accounts to database' }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    data: importResult,
  });
}

async function handleCreateTemplate(supabase: any, body: any, userId: string) {
  const { template, organizationId } = body;

  if (!template || !template.name) {
    return NextResponse.json({ error: 'Invalid template data' }, { status: 400 });
  }

  // Save template to database
  const { data, error } = await supabase
    .from('chart_of_accounts_templates')
    .insert({
      id: template.id,
      name: template.name,
      description: template.description,
      industry_type: template.industryType,
      applicable_standards: template.applicableStandards,
      accounts: template.accounts,
      metadata: template.metadata,
      organization_id: organizationId,
      created_by: userId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create template: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    data: { template: data },
  });
}

async function handleValidateClassification(body: any) {
  const { account } = body;

  if (!account) {
    return NextResponse.json({ error: 'Account data required' }, { status: 400 });
  }

  const validation = accountClassificationEngine.validateAccountClassification(account);

  return NextResponse.json({
    success: true,
    data: { validation },
  });
}

async function handleUpdateAccount(
  supabase: any,
  accountId: string,
  updates: Partial<AccountMapping>,
  organizationId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('account_mappings')
    .update({
      ...updates,
      last_updated: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', accountId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update account: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    data: { account: data },
  });
}

async function handleDeleteAccount(supabase: any, accountId: string, organizationId: string) {
  const { error } = await supabase
    .from('account_mappings')
    .update({ is_active: false })
    .eq('id', accountId)
    .eq('organization_id', organizationId);

  if (error) {
    throw new Error(`Failed to delete account: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    message: 'Account deactivated successfully',
  });
}
