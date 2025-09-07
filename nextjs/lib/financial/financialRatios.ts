/**
 * Financial Ratio Calculation Library
 * Implements comprehensive financial ratio calculations for audit analysis
 */

export interface TrialBalanceData {
  accountCode: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  accountCategory: string;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
}

export interface FinancialRatio {
  category: 'liquidity' | 'profitability' | 'leverage' | 'efficiency' | 'market';
  name: string;
  formula: string;
  value: number;
  numerator: number;
  denominator: number;
  interpretation: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  industryBenchmark?: number;
  analysisNotes: string;
}

export interface FinancialData {
  // Balance Sheet Items
  currentAssets: number;
  totalAssets: number;
  currentLiabilities: number;
  totalLiabilities: number;
  totalEquity: number;
  inventory: number;
  accountsReceivable: number;
  cash: number;
  longTermDebt: number;

  // Income Statement Items
  revenue: number;
  grossProfit: number;
  netIncome: number;
  operatingIncome: number;
  interestExpense: number;
  costOfGoodsSold: number;
  operatingExpenses: number;

  // Additional Items
  marketValueOfEquity?: number;
  numberOfShares?: number;
  averageInventory?: number;
  averageAccountsReceivable?: number;
  averageTotalAssets?: number;
}

/**
 * Extract financial data from trial balance
 */
export function extractFinancialData(trialBalance: TrialBalanceData[]): FinancialData {
  const data: FinancialData = {
    currentAssets: 0,
    totalAssets: 0,
    currentLiabilities: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    inventory: 0,
    accountsReceivable: 0,
    cash: 0,
    longTermDebt: 0,
    revenue: 0,
    grossProfit: 0,
    netIncome: 0,
    operatingIncome: 0,
    interestExpense: 0,
    costOfGoodsSold: 0,
    operatingExpenses: 0,
  };

  for (const account of trialBalance) {
    const balance = account.netBalance;
    const category = account.accountCategory?.toLowerCase();
    const name = account.accountName.toLowerCase();

    // Assets
    if (account.accountType === 'asset') {
      data.totalAssets += balance;

      if (
        category?.includes('current') ||
        name.includes('cash') ||
        name.includes('receivable') ||
        name.includes('inventory') ||
        name.includes('prepaid')
      ) {
        data.currentAssets += balance;
      }

      if (name.includes('cash') || name.includes('bank')) {
        data.cash += balance;
      }

      if (name.includes('receivable') || name.includes('debtors')) {
        data.accountsReceivable += balance;
      }

      if (name.includes('inventory') || name.includes('stock')) {
        data.inventory += balance;
      }
    }

    // Liabilities
    if (account.accountType === 'liability') {
      data.totalLiabilities += balance;

      if (
        category?.includes('current') ||
        name.includes('payable') ||
        name.includes('accrued') ||
        name.includes('short term')
      ) {
        data.currentLiabilities += balance;
      }

      if (
        category?.includes('long term') ||
        name.includes('long term') ||
        name.includes('loan') ||
        name.includes('bond')
      ) {
        data.longTermDebt += balance;
      }
    }

    // Equity
    if (account.accountType === 'equity') {
      data.totalEquity += balance;
    }

    // Revenue
    if (account.accountType === 'revenue') {
      data.revenue += balance;
    }

    // Expenses
    if (account.accountType === 'expense') {
      if (
        name.includes('cost of goods') ||
        name.includes('cost of sales') ||
        name.includes('cogs')
      ) {
        data.costOfGoodsSold += balance;
      } else if (name.includes('interest')) {
        data.interestExpense += balance;
      } else {
        data.operatingExpenses += balance;
      }
    }
  }

  // Calculate derived values
  data.grossProfit = data.revenue - data.costOfGoodsSold;
  data.operatingIncome = data.grossProfit - data.operatingExpenses;
  data.netIncome = data.operatingIncome - data.interestExpense;

  return data;
}

/**
 * Calculate liquidity ratios
 */
