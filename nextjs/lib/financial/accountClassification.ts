/**
 * Account Classification and Mapping System
 * Provides comprehensive chart of accounts management with IFRS/GAAP mapping
 */

export interface AccountMapping {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  accountSubtype: string;
  category: string;
  subcategory?: string;
  isCurrentAccount: boolean;
  normalBalance: 'debit' | 'credit';
  financialStatementSection: string;
  ifrsMapping?: {
    standard: string;
    section: string;
    subsection?: string;
    presentationOrder: number;
    disclosureRequired: boolean;
  };
  gaapMapping?: {
    category: string;
    subcategory: string;
    presentationOrder: number;
    regulatoryRequirement?: string;
  };
  frsMapping?: {
    standard: string;
    section: string;
    presentationOrder: number;
    nigerianSpecific: boolean;
  };
  taxAttributes?: {
    isVatApplicable: boolean;
    whtCategory?: string;
    citDeductible: boolean;
    allowableExpense: boolean;
  };
  auditAttributes: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    significanceThreshold: number;
    typicalTestingProcedures: string[];
    commonMisstatements: string[];
    keyAssertions: string[];
  };
  complianceRequirements: string[];
  isActive: boolean;
  createdBy: string;
  organizationId: string;
  lastUpdated: string;
}

export interface ChartOfAccountsTemplate {
  id: string;
  name: string;
  description: string;
  industryType: string;
  applicableStandards: ('IFRS' | 'GAAP' | 'FRS')[];
  accounts: AccountMapping[];
  metadata: {
    version: string;
    createdDate: string;
    lastUpdated: string;
    totalAccounts: number;
    complianceLevel: string;
  };
}

export interface AutoCategorizationRule {
  id: string;
  ruleName: string;
  priority: number;
  conditions: {
    field: keyof AccountMapping;
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
    value: string | number | boolean;
  }[];
  actions: {
    field: keyof AccountMapping;
    value: any;
  }[];
  isActive: boolean;
}

/**
 * Account Classification Engine
 */
export class AccountClassificationEngine {
  private templates: Map<string, ChartOfAccountsTemplate> = new Map();
  private categorizationRules: AutoCategorizationRule[] = [];

  constructor() {
    this.loadDefaultTemplates();
    this.loadDefaultCategorizationRules();
  }

  /**
   * Automatically categorize an account based on rules
   */
  categorizeAccount(
    accountCode: string,
    accountName: string,
    existingData?: Partial<AccountMapping>
  ): Partial<AccountMapping> {
    const account: Partial<AccountMapping> = {
      accountCode,
      accountName,
      ...existingData,
    };

    // Apply categorization rules in priority order
    const sortedRules = this.categorizationRules
      .filter((rule) => rule.isActive)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (this.evaluateConditions(account, rule.conditions)) {
        // Apply rule actions
        for (const action of rule.actions) {
          (account as any)[action.field] = action.value;
        }
      }
    }

    // Apply intelligent defaults if not set
    this.applyIntelligentDefaults(account);

