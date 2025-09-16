/**
 * Variance Analysis Library
 * Implements comprehensive variance analysis for budget vs actual and period comparisons
 */

export interface VarianceAnalysisData {
  accountCode: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  accountCategory: string;
  actualAmount: number;
  budgetAmount?: number;
  priorPeriodAmount?: number;
  periodType: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  reportingPeriod: string;
}

export interface VarianceResult {
  accountCode: string;
  accountName: string;
  accountType: string;
  accountCategory: string;

  // Budget Variance
  actualAmount: number;
  budgetAmount?: number;
  budgetVariance?: number;
  budgetVariancePercent?: number;
  budgetVarianceType: 'favorable' | 'unfavorable' | 'neutral' | 'n/a';

  // Period Variance
  priorPeriodAmount?: number;
  periodVariance?: number;
  periodVariancePercent?: number;
  periodVarianceType: 'increase' | 'decrease' | 'neutral' | 'n/a';

  // Analysis
  significanceLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  requiresAttention: boolean;
  varianceExplanation: string;
  recommendedActions: string[];
  riskFlags: string[];
}

export interface VarianceThresholds {
  criticalVariancePercent: number;
  highVariancePercent: number;
  mediumVariancePercent: number;
  lowVariancePercent: number;
  minimalAmountThreshold: number;
  significantAmountThreshold: number;
}

export interface VarianceSummary {
  totalVariances: number;
  criticalVariances: number;
  highVariances: number;
  favorableBudgetVariances: number;
  unfavorableBudgetVariances: number;
  totalBudgetVarianceAmount: number;
  totalPeriodVarianceAmount: number;

  // Summary by category
  variancesByCategory: {
    [category: string]: {
      count: number;
      totalVariance: number;
      averageVariance: number;
    };
  };

  // Top variances
  topUnfavorableVariances: VarianceResult[];
  topFavorableVariances: VarianceResult[];
  significantIncreases: VarianceResult[];
  significantDecreases: VarianceResult[];
}

/**
 * Default variance thresholds for significance analysis
 */
export const DEFAULT_VARIANCE_THRESHOLDS: VarianceThresholds = {
  criticalVariancePercent: 50, // >50% variance is critical
  highVariancePercent: 25, // 25-50% variance is high
  mediumVariancePercent: 15, // 15-25% variance is medium
  lowVariancePercent: 5, // 5-15% variance is low
  minimalAmountThreshold: 1000, // Below ₦1,000 considered minimal
  significantAmountThreshold: 100000, // Above ₦100,000 always significant
};

/**
 * Calculate comprehensive variance analysis
 */