export function calculateLiquidityRatios(data: FinancialData): FinancialRatio[] {
  const ratios: FinancialRatio[] = [];

  // Current Ratio
  if (data.currentLiabilities !== 0) {
    const currentRatio = data.currentAssets / data.currentLiabilities;
    ratios.push({
      category: 'liquidity',
      name: 'Current Ratio',
      formula: 'Current Assets / Current Liabilities',
      value: currentRatio,
      numerator: data.currentAssets,
      denominator: data.currentLiabilities,
      interpretation: interpretCurrentRatio(currentRatio),
      riskLevel: assessCurrentRatioRisk(currentRatio),
      industryBenchmark: 2.0,
      analysisNotes: generateCurrentRatioNotes(currentRatio),
    });
  }

  // Quick Ratio (Acid-Test Ratio)
  const quickAssets = data.currentAssets - data.inventory;
  if (data.currentLiabilities !== 0) {
    const quickRatio = quickAssets / data.currentLiabilities;
    ratios.push({
      category: 'liquidity',
      name: 'Quick Ratio',
      formula: '(Current Assets - Inventory) / Current Liabilities',
      value: quickRatio,
      numerator: quickAssets,
      denominator: data.currentLiabilities,
      interpretation: interpretQuickRatio(quickRatio),
      riskLevel: assessQuickRatioRisk(quickRatio),
      industryBenchmark: 1.0,
      analysisNotes: generateQuickRatioNotes(quickRatio),
    });
  }

  // Cash Ratio
  if (data.currentLiabilities !== 0) {
    const cashRatio = data.cash / data.currentLiabilities;
    ratios.push({
      category: 'liquidity',
      name: 'Cash Ratio',
      formula: 'Cash / Current Liabilities',
      value: cashRatio,
      numerator: data.cash,
      denominator: data.currentLiabilities,
      interpretation: interpretCashRatio(cashRatio),
      riskLevel: assessCashRatioRisk(cashRatio),
      industryBenchmark: 0.2,
      analysisNotes: generateCashRatioNotes(cashRatio),
    });
  }

  return ratios;
}

/**
 * Calculate profitability ratios
 */
export function calculateProfitabilityRatios(data: FinancialData): FinancialRatio[] {
  const ratios: FinancialRatio[] = [];

  // Gross Profit Margin
  if (data.revenue !== 0) {
    const grossMargin = (data.grossProfit / data.revenue) * 100;
    ratios.push({
      category: 'profitability',
      name: 'Gross Profit Margin',
      formula: '(Gross Profit / Revenue) × 100',
      value: grossMargin,
      numerator: data.grossProfit,
      denominator: data.revenue,
      interpretation: interpretGrossMargin(grossMargin),
      riskLevel: assessGrossMarginRisk(grossMargin),
      industryBenchmark: 25.0,
      analysisNotes: generateGrossMarginNotes(grossMargin),
    });
  }

  // Net Profit Margin
  if (data.revenue !== 0) {
    const netMargin = (data.netIncome / data.revenue) * 100;
    ratios.push({
      category: 'profitability',
      name: 'Net Profit Margin',
      formula: '(Net Income / Revenue) × 100',
      value: netMargin,
      numerator: data.netIncome,
      denominator: data.revenue,
      interpretation: interpretNetMargin(netMargin),
      riskLevel: assessNetMarginRisk(netMargin),
      industryBenchmark: 10.0,
      analysisNotes: generateNetMarginNotes(netMargin),
    });
  }

  // Return on Assets (ROA)
  if (data.totalAssets !== 0) {
    const roa = (data.netIncome / data.totalAssets) * 100;
    ratios.push({
      category: 'profitability',
      name: 'Return on Assets (ROA)',
      formula: '(Net Income / Total Assets) × 100',
      value: roa,
      numerator: data.netIncome,
      denominator: data.totalAssets,
      interpretation: interpretROA(roa),
      riskLevel: assessROARisk(roa),
      industryBenchmark: 5.0,
      analysisNotes: generateROANotes(roa),
    });
  }

  // Return on Equity (ROE)
  if (data.totalEquity !== 0) {
    const roe = (data.netIncome / data.totalEquity) * 100;
    ratios.push({
      category: 'profitability',
      name: 'Return on Equity (ROE)',
      formula: '(Net Income / Total Equity) × 100',
      value: roe,
      numerator: data.netIncome,
      denominator: data.totalEquity,
      interpretation: interpretROE(roe),
      riskLevel: assessROERisk(roe),
      industryBenchmark: 15.0,
      analysisNotes: generateROENotes(roe),
    });
  }

  return ratios;
}