    return account;
  }

  /**
   * Get standardized account mapping for a given standard
   */
  getStandardMapping(accountCode: string, standard: 'IFRS' | 'GAAP' | 'FRS'): any {
    const mappings = {
      IFRS: this.getIFRSMapping(accountCode),
      GAAP: this.getGAAPMapping(accountCode),
      FRS: this.getFRSMapping(accountCode),
    };

    return mappings[standard];
  }

  /**
   * Generate chart of accounts for specific industry and standard
   */
  generateChartOfAccounts(
    industryType: string,
    standard: 'IFRS' | 'GAAP' | 'FRS',
    organizationId: string
  ): ChartOfAccountsTemplate {
    const templateKey = `${industryType}_${standard}`;
    const baseTemplate = this.templates.get(templateKey);

    if (!baseTemplate) {
      throw new Error(`Template not found for ${industryType} under ${standard}`);
    }

    // Customize template for organization
    const customizedTemplate: ChartOfAccountsTemplate = {
      ...baseTemplate,
      id: `${templateKey}_${organizationId}_${Date.now()}`,
      accounts: baseTemplate.accounts.map((account) => ({
        ...account,
        id: `${account.accountCode}_${organizationId}`,
        organizationId,
        lastUpdated: new Date().toISOString(),
        createdBy: 'system',
      })),
    };

    return customizedTemplate;
  }

  /**
   * Validate account classification completeness
   */
  validateAccountClassification(account: AccountMapping): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    completenessScore: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let completenessScore = 0;
    const totalFields = 15; // Total required fields for completeness

    // Required field validation
    if (!account.accountCode) errors.push('Account code is required');
    else completenessScore++;

    if (!account.accountName) errors.push('Account name is required');
    else completenessScore++;

    if (!account.accountType) errors.push('Account type is required');
    else completenessScore++;

    if (!account.normalBalance) errors.push('Normal balance is required');
    else completenessScore++;

    if (!account.financialStatementSection) errors.push('Financial statement section is required');
    else completenessScore++;

    // Optional but recommended fields
    if (account.ifrsMapping) completenessScore++;
    if (account.gaapMapping) completenessScore++;
    if (account.frsMapping) completenessScore++;
    if (account.taxAttributes) completenessScore++;
    if (account.auditAttributes) completenessScore++;

    // Business logic validation
    if (account.accountType === 'asset' || account.accountType === 'expense') {
      if (account.normalBalance !== 'debit') {
        warnings.push('Assets and expenses typically have debit normal balance');
      }
    }

    if (
      account.accountType === 'liability' ||
      account.accountType === 'equity' ||
      account.accountType === 'revenue'
    ) {
      if (account.normalBalance !== 'credit') {
        warnings.push('Liabilities, equity, and revenue typically have credit normal balance');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completenessScore: Math.round((completenessScore / totalFields) * 100),
    };
  }

  /**
   * Bulk import and categorize accounts
   */
  async bulkImportAccounts(
    accounts: { accountCode: string; accountName: string; balance?: number }[],
    organizationId: string
  ): Promise<{
    successful: AccountMapping[];
    failed: { account: any; errors: string[] }[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      warnings: number;
    };
  }> {
    const successful: AccountMapping[] = [];
    const failed: { account: any; errors: string[] }[] = [];
    let warningCount = 0;

    for (const inputAccount of accounts) {
      try {
        // Auto-categorize the account
        const categorizedAccount = this.categorizeAccount(
          inputAccount.accountCode,
          inputAccount.accountName
        );

        // Create full account mapping
        const fullAccount: AccountMapping = {
          id: `${inputAccount.accountCode}_${organizationId}`,
          organizationId,
          createdBy: 'bulk_import',
          lastUpdated: new Date().toISOString(),
          isActive: true,
          complianceRequirements: [],
          auditAttributes: {
            riskLevel: 'medium',
            significanceThreshold: 0.05,
            typicalTestingProcedures: [],
            commonMisstatements: [],
            keyAssertions: [],
          },
          ...categorizedAccount,
        } as AccountMapping;

        // Validate the account
        const validation = this.validateAccountClassification(fullAccount);

        if (validation.isValid) {
          successful.push(fullAccount);
          if (validation.warnings.length > 0) {
            warningCount++;
          }
        } else {
          failed.push({
            account: inputAccount,
            errors: validation.errors,
          });
        }
      } catch (error) {
        failed.push({
          account: inputAccount,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        });
      }
    }

    return {
      successful,
      failed,
      summary: {
        total: accounts.length,
        successful: successful.length,
        failed: failed.length,
        warnings: warningCount,
      },
    };
  }

  /**
   * Get account classification analytics
   */
  getClassificationAnalytics(accounts: AccountMapping[]): {
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    byRiskLevel: Record<string, number>;
    byStandard: {
      ifrs: number;
      gaap: number;
      frs: number;
    };
    completenessDistribution: Record<string, number>;
    recommendedActions: string[];
  } {
    const analytics = {
      byType: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      byRiskLevel: {} as Record<string, number>,
      byStandard: { ifrs: 0, gaap: 0, frs: 0 },
      completenessDistribution: {} as Record<string, number>,
      recommendedActions: [] as string[],
    };

    accounts.forEach((account) => {
      // Count by type
      analytics.byType[account.accountType] = (analytics.byType[account.accountType] || 0) + 1;

      // Count by category
      analytics.byCategory[account.category] = (analytics.byCategory[account.category] || 0) + 1;

      // Count by risk level
      if (account.auditAttributes) {
        analytics.byRiskLevel[account.auditAttributes.riskLevel] =
          (analytics.byRiskLevel[account.auditAttributes.riskLevel] || 0) + 1;
      }

      // Count by standard
      if (account.ifrsMapping) analytics.byStandard.ifrs++;
      if (account.gaapMapping) analytics.byStandard.gaap++;
      if (account.frsMapping) analytics.byStandard.frs++;

      // Completeness scoring
      const validation = this.validateAccountClassification(account);
      const scoreRange = Math.floor(validation.completenessScore / 20) * 20;
      const key = `${scoreRange}-${scoreRange + 19}%`;
      analytics.completenessDistribution[key] = (analytics.completenessDistribution[key] || 0) + 1;
    });

    // Generate recommendations
    if (analytics.byRiskLevel?.critical && analytics.byRiskLevel?.critical > 0) {
      analytics.recommendedActions.push('Review critical risk accounts for enhanced controls');
    }
    if (analytics.byStandard.frs < accounts.length * 0.5) {
      analytics.recommendedActions.push('Consider adding FRS mapping for Nigerian compliance');
    }

    return analytics;
  }

  /**
   * Private helper methods
   */
  private evaluateConditions(
    account: Partial<AccountMapping>,
    conditions: AutoCategorizationRule['conditions']
  ): boolean {
    return conditions.every((condition) => {
      const fieldValue = account[condition.field];
      const targetValue = condition.value;

      switch (condition.operator) {
        case 'equals':
          return fieldValue === targetValue;
        case 'contains':
          return (
            typeof fieldValue === 'string' &&
            fieldValue.toLowerCase().includes(targetValue.toString().toLowerCase())
          );
        case 'startsWith':
          return (
            typeof fieldValue === 'string' &&
            fieldValue.toLowerCase().startsWith(targetValue.toString().toLowerCase())
          );
        case 'endsWith':
          return (
            typeof fieldValue === 'string' &&
            fieldValue.toLowerCase().endsWith(targetValue.toString().toLowerCase())
          );
        case 'regex':
          return (
            typeof fieldValue === 'string' && new RegExp(targetValue.toString()).test(fieldValue)
          );
        default:
          return false;
      }
    });
  }

  private applyIntelligentDefaults(account: Partial<AccountMapping>): void {
    if (!account.accountType && account.accountCode) {
      // Intelligent type detection based on account code patterns
      const code = account.accountCode.toLowerCase();
      if (code.startsWith('1') || code.includes('asset')) {
        account.accountType = 'asset';
      } else if (code.startsWith('2') || code.includes('liabilit')) {
        account.accountType = 'liability';
      } else if (code.startsWith('3') || code.includes('equity')) {
        account.accountType = 'equity';
      } else if (code.startsWith('4') || code.includes('revenue') || code.includes('income')) {
        account.accountType = 'revenue';
      } else if (code.startsWith('5') || code.includes('expense') || code.includes('cost')) {
        account.accountType = 'expense';
      }
    }

    if (!account.normalBalance && account.accountType) {
      account.normalBalance = ['asset', 'expense'].includes(account.accountType)
        ? 'debit'
        : 'credit';
    }

    if (!account.isCurrentAccount && account.accountType) {
      account.isCurrentAccount =
        account.accountType === 'asset' || account.accountType === 'liability';
    }
  }

  private getIFRSMapping(accountCode: string): AccountMapping['ifrsMapping'] {
    // IFRS mapping logic based on account patterns
    const mappings: Record<string, AccountMapping['ifrsMapping']> = {
      cash: {
        standard: 'IAS 7',
        section: 'Cash and Cash Equivalents',
        presentationOrder: 1,
        disclosureRequired: true,
      },
      receivable: {
        standard: 'IFRS 9',
        section: 'Financial Assets',
        subsection: 'Trade Receivables',
        presentationOrder: 3,
        disclosureRequired: true,
      },
      inventory: {
        standard: 'IAS 2',
        section: 'Inventories',
        presentationOrder: 4,
        disclosureRequired: true,
      },
      ppe: {
        standard: 'IAS 16',
        section: 'Property, Plant and Equipment',
        presentationOrder: 10,
        disclosureRequired: true,
      },
    };

    const key = Object.keys(mappings).find((k) => accountCode.toLowerCase().includes(k));

    return key ? mappings[key] : undefined;
  }

  private getGAAPMapping(accountCode: string): AccountMapping['gaapMapping'] {
    // US GAAP mapping logic
    return {
      category: 'Current Assets',
      subcategory: 'Cash and Cash Equivalents',
      presentationOrder: 1,
      regulatoryRequirement: 'SEC 10-K',
    };
  }

  private getFRSMapping(accountCode: string): AccountMapping['frsMapping'] {
    // Nigerian FRS mapping logic
    return {
      standard: 'FRS 102',
      section: 'Basic Financial Instruments',
      presentationOrder: 1,
      nigerianSpecific: true,
    };
  }

  private loadDefaultTemplates(): void {
    // Load industry-specific templates (implementation would fetch from database)
    const tradingTemplate: ChartOfAccountsTemplate = {
      id: 'trading_ifrs_template',
      name: 'Trading Company - IFRS',
      description: 'Standard chart of accounts for trading companies under IFRS',
      industryType: 'trading',
      applicableStandards: ['IFRS'],
      accounts: [], // Would be populated with full account list
      metadata: {
        version: '1.0',
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        totalAccounts: 0,
        complianceLevel: 'Full',
      },
    };

    this.templates.set('trading_IFRS', tradingTemplate);
  }

  private loadDefaultCategorizationRules(): void {
    this.categorizationRules = [
      {
        id: 'cash_accounts',
        ruleName: 'Cash and Bank Accounts',
        priority: 100,
        conditions: [
          { field: 'accountName', operator: 'contains', value: 'cash' },
          { field: 'accountName', operator: 'contains', value: 'bank' },
        ],
        actions: [
          { field: 'accountType', value: 'asset' },
          { field: 'category', value: 'Current Assets' },
          { field: 'subcategory', value: 'Cash and Cash Equivalents' },
          { field: 'isCurrentAccount', value: true },
          { field: 'financialStatementSection', value: 'Balance Sheet - Assets' },
        ],
        isActive: true,
      },
      {
        id: 'revenue_accounts',
        ruleName: 'Revenue Recognition',
        priority: 90,
        conditions: [
          { field: 'accountName', operator: 'contains', value: 'revenue' },
          { field: 'accountName', operator: 'contains', value: 'sales' },
          { field: 'accountName', operator: 'contains', value: 'income' },
        ],
        actions: [
          { field: 'accountType', value: 'revenue' },
          { field: 'category', value: 'Revenue' },
          { field: 'financialStatementSection', value: 'Income Statement - Revenue' },
        ],
        isActive: true,
      },
      // Additional rules would be defined here
    ];
  }
}