export function calculateVarianceAnalysis(
  data: VarianceAnalysisData[],
  thresholds: VarianceThresholds = DEFAULT_VARIANCE_THRESHOLDS
): VarianceResult[] {
  return data.map((item) => {
    const result: VarianceResult = {
      accountCode: item.accountCode,
      accountName: item.accountName,
      accountType: item.accountType,
      accountCategory: item.accountCategory,
      actualAmount: item.actualAmount,
      ...(item.budgetAmount !== undefined && { budgetAmount: item.budgetAmount }),
      ...(item.priorPeriodAmount !== undefined && {
        priorPeriodAmount: item.priorPeriodAmount,
      }),
      budgetVarianceType: 'n/a',
      periodVarianceType: 'n/a',
      significanceLevel: 'minimal',
      requiresAttention: false,
      varianceExplanation: '',
      recommendedActions: [],
      riskFlags: [] as string[],
    };

    // Calculate budget variance
    if (item.budgetAmount !== undefined && item.budgetAmount !== 0) {
      result.budgetVariance = item.actualAmount - item.budgetAmount;
      result.budgetVariancePercent = (result.budgetVariance / Math.abs(item.budgetAmount)) * 100;

      // Determine if variance is favorable or unfavorable based on account type
      if (item.accountType === 'revenue') {
        result.budgetVarianceType = result.budgetVariance > 0 ? 'favorable' : 'unfavorable';
      } else if (item.accountType === 'expense') {
        result.budgetVarianceType = result.budgetVariance < 0 ? 'favorable' : 'unfavorable';
      } else {
        result.budgetVarianceType =
          Math.abs(result.budgetVariancePercent) < 5
            ? 'neutral'
            : result.budgetVariance > 0
              ? 'favorable'
              : 'unfavorable';
      }
    }

    // Calculate period variance
    if (item.priorPeriodAmount !== undefined) {
      result.periodVariance = item.actualAmount - item.priorPeriodAmount;

      if (item.priorPeriodAmount !== 0) {
        result.periodVariancePercent =
          (result.periodVariance / Math.abs(item.priorPeriodAmount)) * 100;
      }

      if (Math.abs(result.periodVariance) < thresholds.minimalAmountThreshold) {
        result.periodVarianceType = 'neutral';
      } else {
        result.periodVarianceType = result.periodVariance > 0 ? 'increase' : 'decrease';
      }
    }

    // Determine significance level
    const maxVariancePercent = Math.max(
      Math.abs(result.budgetVariancePercent || 0),
      Math.abs(result.periodVariancePercent || 0)
    );

    const maxVarianceAmount = Math.max(
      Math.abs(result.budgetVariance || 0),
      Math.abs(result.periodVariance || 0)
    );

    if (
      maxVarianceAmount >= thresholds.significantAmountThreshold ||
      maxVariancePercent >= thresholds.criticalVariancePercent
    ) {
      result.significanceLevel = 'critical';
    } else if (maxVariancePercent >= thresholds.highVariancePercent) {
      result.significanceLevel = 'high';
    } else if (maxVariancePercent >= thresholds.mediumVariancePercent) {
      result.significanceLevel = 'medium';
    } else if (maxVariancePercent >= thresholds.lowVariancePercent) {
      result.significanceLevel = 'low';
    } else {
      result.significanceLevel = 'minimal';
    }

    // Determine if requires attention
    result.requiresAttention =
      result.significanceLevel === 'critical' ||
      result.significanceLevel === 'high' ||
      result.budgetVarianceType === 'unfavorable';

    // Generate variance explanation and recommendations
    generateVarianceAnalysis(result, item, thresholds);

    return result;
  });
}

/**
 * Generate variance explanation and recommendations
 */
function generateVarianceAnalysis(
  result: VarianceResult,
  data: VarianceAnalysisData,
  thresholds: VarianceThresholds
): void {
  const explanations: string[] = [];
  const actions: string[] = [];
  const risks: string[] = [];

  // Budget variance analysis
  if (result.budgetVariance !== undefined && result.budgetVariancePercent !== undefined) {
    const absVariancePercent = Math.abs(result.budgetVariancePercent);

    if (absVariancePercent >= thresholds.criticalVariancePercent) {
      explanations.push(
        `Critical budget variance of ${result.budgetVariancePercent.toFixed(1)}% (₦${result.budgetVariance.toLocaleString()})`
      );

      if (result.budgetVarianceType === 'unfavorable') {
        if (data.accountType === 'revenue') {
          actions.push('Investigate revenue shortfall and implement recovery strategies');
          actions.push('Review pricing, sales processes, and market conditions');
          risks.push('Revenue target achievement at risk');
        } else if (data.accountType === 'expense') {
          actions.push('Implement immediate cost control measures');
          actions.push('Review expense approval processes and spending limits');
          risks.push('Budget overrun affecting profitability');
        }
      } else {
        explanations.push(
          'Favorable variance may indicate overly conservative budgeting or exceptional performance'
        );
        actions.push('Analyze factors contributing to favorable variance for future budgeting');
      }
    } else if (absVariancePercent >= thresholds.highVariancePercent) {
      explanations.push(
        `Significant budget variance of ${result.budgetVariancePercent.toFixed(1)}%`
      );
      actions.push('Monitor closely and investigate underlying causes');
    }
  }

  // Period variance analysis
  if (result.periodVariance !== undefined && result.periodVariancePercent !== undefined) {
    const absVariancePercent = Math.abs(result.periodVariancePercent);

    if (absVariancePercent >= thresholds.criticalVariancePercent) {
      explanations.push(
        `Dramatic period-over-period change of ${result.periodVariancePercent.toFixed(1)}%`
      );

      if (data.accountType === 'revenue' && result.periodVariance < 0) {
        actions.push('Urgent investigation of revenue decline required');
        risks.push('Declining revenue trend');
      } else if (data.accountType === 'expense' && result.periodVariance > 0) {
        actions.push('Investigate reasons for expense increase');
        risks.push('Rising expense trend affecting margins');
      }
    }
  }

  // Account-specific analysis
  switch (data.accountType) {
    case 'revenue':
      if (result.budgetVarianceType === 'unfavorable') {
        actions.push('Review sales pipeline and conversion rates');
        actions.push('Assess market conditions and competitive positioning');
      }
      break;

    case 'expense':
      if (result.budgetVarianceType === 'unfavorable') {
        actions.push('Review expense categorization and approval processes');
        actions.push('Identify opportunities for cost optimization');
      }
      break;

    case 'asset':
      if (Math.abs(result.periodVariancePercent || 0) > 20) {
        actions.push('Verify asset valuation and existence');
        actions.push('Review asset acquisition/disposal activities');
      }
      break;
  }

  // Category-specific insights
  const category = data.accountCategory.toLowerCase();
  if (category.includes('salary') || category.includes('personnel')) {
    if (result.budgetVarianceType === 'unfavorable') {
      actions.push('Review headcount changes and salary adjustments');
      actions.push('Analyze overtime and contractor costs');
    }
  } else if (category.includes('marketing') || category.includes('advertising')) {
    if (result.budgetVarianceType === 'unfavorable') {
      actions.push('Evaluate marketing ROI and campaign effectiveness');
      actions.push('Consider reallocation of marketing spend');
    }
  }

  // Set default explanation if none generated
  if (explanations.length === 0) {
    if (result.significanceLevel === 'minimal') {
      explanations.push('Variance within acceptable limits');
    } else {
      explanations.push(
        `${result.significanceLevel.charAt(0).toUpperCase() + result.significanceLevel.slice(1)} variance detected requiring review`
      );
    }
  }

  result.varianceExplanation = explanations.join('. ');
  result.recommendedActions = actions;
  result.riskFlags = risks;
}