/**
 * Calculate leverage ratios
 */
export function calculateLeverageRatios(data: FinancialData): FinancialRatio[] {
  const ratios: FinancialRatio[] = [];

  // Debt-to-Equity Ratio
  if (data.totalEquity !== 0) {
    const debtToEquity = data.totalLiabilities / data.totalEquity;
    ratios.push({
      category: 'leverage',
      name: 'Debt-to-Equity Ratio',
      formula: 'Total Liabilities / Total Equity',
      value: debtToEquity,
      numerator: data.totalLiabilities,
      denominator: data.totalEquity,
      interpretation: interpretDebtToEquity(debtToEquity),
      riskLevel: assessDebtToEquityRisk(debtToEquity),
      industryBenchmark: 1.0,
      analysisNotes: generateDebtToEquityNotes(debtToEquity),
    });
  }

  // Debt Ratio
  if (data.totalAssets !== 0) {
    const debtRatio = (data.totalLiabilities / data.totalAssets) * 100;
    ratios.push({
      category: 'leverage',
      name: 'Debt Ratio',
      formula: '(Total Liabilities / Total Assets) × 100',
      value: debtRatio,
      numerator: data.totalLiabilities,
      denominator: data.totalAssets,
      interpretation: interpretDebtRatio(debtRatio),
      riskLevel: assessDebtRatioRisk(debtRatio),
      industryBenchmark: 50.0,
      analysisNotes: generateDebtRatioNotes(debtRatio),
    });
  }

  // Interest Coverage Ratio
  if (data.interestExpense !== 0) {
    const interestCoverage = data.operatingIncome / data.interestExpense;
    ratios.push({
      category: 'leverage',
      name: 'Interest Coverage Ratio',
      formula: 'Operating Income / Interest Expense',
      value: interestCoverage,
      numerator: data.operatingIncome,
      denominator: data.interestExpense,
      interpretation: interpretInterestCoverage(interestCoverage),
      riskLevel: assessInterestCoverageRisk(interestCoverage),
      industryBenchmark: 2.5,
      analysisNotes: generateInterestCoverageNotes(interestCoverage),
    });
  }

  return ratios;
}

/**
 * Calculate efficiency ratios
 */
export function calculateEfficiencyRatios(data: FinancialData): FinancialRatio[] {
  const ratios: FinancialRatio[] = [];

  // Asset Turnover Ratio
  if (data.totalAssets !== 0) {
    const assetTurnover = data.revenue / data.totalAssets;
    ratios.push({
      category: 'efficiency',
      name: 'Asset Turnover Ratio',
      formula: 'Revenue / Total Assets',
      value: assetTurnover,
      numerator: data.revenue,
      denominator: data.totalAssets,
      interpretation: interpretAssetTurnover(assetTurnover),
      riskLevel: assessAssetTurnoverRisk(assetTurnover),
      industryBenchmark: 1.5,
      analysisNotes: generateAssetTurnoverNotes(assetTurnover),
    });
  }

  // Inventory Turnover Ratio
  if (data.inventory !== 0) {
    const inventoryTurnover = data.costOfGoodsSold / data.inventory;
    ratios.push({
      category: 'efficiency',
      name: 'Inventory Turnover Ratio',
      formula: 'Cost of Goods Sold / Inventory',
      value: inventoryTurnover,
      numerator: data.costOfGoodsSold,
      denominator: data.inventory,
      interpretation: interpretInventoryTurnover(inventoryTurnover),
      riskLevel: assessInventoryTurnoverRisk(inventoryTurnover),
      industryBenchmark: 6.0,
      analysisNotes: generateInventoryTurnoverNotes(inventoryTurnover),
    });
  }

  // Accounts Receivable Turnover
  if (data.accountsReceivable !== 0) {
    const receivableTurnover = data.revenue / data.accountsReceivable;
    ratios.push({
      category: 'efficiency',
      name: 'Accounts Receivable Turnover',
      formula: 'Revenue / Accounts Receivable',
      value: receivableTurnover,
      numerator: data.revenue,
      denominator: data.accountsReceivable,
      interpretation: interpretReceivableTurnover(receivableTurnover),
      riskLevel: assessReceivableTurnoverRisk(receivableTurnover),
      industryBenchmark: 12.0,
      analysisNotes: generateReceivableTurnoverNotes(receivableTurnover),
    });
  }

  return ratios;
}