/**
 * Export singleton instance
 */
export const accountClassificationEngine = new AccountClassificationEngine();

/**
 * Utility functions for account classification
 */
export function classifyAccountsByType(
  accounts: AccountMapping[]
): Record<string, AccountMapping[]> {
  return accounts.reduce(
    (acc, account) => {
      (acc[account.accountType] = acc[account.accountType] || []).push(account);
      return acc;
    },
    {} as Record<string, AccountMapping[]>
  );
}

export function findDuplicateAccounts(accounts: AccountMapping[]): AccountMapping[][] {
  const duplicates: AccountMapping[][] = [];
  const seen = new Map<string, AccountMapping[]>();

  accounts.forEach((account) => {
    if (seen.has(account.accountCode)) {
      seen.get(account.accountCode)!.push(account);
    } else {
      seen.set(account.accountCode, [account]);
    }
  });

  seen.forEach((group) => {
    if (group.length > 1) {
      duplicates.push(group);
    }
  });

  return duplicates;
}

export function generateAccountHierarchy(accounts: AccountMapping[]): {
  assets: AccountMapping[];
  liabilities: AccountMapping[];
  equity: AccountMapping[];
  revenue: AccountMapping[];
  expenses: AccountMapping[];
} {
  return {
    assets: accounts.filter((a) => a.accountType === 'asset'),
    liabilities: accounts.filter((a) => a.accountType === 'liability'),
    equity: accounts.filter((a) => a.accountType === 'equity'),
    revenue: accounts.filter((a) => a.accountType === 'revenue'),
    expenses: accounts.filter((a) => a.accountType === 'expense'),
  };
}