/**
 * Generate comprehensive variance summary
 */
export function generateVarianceSummary(variances: VarianceResult[]): VarianceSummary {
  const summary: VarianceSummary = {
    totalVariances: variances.length,
    criticalVariances: 0,
    highVariances: 0,
    favorableBudgetVariances: 0,
    unfavorableBudgetVariances: 0,
    totalBudgetVarianceAmount: 0,
    totalPeriodVarianceAmount: 0,
    variancesByCategory: {},
    topUnfavorableVariances: [],
    topFavorableVariances: [],
    significantIncreases: [],
    significantDecreases: [],
  };

  // Process each variance
  variances.forEach((variance) => {
    // Count by significance
    if (variance.significanceLevel === 'critical') summary.criticalVariances++;
    if (variance.significanceLevel === 'high') summary.highVariances++;

    // Count by budget variance type
    if (variance.budgetVarianceType === 'favorable') summary.favorableBudgetVariances++;
    if (variance.budgetVarianceType === 'unfavorable') summary.unfavorableBudgetVariances++;

    // Sum variances
    if (variance.budgetVariance) summary.totalBudgetVarianceAmount += variance.budgetVariance;
    if (variance.periodVariance) summary.totalPeriodVarianceAmount += variance.periodVariance;

    // Group by category
    const category = variance.accountCategory;
    if (!summary.variancesByCategory[category]) {
      summary.variancesByCategory[category] = {
        count: 0,
        totalVariance: 0,
        averageVariance: 0,
      };
    }

    summary.variancesByCategory[category].count++;
    const categoryVariance = Math.abs(variance.budgetVariance || variance.periodVariance || 0);
    summary.variancesByCategory[category].totalVariance += categoryVariance;
  });

  // Calculate averages for categories
  Object.keys(summary.variancesByCategory).forEach((category) => {
    const categoryData = summary.variancesByCategory[category]!; // Assert non-null as it's initialized in the previous loop
    categoryData.averageVariance = categoryData.totalVariance / categoryData.count;
  });

  // Get top variances
  const sortByBudgetVariance = (a: VarianceResult, b: VarianceResult) =>
    Math.abs(b.budgetVariance || 0) - Math.abs(a.budgetVariance || 0);

  const sortByPeriodVariance = (a: VarianceResult, b: VarianceResult) =>
    Math.abs(b.periodVariance || 0) - Math.abs(a.periodVariance || 0);

  // Top unfavorable budget variances
  summary.topUnfavorableVariances = variances
    .filter((v) => v.budgetVarianceType === 'unfavorable')
    .sort(sortByBudgetVariance)
    .slice(0, 10);

  // Top favorable budget variances
  summary.topFavorableVariances = variances
    .filter((v) => v.budgetVarianceType === 'favorable')
    .sort(sortByBudgetVariance)
    .slice(0, 10);

  // Significant period increases
  summary.significantIncreases = variances
    .filter((v) => v.periodVarianceType === 'increase' && v.significanceLevel !== 'minimal')
    .sort(sortByPeriodVariance)
    .slice(0, 10);

  // Significant period decreases
  summary.significantDecreases = variances
    .filter((v) => v.periodVarianceType === 'decrease' && v.significanceLevel !== 'minimal')
    .sort(sortByPeriodVariance)
    .slice(0, 10);

  return summary;
}