/**
 * Calculate all financial ratios
 */
export function calculateAllFinancialRatios(trialBalance: TrialBalanceData[]): FinancialRatio[] {
  const financialData = extractFinancialData(trialBalance);

  const allRatios = [
    ...calculateLiquidityRatios(financialData),
    ...calculateProfitabilityRatios(financialData),
    ...calculateLeverageRatios(financialData),
    ...calculateEfficiencyRatios(financialData),
  ];

  return allRatios;
}

// Interpretation functions
function interpretCurrentRatio(
  ratio: number
): 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' {
  if (ratio >= 2.5) return 'excellent';
  if (ratio >= 2.0) return 'good';
  if (ratio >= 1.5) return 'acceptable';
  if (ratio >= 1.0) return 'poor';
  return 'critical';
}

function assessCurrentRatioRisk(ratio: number): 'low' | 'medium' | 'high' | 'critical' {
  if (ratio >= 2.0) return 'low';
  if (ratio >= 1.5) return 'medium';
  if (ratio >= 1.0) return 'high';
  return 'critical';
}

function generateCurrentRatioNotes(ratio: number): string {
  if (ratio >= 2.5) {
    return 'Excellent liquidity position. Company can easily meet short-term obligations.';
  } else if (ratio >= 2.0) {
    return 'Good liquidity position. Adequate current assets to cover current liabilities.';
  } else if (ratio >= 1.5) {
    return 'Acceptable liquidity but should be monitored closely.';
  } else if (ratio >= 1.0) {
    return 'Poor liquidity. May have difficulty meeting short-term obligations.';
  } else {
    return 'Critical liquidity position. Current liabilities exceed current assets.';
  }
}

function interpretQuickRatio(
  ratio: number
): 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' {
  if (ratio >= 1.5) return 'excellent';
  if (ratio >= 1.0) return 'good';
  if (ratio >= 0.8) return 'acceptable';
  if (ratio >= 0.5) return 'poor';
  return 'critical';
}

function assessQuickRatioRisk(ratio: number): 'low' | 'medium' | 'high' | 'critical' {
  if (ratio >= 1.0) return 'low';
  if (ratio >= 0.8) return 'medium';
  if (ratio >= 0.5) return 'high';
  return 'critical';
}

function generateQuickRatioNotes(ratio: number): string {
  if (ratio >= 1.5) {
    return 'Excellent short-term liquidity. Company can meet obligations without relying on inventory.';
  } else if (ratio >= 1.0) {
    return 'Good liquidity position excluding inventory from current assets.';
  } else if (ratio >= 0.8) {
    return 'Acceptable quick ratio but inventory dependency should be evaluated.';
  } else if (ratio >= 0.5) {
    return 'Poor quick ratio. Heavy reliance on inventory to meet short-term obligations.';
  } else {
    return 'Critical quick ratio. Insufficient liquid assets to cover current liabilities.';
  }
}

function interpretCashRatio(
  ratio: number
): 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' {
  if (ratio >= 0.5) return 'excellent';
  if (ratio >= 0.2) return 'good';
  if (ratio >= 0.1) return 'acceptable';
  if (ratio >= 0.05) return 'poor';
  return 'critical';
}

