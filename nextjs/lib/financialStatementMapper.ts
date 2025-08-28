/**
 * Financial Statement Mapper
 * Maps trial balance data to standardized financial statements
 */

export interface TrialBalanceEntry {
  accountCode: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  accountCategory: string;
  accountSubcategory?: string;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
  balanceSheetSection?: string;
  incomeStatementSection?: string;
  cashFlowSection?: string;
}

export interface FinancialStatementLineItem {
  code: string;
  name: string;
  amount: number;
  parentCode?: string;
  level: number;
  isTotal: boolean;
  isSubtotal: boolean;
  accounts: string[]; // Account codes that make up this line item
}

export interface BalanceSheet {
  assets: {
    currentAssets: FinancialStatementLineItem[];
    nonCurrentAssets: FinancialStatementLineItem[];
    totalAssets: FinancialStatementLineItem;
  };
  liabilities: {
    currentLiabilities: FinancialStatementLineItem[];
    nonCurrentLiabilities: FinancialStatementLineItem[];
    totalLiabilities: FinancialStatementLineItem;
  };
  equity: {
    equityItems: FinancialStatementLineItem[];
    totalEquity: FinancialStatementLineItem;
  };
  totalLiabilitiesAndEquity: FinancialStatementLineItem;
}

export interface IncomeStatement {
  revenue: {
    revenueItems: FinancialStatementLineItem[];
    totalRevenue: FinancialStatementLineItem;
  };
  costOfSales: {
    costItems: FinancialStatementLineItem[];
    totalCostOfSales: FinancialStatementLineItem;
  };
  grossProfit: FinancialStatementLineItem;
  operatingExpenses: {
    expenseItems: FinancialStatementLineItem[];
    totalOperatingExpenses: FinancialStatementLineItem;
  };
  operatingIncome: FinancialStatementLineItem;
  otherIncomeExpenses: {
    otherItems: FinancialStatementLineItem[];
    totalOtherIncomeExpenses: FinancialStatementLineItem;
  };
  netIncome: FinancialStatementLineItem;
}

export interface CashFlowStatement {
  operatingActivities: {
    netIncome: FinancialStatementLineItem;
    adjustments: FinancialStatementLineItem[];
    workingCapitalChanges: FinancialStatementLineItem[];
    netCashFromOperating: FinancialStatementLineItem;
  };
  investingActivities: {
    investingItems: FinancialStatementLineItem[];
    netCashFromInvesting: FinancialStatementLineItem;
  };
  financingActivities: {
    financingItems: FinancialStatementLineItem[];
    netCashFromFinancing: FinancialStatementLineItem;
  };
  netChangeInCash: FinancialStatementLineItem;
  cashBeginning: FinancialStatementLineItem;
  cashEnding: FinancialStatementLineItem;
}

export interface FinancialStatements {
  balanceSheet: BalanceSheet;
  incomeStatement: IncomeStatement;
  cashFlowStatement: CashFlowStatement;
  metadata: {
    companyName?: string;
    reportingPeriodStart: string;
    reportingPeriodEnd: string;
    presentationCurrency: string;
    accountingStandard: 'IFRS' | 'GAAP' | 'FRS';
    generatedAt: string;
  };
}

/**
 * Generate complete financial statements from trial balance
 */