/**
 * Generate variance analysis report text
 */
export function generateVarianceReport(
  variances: VarianceResult[],
  summary: VarianceSummary,
  companyName?: string,
  reportingPeriod?: string
): string {
  const lines: string[] = [];

  // Header
  lines.push('# VARIANCE ANALYSIS REPORT');
  if (companyName) lines.push(`## ${companyName}`);
  if (reportingPeriod) lines.push(`### Reporting Period: ${reportingPeriod}`);
  lines.push('');

  // Executive Summary
  lines.push('## EXECUTIVE SUMMARY');
  lines.push('');
  lines.push(`**Total Accounts Analyzed:** ${summary.totalVariances}`);
  lines.push(`**Critical Variances:** ${summary.criticalVariances}`);
  lines.push(`**High Priority Variances:** ${summary.highVariances}`);
  lines.push(`**Unfavorable Budget Variances:** ${summary.unfavorableBudgetVariances}`);
  lines.push(`**Total Budget Variance:** ₦${summary.totalBudgetVarianceAmount.toLocaleString()}`);
  lines.push(`**Total Period Variance:** ₦${summary.totalPeriodVarianceAmount.toLocaleString()}`);
  lines.push('');

  // Critical Issues
  const criticalVariances = variances.filter((v) => v.significanceLevel === 'critical');
  if (criticalVariances.length > 0) {
    lines.push('## CRITICAL VARIANCES REQUIRING IMMEDIATE ATTENTION');
    lines.push('');
    criticalVariances.forEach((variance) => {
      lines.push(`### ${variance.accountName} (${variance.accountCode})`);
      lines.push(`**Variance:** ${variance.varianceExplanation}`);
      lines.push(`**Risk Flags:** ${variance.riskFlags.join(', ') || 'None'}`);
      lines.push(`**Recommended Actions:**`);
      variance.recommendedActions.forEach((action) => {
        lines.push(`- ${action}`);
      });
      lines.push('');
    });
  }

  // Category Analysis
  lines.push('## VARIANCE BY CATEGORY');
  lines.push('');
  Object.entries(summary.variancesByCategory)
    .sort(([, a], [, b]) => b.totalVariance - a.totalVariance)
    .forEach(([category, data]) => {
      lines.push(`**${category}:**`);
      lines.push(`- Count: ${data.count} accounts`);
      lines.push(`- Total Variance: ₦${data.totalVariance.toLocaleString()}`);
      lines.push(`- Average Variance: ₦${data.averageVariance.toLocaleString()}`);
      lines.push('');
    });

  return lines.join('\n');
}

/**
 * Export variance analysis to structured data for reporting
 */
export function exportVarianceAnalysis(variances: VarianceResult[], summary: VarianceSummary) {
  return {
    metadata: {
      reportType: 'variance_analysis',
      generatedAt: new Date().toISOString(),
      totalAccounts: summary.totalVariances,
      criticalIssues: summary.criticalVariances,
      currency: 'NGN',
    },
    summary,
    variances: variances.map((variance) => ({
      ...variance,
      // Format amounts for export
      actualAmountFormatted: `₦${variance.actualAmount.toLocaleString()}`,
      budgetAmountFormatted: variance.budgetAmount
        ? `₦${variance.budgetAmount.toLocaleString()}`
        : null,
      budgetVarianceFormatted: variance.budgetVariance
        ? `₦${variance.budgetVariance.toLocaleString()}`
        : null,
      periodVarianceFormatted: variance.periodVariance
        ? `₦${variance.periodVariance.toLocaleString()}`
        : null,
    })),
  };
}