function assessCashRatioRisk(ratio: number): 'low' | 'medium' | 'high' | 'critical' {
  if (ratio >= 0.2) return 'low';
  if (ratio >= 0.1) return 'medium';
  if (ratio >= 0.05) return 'high';
  return 'critical';
}

function generateCashRatioNotes(ratio: number): string {
  if (ratio >= 0.5) {
    return 'Excellent cash position. Very strong immediate liquidity.';
  } else if (ratio >= 0.2) {
    return 'Good cash position relative to current liabilities.';
  } else if (ratio >= 0.1) {
    return 'Acceptable cash ratio but cash management should be monitored.';
  } else if (ratio >= 0.05) {
    return 'Poor cash position. Limited ability to meet immediate obligations with cash.';
  } else {
    return 'Critical cash shortage relative to current liabilities.';
  }
}

function interpretGrossMargin(
  margin: number
): 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' {
  if (margin >= 40) return 'excellent';
  if (margin >= 25) return 'good';
  if (margin >= 15) return 'acceptable';
  if (margin >= 5) return 'poor';
  return 'critical';
}

function assessGrossMarginRisk(margin: number): 'low' | 'medium' | 'high' | 'critical' {
  if (margin >= 25) return 'low';
  if (margin >= 15) return 'medium';
  if (margin >= 5) return 'high';
  return 'critical';
}

function generateGrossMarginNotes(margin: number): string {
  if (margin >= 40) {
    return 'Excellent gross margin indicating strong pricing power and cost control.';
  } else if (margin >= 25) {
    return 'Good gross margin showing healthy profitability at the operational level.';
  } else if (margin >= 15) {
    return 'Acceptable gross margin but cost control measures may be needed.';
  } else if (margin >= 5) {
    return 'Poor gross margin. Review pricing strategy and cost structure.';
  } else {
    return 'Critical gross margin. Immediate attention needed on pricing and costs.';
  }
}

function interpretNetMargin(
  margin: number
): 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' {
  if (margin >= 20) return 'excellent';
  if (margin >= 10) return 'good';
  if (margin >= 5) return 'acceptable';
  if (margin >= 0) return 'poor';
  return 'critical';
}

function assessNetMarginRisk(margin: number): 'low' | 'medium' | 'high' | 'critical' {
  if (margin >= 10) return 'low';
  if (margin >= 5) return 'medium';
  if (margin >= 0) return 'high';
  return 'critical';
}

function generateNetMarginNotes(margin: number): string {
  if (margin >= 20) {
    return 'Excellent net margin indicating strong overall profitability.';
  } else if (margin >= 10) {
    return 'Good net margin showing effective cost management and operations.';
  } else if (margin >= 5) {
    return 'Acceptable net margin but efficiency improvements may be beneficial.';
  } else if (margin >= 0) {
    return 'Poor net margin. Review all expenses and operational efficiency.';
  } else {
    return 'Critical situation with negative net margin. Immediate action required.';
  }
}

function interpretROA(roa: number): 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' {
  if (roa >= 15) return 'excellent';
  if (roa >= 8) return 'good';
  if (roa >= 3) return 'acceptable';
  if (roa >= 0) return 'poor';
  return 'critical';
}

function assessROARisk(roa: number): 'low' | 'medium' | 'high' | 'critical' {
  if (roa >= 8) return 'low';
  if (roa >= 3) return 'medium';
  if (roa >= 0) return 'high';
  return 'critical';
}

function generateROANotes(roa: number): string {
  if (roa >= 15) {
    return 'Excellent return on assets indicating very efficient asset utilization.';
  } else if (roa >= 8) {
    return 'Good return on assets showing effective asset management.';
  } else if (roa >= 3) {
    return 'Acceptable ROA but asset utilization could be improved.';
  } else if (roa >= 0) {
    return 'Poor ROA. Review asset productivity and operational efficiency.';
  } else {
    return 'Critical ROA with negative returns. Major operational issues need addressing.';
  }
}