export function generateFinancialStatements(
  trialBalance: TrialBalanceEntry[],
  metadata: {
    companyName?: string;
    reportingPeriodStart: string;
    reportingPeriodEnd: string;
    presentationCurrency?: string;
    accountingStandard?: 'IFRS' | 'GAAP' | 'FRS';
  }
): FinancialStatements {
  const balanceSheet = generateBalanceSheet(trialBalance);
  const incomeStatement = generateIncomeStatement(trialBalance);
  const cashFlowStatement = generateCashFlowStatement(trialBalance, incomeStatement);

  return {
    balanceSheet,
    incomeStatement,
    cashFlowStatement,
    metadata: {
      companyName: metadata.companyName,
      reportingPeriodStart: metadata.reportingPeriodStart,
      reportingPeriodEnd: metadata.reportingPeriodEnd,
      presentationCurrency: metadata.presentationCurrency || 'NGN',
      accountingStandard: metadata.accountingStandard || 'IFRS',
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Generate Balance Sheet from trial balance
 */
export function generateBalanceSheet(trialBalance: TrialBalanceEntry[]): BalanceSheet {
  const assets = trialBalance.filter((entry) => entry.accountType === 'asset');
  const liabilities = trialBalance.filter((entry) => entry.accountType === 'liability');
  const equity = trialBalance.filter((entry) => entry.accountType === 'equity');

  // Current Assets
  const currentAssets = mapAccountsToLineItems(
    assets.filter((a) => isCurrentAsset(a)),
    'CURR_ASSETS'
  );

  // Non-Current Assets
  const nonCurrentAssets = mapAccountsToLineItems(
    assets.filter((a) => !isCurrentAsset(a)),
    'NON_CURR_ASSETS'
  );

  // Total Assets
  const totalAssetsAmount = assets.reduce((sum, a) => sum + a.netBalance, 0);
  const totalAssets: FinancialStatementLineItem = {
    code: 'TOTAL_ASSETS',
    name: 'Total Assets',
    amount: totalAssetsAmount,
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: assets.map((a) => a.accountCode),
  };

  // Current Liabilities
  const currentLiabilities = mapAccountsToLineItems(
    liabilities.filter((l) => isCurrentLiability(l)),
    'CURR_LIAB'
  );

  // Non-Current Liabilities
  const nonCurrentLiabilities = mapAccountsToLineItems(
    liabilities.filter((l) => !isCurrentLiability(l)),
    'NON_CURR_LIAB'
  );

  // Total Liabilities
  const totalLiabilitiesAmount = liabilities.reduce((sum, l) => sum + Math.abs(l.netBalance), 0);
  const totalLiabilities: FinancialStatementLineItem = {
    code: 'TOTAL_LIAB',
    name: 'Total Liabilities',
    amount: totalLiabilitiesAmount,
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: liabilities.map((l) => l.accountCode),
  };

  // Equity Items
  const equityItems = mapAccountsToLineItems(equity, 'EQUITY');

  // Total Equity
  const totalEquityAmount = equity.reduce((sum, e) => sum + Math.abs(e.netBalance), 0);
  const totalEquity: FinancialStatementLineItem = {
    code: 'TOTAL_EQUITY',
    name: 'Total Equity',
    amount: totalEquityAmount,
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: equity.map((e) => e.accountCode),
  };

  // Total Liabilities and Equity
  const totalLiabilitiesAndEquity: FinancialStatementLineItem = {
    code: 'TOTAL_LIAB_EQUITY',
    name: 'Total Liabilities and Equity',
    amount: totalLiabilitiesAmount + totalEquityAmount,
    level: 0,
    isTotal: true,
    isSubtotal: false,
    accounts: [...liabilities.map((l) => l.accountCode), ...equity.map((e) => e.accountCode)],
  };

  return {
    assets: {
      currentAssets,
      nonCurrentAssets,
      totalAssets,
    },
    liabilities: {
      currentLiabilities,
      nonCurrentLiabilities,
      totalLiabilities,
    },
    equity: {
      equityItems,
      totalEquity,
    },
    totalLiabilitiesAndEquity,
  };
}

/**
 * Generate Income Statement from trial balance
 */
export function generateIncomeStatement(trialBalance: TrialBalanceEntry[]): IncomeStatement {
  const revenue = trialBalance.filter((entry) => entry.accountType === 'revenue');
  const expenses = trialBalance.filter((entry) => entry.accountType === 'expense');

  // Revenue Items
  const revenueItems = mapAccountsToLineItems(revenue, 'REVENUE');
  const totalRevenueAmount = revenue.reduce((sum, r) => sum + Math.abs(r.netBalance), 0);
  const totalRevenue: FinancialStatementLineItem = {
    code: 'TOTAL_REVENUE',
    name: 'Total Revenue',
    amount: totalRevenueAmount,
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: revenue.map((r) => r.accountCode),
  };

  // Cost of Sales
  const costOfSalesAccounts = expenses.filter((e) => isCostOfSales(e));
  const costItems = mapAccountsToLineItems(costOfSalesAccounts, 'COGS');
  const totalCostOfSalesAmount = costOfSalesAccounts.reduce((sum, c) => sum + c.netBalance, 0);
  const totalCostOfSales: FinancialStatementLineItem = {
    code: 'TOTAL_COGS',
    name: 'Total Cost of Sales',
    amount: totalCostOfSalesAmount,
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: costOfSalesAccounts.map((c) => c.accountCode),
  };

  // Gross Profit
  const grossProfit: FinancialStatementLineItem = {
    code: 'GROSS_PROFIT',
    name: 'Gross Profit',
    amount: totalRevenueAmount - totalCostOfSalesAmount,
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: [],
  };

  // Operating Expenses
  const operatingExpensesAccounts = expenses.filter((e) => !isCostOfSales(e) && !isOtherExpense(e));
  const expenseItems = mapAccountsToLineItems(operatingExpensesAccounts, 'OP_EXP');
  const totalOperatingExpensesAmount = operatingExpensesAccounts.reduce(
    (sum, e) => sum + e.netBalance,
    0
  );
  const totalOperatingExpenses: FinancialStatementLineItem = {
    code: 'TOTAL_OP_EXP',
    name: 'Total Operating Expenses',
    amount: totalOperatingExpensesAmount,
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: operatingExpensesAccounts.map((e) => e.accountCode),
  };

  // Operating Income
  const operatingIncome: FinancialStatementLineItem = {
    code: 'OPERATING_INCOME',
    name: 'Operating Income',
    amount: grossProfit.amount - totalOperatingExpensesAmount,
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: [],
  };

  // Other Income/Expenses
  const otherAccounts = expenses.filter((e) => isOtherExpense(e));
  const otherItems = mapAccountsToLineItems(otherAccounts, 'OTHER');
  const totalOtherAmount = otherAccounts.reduce((sum, o) => sum + o.netBalance, 0);
  const totalOtherIncomeExpenses: FinancialStatementLineItem = {
    code: 'TOTAL_OTHER',
    name: 'Total Other Income (Expenses)',
    amount: totalOtherAmount,
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: otherAccounts.map((o) => o.accountCode),
  };

  // Net Income
  const netIncome: FinancialStatementLineItem = {
    code: 'NET_INCOME',
    name: 'Net Income',
    amount: operatingIncome.amount - Math.abs(totalOtherAmount),
    level: 0,
    isTotal: true,
    isSubtotal: false,
    accounts: [],
  };

  return {
    revenue: {
      revenueItems,
      totalRevenue,
    },
    costOfSales: {
      costItems,
      totalCostOfSales,
    },
    grossProfit,
    operatingExpenses: {
      expenseItems,
      totalOperatingExpenses,
    },
    operatingIncome,
    otherIncomeExpenses: {
      otherItems,
      totalOtherIncomeExpenses,
    },
    netIncome,
  };
}

/**
 * Generate Cash Flow Statement (basic indirect method)
 */
export function generateCashFlowStatement(
  trialBalance: TrialBalanceEntry[],
  incomeStatement: IncomeStatement
): CashFlowStatement {
  // This is a simplified cash flow statement
  // In practice, you would need additional data for proper cash flow analysis

  const netIncome: FinancialStatementLineItem = {
    code: 'CF_NET_INCOME',
    name: 'Net Income',
    amount: incomeStatement.netIncome.amount,
    level: 2,
    isTotal: false,
    isSubtotal: false,
    accounts: [],
  };

  // Simplified adjustments (would need more data for full implementation)
  const adjustments: FinancialStatementLineItem[] = [];

  // Working capital changes (simplified)
  const workingCapitalChanges: FinancialStatementLineItem[] = [];

  const netCashFromOperating: FinancialStatementLineItem = {
    code: 'NET_CASH_OPERATING',
    name: 'Net Cash from Operating Activities',
    amount: netIncome.amount, // Simplified
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: [],
  };

  // Investing activities (simplified)
  const investingItems: FinancialStatementLineItem[] = [];
  const netCashFromInvesting: FinancialStatementLineItem = {
    code: 'NET_CASH_INVESTING',
    name: 'Net Cash from Investing Activities',
    amount: 0, // Simplified
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: [],
  };

  // Financing activities (simplified)
  const financingItems: FinancialStatementLineItem[] = [];
  const netCashFromFinancing: FinancialStatementLineItem = {
    code: 'NET_CASH_FINANCING',
    name: 'Net Cash from Financing Activities',
    amount: 0, // Simplified
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: [],
  };

  const netChangeInCash: FinancialStatementLineItem = {
    code: 'NET_CHANGE_CASH',
    name: 'Net Change in Cash',
    amount: netCashFromOperating.amount + netCashFromInvesting.amount + netCashFromFinancing.amount,
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: [],
  };

  // Cash balances (would need beginning balance data)
  const cashBeginning: FinancialStatementLineItem = {
    code: 'CASH_BEGINNING',
    name: 'Cash at Beginning of Period',
    amount: 0, // Would need historical data
    level: 2,
    isTotal: false,
    isSubtotal: false,
    accounts: [],
  };

  const cashEnding: FinancialStatementLineItem = {
    code: 'CASH_ENDING',
    name: 'Cash at End of Period',
    amount: cashBeginning.amount + netChangeInCash.amount,
    level: 1,
    isTotal: true,
    isSubtotal: false,
    accounts: [],
  };

  return {
    operatingActivities: {
      netIncome,
      adjustments,
      workingCapitalChanges,
      netCashFromOperating,
    },
    investingActivities: {
      investingItems,
      netCashFromInvesting,
    },
    financingActivities: {
      financingItems,
      netCashFromFinancing,
    },
    netChangeInCash,
    cashBeginning,
    cashEnding,
  };
}

/**
 * Map trial balance accounts to line items
 */
function mapAccountsToLineItems(
  accounts: TrialBalanceEntry[],
  prefix: string
): FinancialStatementLineItem[] {
  return accounts.map((account, index) => ({
    code: `${prefix}_${account.accountCode}`,
    name: account.accountName,
    amount: Math.abs(account.netBalance),
    level: 2,
    isTotal: false,
    isSubtotal: false,
    accounts: [account.accountCode],
  }));
}

/**
 * Classification helper functions
 */
function isCurrentAsset(account: TrialBalanceEntry): boolean {
  const category = account.accountCategory?.toLowerCase() || '';
  const name = account.accountName.toLowerCase();

  return (
    category.includes('current') ||
    name.includes('cash') ||
    name.includes('bank') ||
    name.includes('receivable') ||
    name.includes('inventory') ||
    name.includes('prepaid') ||
    name.includes('short term')
  );
}

function isCurrentLiability(account: TrialBalanceEntry): boolean {
  const category = account.accountCategory?.toLowerCase() || '';
  const name = account.accountName.toLowerCase();

  return (
    category.includes('current') ||
    name.includes('payable') ||
    name.includes('accrued') ||
    name.includes('short term') ||
    name.includes('tax payable')
  );
}

function isCostOfSales(account: TrialBalanceEntry): boolean {
  const name = account.accountName.toLowerCase();
  const category = account.accountCategory?.toLowerCase() || '';

  return (
    name.includes('cost of goods') ||
    name.includes('cost of sales') ||
    name.includes('cogs') ||
    name.includes('cost of revenue') ||
    category.includes('cost of goods') ||
    category.includes('cost of sales')
  );
}

function isOtherExpense(account: TrialBalanceEntry): boolean {
  const name = account.accountName.toLowerCase();

  return (
    name.includes('interest expense') ||
    name.includes('finance cost') ||
    name.includes('other expense') ||
    name.includes('non-operating') ||
    name.includes('extraordinary')
  );
}

/**
 * Generate financial statement templates for different standards
 */
export function getFinancialStatementTemplate(standard: 'IFRS' | 'GAAP' | 'FRS' = 'IFRS') {
  const templates = {
    IFRS: {
      balanceSheet: {
        assets: ['Current Assets', 'Non-current Assets', 'Total Assets'],
        liabilities: ['Current Liabilities', 'Non-current Liabilities', 'Total Liabilities'],
        equity: ['Share Capital', 'Retained Earnings', 'Other Reserves', 'Total Equity'],
      },
      incomeStatement: [
        'Revenue',
        'Cost of Sales',
        'Gross Profit',
        'Operating Expenses',
        'Operating Profit',
        'Finance Costs',
        'Profit Before Tax',
        'Tax Expense',
        'Profit for the Period',
      ],
    },
    GAAP: {
      balanceSheet: {
        assets: ['Current Assets', 'Property, Plant and Equipment', 'Other Assets', 'Total Assets'],
        liabilities: ['Current Liabilities', 'Long-term Liabilities', 'Total Liabilities'],
        equity: ['Common Stock', 'Retained Earnings', "Total Stockholders' Equity"],
      },
      incomeStatement: [
        'Net Sales',
        'Cost of Goods Sold',
        'Gross Profit',
        'Operating Expenses',
        'Operating Income',
        'Other Income (Expense)',
        'Income Before Taxes',
        'Income Tax Expense',
        'Net Income',
      ],
    },
    FRS: {
      balanceSheet: {
        assets: ['Current Assets', 'Non-current Assets', 'Total Assets'],
        liabilities: ['Current Liabilities', 'Non-current Liabilities', 'Total Liabilities'],
        equity: ['Share Capital', 'Reserves', 'Retained Earnings', 'Total Equity'],
      },
      incomeStatement: [
        'Turnover',
        'Cost of Sales',
        'Gross Profit',
        'Administrative Expenses',
        'Operating Profit',
        'Interest Payable',
        'Profit Before Taxation',
        'Taxation',
        'Profit After Taxation',
      ],
    },
  };

  return templates[standard] || templates.IFRS;
}

/**
 * Validate financial statement balancing
 */
export function validateFinancialStatements(statements: FinancialStatements): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Balance Sheet validation
  const totalAssets = statements.balanceSheet.assets.totalAssets.amount;
  const totalLiabilitiesAndEquity = statements.balanceSheet.totalLiabilitiesAndEquity.amount;

  if (Math.abs(totalAssets - totalLiabilitiesAndEquity) > 0.01) {
    errors.push('Balance Sheet does not balance: Assets ≠ Liabilities + Equity');
  }

  // Income Statement validation
  const grossProfit = statements.incomeStatement.grossProfit.amount;
  const calculatedGrossProfit =
    statements.incomeStatement.revenue.totalRevenue.amount -
    statements.incomeStatement.costOfSales.totalCostOfSales.amount;

  if (Math.abs(grossProfit - calculatedGrossProfit) > 0.01) {
    warnings.push('Gross Profit calculation may be incorrect');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