function interpretROE(roe: number): 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' {
  if (roe >= 25) return 'excellent';
  if (roe >= 15) return 'good';
  if (roe >= 8) return 'acceptable';
  if (roe >= 0) return 'poor';
  return 'critical';
}

function assessROERisk(roe: number): 'low' | 'medium' | 'high' | 'critical' {
  if (roe >= 15) return 'low';
  if (roe >= 8) return 'medium';
  if (roe >= 0) return 'high';
  return 'critical';
}

function generateROENotes(roe: number): string {
  if (roe >= 25) {
    return 'Excellent return on equity indicating strong shareholder value creation.';
  } else if (roe >= 15) {
    return 'Good return on equity showing effective use of shareholder investments.';
  } else if (roe >= 8) {
    return 'Acceptable ROE but consider strategies to enhance shareholder returns.';
  } else if (roe >= 0) {
    return 'Poor ROE. Review business strategy and operational performance.';
  } else {
    return 'Critical ROE with negative returns. Fundamental business issues need attention.';
  }
}

function interpretDebtToEquity(
  ratio: number
): 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' {
  if (ratio <= 0.3) return 'excellent';
  if (ratio <= 0.6) return 'good';
  if (ratio <= 1.0) return 'acceptable';
  if (ratio <= 2.0) return 'poor';
  return 'critical';
}

function assessDebtToEquityRisk(ratio: number): 'low' | 'medium' | 'high' | 'critical' {
  if (ratio <= 0.6) return 'low';
  if (ratio <= 1.0) return 'medium';
  if (ratio <= 2.0) return 'high';
  return 'critical';
}

function generateDebtToEquityNotes(ratio: number): string {
  if (ratio <= 0.3) {
    return 'Excellent debt-to-equity ratio indicating conservative financial structure.';
  } else if (ratio <= 0.6) {
    return 'Good debt-to-equity balance with manageable leverage.';
  } else if (ratio <= 1.0) {
    return 'Acceptable leverage but debt levels should be monitored.';
  } else if (ratio <= 2.0) {
    return 'Poor debt-to-equity ratio. High leverage may limit financial flexibility.';
  } else {
    return 'Critical leverage levels. Risk of financial distress and covenant breaches.';
  }
}

function interpretDebtRatio(
  ratio: number
): 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' {
  if (ratio <= 20) return 'excellent';
  if (ratio <= 40) return 'good';
  if (ratio <= 60) return 'acceptable';
  if (ratio <= 80) return 'poor';
  return 'critical';
}

function assessDebtRatioRisk(ratio: number): 'low' | 'medium' | 'high' | 'critical' {
  if (ratio <= 40) return 'low';
  if (ratio <= 60) return 'medium';
  if (ratio <= 80) return 'high';
  return 'critical';
}

function generateDebtRatioNotes(ratio: number): string {
  if (ratio <= 20) {
    return 'Excellent debt ratio indicating strong financial position with low debt burden.';
  } else if (ratio <= 40) {
    return 'Good debt ratio showing balanced financing structure.';
  } else if (ratio <= 60) {
    return 'Acceptable debt ratio but debt management should be monitored.';
  } else if (ratio <= 80) {
    return 'Poor debt ratio. High debt levels may constrain operations and growth.';
  } else {
    return 'Critical debt ratio. Overleveraged position with high financial risk.';
  }
}

function interpretInterestCoverage(
  ratio: number
): 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' {
  if (ratio >= 8) return 'excellent';
  if (ratio >= 4) return 'good';
  if (ratio >= 2.5) return 'acceptable';
  if (ratio >= 1.5) return 'poor';
  return 'critical';
}

function assessInterestCoverageRisk(ratio: number): 'low' | 'medium' | 'high' | 'critical' {
  if (ratio >= 4) return 'low';
  if (ratio >= 2.5) return 'medium';
  if (ratio >= 1.5) return 'high';
  return 'critical';
}

function generateInterestCoverageNotes(ratio: number): string {
  if (ratio >= 8) {
    return 'Excellent interest coverage indicating very strong ability to service debt.';
  } else if (ratio >= 4) {
    return 'Good interest coverage showing adequate earnings to cover interest payments.';
  } else if (ratio >= 2.5) {
    return 'Acceptable interest coverage but should be monitored for deterioration.';
  } else if (ratio >= 1.5) {
    return 'Poor interest coverage. Limited ability to service debt from operations.';
  } else {
    return 'Critical interest coverage. High risk of default on debt obligations.';
  }
}

function interpretAssetTurnover(
  ratio: number
): 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' {
  if (ratio >= 2.5) return 'excellent';
  if (ratio >= 1.5) return 'good';
  if (ratio >= 1.0) return 'acceptable';
  if (ratio >= 0.5) return 'poor';
  return 'critical';
}

function assessAssetTurnoverRisk(ratio: number): 'low' | 'medium' | 'high' | 'critical' {
  if (ratio >= 1.5) return 'low';
  if (ratio >= 1.0) return 'medium';
  if (ratio >= 0.5) return 'high';
  return 'critical';
}

function generateAssetTurnoverNotes(ratio: number): string {
  if (ratio >= 2.5) {
    return 'Excellent asset turnover indicating very efficient use of assets to generate revenue.';
  } else if (ratio >= 1.5) {
    return 'Good asset turnover showing effective asset utilization.';
  } else if (ratio >= 1.0) {
    return 'Acceptable asset turnover but efficiency improvements may be beneficial.';
  } else if (ratio >= 0.5) {
    return 'Poor asset turnover. Assets are not being used efficiently to generate revenue.';
  } else {
    return 'Critical asset turnover. Major inefficiencies in asset utilization.';
  }
}

function interpretInventoryTurnover(
  ratio: number
): 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' {
  if (ratio >= 12) return 'excellent';
  if (ratio >= 6) return 'good';
  if (ratio >= 4) return 'acceptable';
  if (ratio >= 2) return 'poor';
  return 'critical';
}

function assessInventoryTurnoverRisk(ratio: number): 'low' | 'medium' | 'high' | 'critical' {
  if (ratio >= 6) return 'low';
  if (ratio >= 4) return 'medium';
  if (ratio >= 2) return 'high';
  return 'critical';
}

function generateInventoryTurnoverNotes(ratio: number): string {
  if (ratio >= 12) {
    return 'Excellent inventory turnover indicating efficient inventory management.';
  } else if (ratio >= 6) {
    return 'Good inventory turnover showing effective inventory control.';
  } else if (ratio >= 4) {
    return 'Acceptable inventory turnover but monitoring for optimization is recommended.';
  } else if (ratio >= 2) {
    return 'Poor inventory turnover. Excess inventory may be tying up working capital.';
  } else {
    return 'Critical inventory turnover. Significant inventory management issues.';
  }
}

function interpretReceivableTurnover(
  ratio: number
): 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical' {
  if (ratio >= 18) return 'excellent';
  if (ratio >= 12) return 'good';
  if (ratio >= 8) return 'acceptable';
  if (ratio >= 4) return 'poor';
  return 'critical';
}

function assessReceivableTurnoverRisk(ratio: number): 'low' | 'medium' | 'high' | 'critical' {
  if (ratio >= 12) return 'low';
  if (ratio >= 8) return 'medium';
  if (ratio >= 4) return 'high';
  return 'critical';
}

function generateReceivableTurnoverNotes(ratio: number): string {
  if (ratio >= 18) {
    return 'Excellent receivables turnover indicating efficient collection processes.';
  } else if (ratio >= 12) {
    return 'Good receivables turnover showing effective credit management.';
  } else if (ratio >= 8) {
    return 'Acceptable receivables turnover but collection processes could be improved.';
  } else if (ratio >= 4) {
    return 'Poor receivables turnover. Collection issues may be affecting cash flow.';
  } else {
    return 'Critical receivables turnover. Serious collection problems need immediate attention.';
  }
}
