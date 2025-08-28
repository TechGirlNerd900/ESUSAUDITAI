/**
 * Nigerian Regulatory Compliance Library
 * Implements FRS (Financial Reporting Standards) and CAMA 2020 compliance checks
 */

export interface FRSComplianceRule {
  ruleId: string;
  standard:
    | 'FRS_102'
    | 'FRS_1'
    | 'FRS_2'
    | 'FRS_3'
    | 'FRS_10'
    | 'FRS_11'
    | 'FRS_15'
    | 'FRS_16'
    | 'FRS_17';
  section: string;
  title: string;
  description: string;
  category: 'disclosure' | 'recognition' | 'measurement' | 'presentation';
  severity: 'mandatory' | 'recommended' | 'optional';
  applicableEntityTypes: EntityType[];
  checkFunction: (data: any) => ComplianceCheckResult;
}

export interface CAMAComplianceRule {
  ruleId: string;
  section: string;
  title: string;
  description: string;
  category:
    | 'statutory_filing'
    | 'board_composition'
    | 'audit_requirements'
    | 'disclosure'
    | 'capital_maintenance';
  severity: 'mandatory' | 'recommended';
  applicableEntityTypes: EntityType[];
  checkFunction: (data: any) => ComplianceCheckResult;
}

export type EntityType =
  | 'private_company'
  | 'public_company'
  | 'small_company'
  | 'medium_company'
  | 'large_company'
  | 'listed_company'
  | 'financial_institution'
  | 'ngo'
  | 'cooperative';

export interface ComplianceCheckResult {
  ruleId: string;
  status:
    | 'compliant'
    | 'non_compliant'
    | 'partial_compliance'
    | 'not_applicable'
    | 'requires_review';
  confidence: number; // 0-100
  findings: string[];
  recommendations: string[];
  evidence: any[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ComplianceAssessment {
  entityType: EntityType;
  reportingPeriod: string;
  assessmentDate: string;

  // FRS Compliance
  frsCompliance: {
    overallScore: number;
    totalRules: number;
    compliantRules: number;
    nonCompliantRules: number;
    results: ComplianceCheckResult[];
  };

  // CAMA Compliance
  camaCompliance: {
    overallScore: number;
    totalRules: number;
    compliantRules: number;
    nonCompliantRules: number;
    results: ComplianceCheckResult[];
  };

  // Summary
  overallComplianceScore: number;
  criticalIssues: ComplianceCheckResult[];
  highPriorityIssues: ComplianceCheckResult[];
  recommendedActions: string[];
}

/**
 * FRS Compliance Rules Implementation
 */
export const FRS_COMPLIANCE_RULES: FRSComplianceRule[] = [
  // FRS 102 - Financial Reporting Standard for Large and Medium-sized Entities
  {
    ruleId: 'FRS_102_001',
    standard: 'FRS_102',
    section: '4.2',
    title: 'Going Concern Assessment',
    description: "Management must assess the entity's ability to continue as a going concern",
    category: 'disclosure',
    severity: 'mandatory',
    applicableEntityTypes: [
      'medium_company',
      'large_company',
      'listed_company',
      'financial_institution',
    ],
    checkFunction: (data) => checkGoingConcern(data),
  },
  {
    ruleId: 'FRS_102_002',
    standard: 'FRS_102',
    section: '11.44',
    title: 'Related Party Disclosures',
    description: 'Entity must disclose relationships and transactions with related parties',
    category: 'disclosure',
    severity: 'mandatory',
    applicableEntityTypes: [
      'medium_company',
      'large_company',
      'listed_company',
      'financial_institution',
    ],
    checkFunction: (data) => checkRelatedPartyDisclosures(data),
  },
  {
    ruleId: 'FRS_102_003',
    standard: 'FRS_102',
    section: '17.15',
    title: 'Property, Plant and Equipment Valuation',
    description: 'PPE must be measured at cost less accumulated depreciation and impairment',
    category: 'measurement',
    severity: 'mandatory',
    applicableEntityTypes: [
      'medium_company',
      'large_company',
      'listed_company',
      'financial_institution',
    ],
    checkFunction: (data) => checkPPEValuation(data),
  },
  {
    ruleId: 'FRS_102_004',
    standard: 'FRS_102',
    section: '27.33',
    title: 'Impairment of Assets',
    description: 'Entity must assess assets for impairment indicators',
    category: 'measurement',
    severity: 'mandatory',
    applicableEntityTypes: [
      'medium_company',
      'large_company',
      'listed_company',
      'financial_institution',
    ],
    checkFunction: (data) => checkImpairmentAssessment(data),
  },

  // FRS 1 - Financial Reporting Standard for Small and Medium-sized Entities
  {
    ruleId: 'FRS_1_001',
    standard: 'FRS_1',
    section: '2.1',
    title: 'Simplified Financial Statements',
    description: 'Small entities may prepare simplified financial statements',
    category: 'presentation',
    severity: 'optional',
    applicableEntityTypes: ['small_company'],
    checkFunction: (data) => checkSimplifiedStatements(data),
  },
  {
    ruleId: 'FRS_1_002',
    standard: 'FRS_1',
    section: '3.2',
    title: 'Cash Flow Statement Exemption',
    description: 'Small entities are exempt from preparing cash flow statements',
    category: 'presentation',
    severity: 'optional',
    applicableEntityTypes: ['small_company'],
    checkFunction: (data) => checkCashFlowExemption(data),
  },

  // FRS 3 - Business Combinations
  {
    ruleId: 'FRS_3_001',
    standard: 'FRS_3',
    section: '19',
    title: 'Goodwill Recognition',
    description: 'Goodwill arising from business combinations must be recognized as an asset',
    category: 'recognition',
    severity: 'mandatory',
    applicableEntityTypes: [
      'medium_company',
      'large_company',
      'listed_company',
      'financial_institution',
    ],
    checkFunction: (data) => checkGoodwillRecognition(data),
  },
];

/**
 * CAMA 2020 Compliance Rules Implementation
 */
export const CAMA_COMPLIANCE_RULES: CAMAComplianceRule[] = [
  {
    ruleId: 'CAMA_001',
    section: '402',
    title: 'Annual Return Filing',
    description: 'Every company must file annual returns within 42 days after AGM',
    category: 'statutory_filing',
    severity: 'mandatory',
    applicableEntityTypes: [
      'private_company',
      'public_company',
      'small_company',
      'medium_company',
      'large_company',
      'listed_company',
    ],
    checkFunction: (data) => checkAnnualReturnFiling(data),
  },
  {
    ruleId: 'CAMA_002',
    section: '405',
    title: 'Financial Statements Filing',
    description: 'Companies must file audited financial statements with CAC',
    category: 'statutory_filing',
    severity: 'mandatory',
    applicableEntityTypes: [
      'medium_company',
      'large_company',
      'listed_company',
      'financial_institution',
    ],
    checkFunction: (data) => checkFinancialStatementsFiling(data),
  },
  {
    ruleId: 'CAMA_003',
    section: '271',
    title: 'Board Composition Requirements',
    description: 'Board must have minimum number of directors as prescribed',
    category: 'board_composition',
    severity: 'mandatory',
    applicableEntityTypes: ['private_company', 'public_company', 'listed_company'],
    checkFunction: (data) => checkBoardComposition(data),
  },
  {
    ruleId: 'CAMA_004',
    section: '404',
    title: 'Audit Requirements',
    description: 'Companies above specified thresholds must be audited',
    category: 'audit_requirements',
    severity: 'mandatory',
    applicableEntityTypes: [
      'medium_company',
      'large_company',
      'listed_company',
      'financial_institution',
    ],
    checkFunction: (data) => checkAuditRequirements(data),
  },
  {
    ruleId: 'CAMA_005',
    section: '379',
    title: 'Dividend Distribution Restrictions',
    description: 'Dividends may only be paid out of distributable profits',
    category: 'capital_maintenance',
    severity: 'mandatory',
    applicableEntityTypes: ['private_company', 'public_company', 'listed_company'],
    checkFunction: (data) => checkDividendRestrictions(data),
  },
];

/**
 * FRS Compliance Check Functions
 */
function checkGoingConcern(data: any): ComplianceCheckResult {
  const result: ComplianceCheckResult = {
    ruleId: 'FRS_102_001',
    status: 'requires_review',
    confidence: 60,
    findings: [],
    recommendations: [],
    evidence: [],
    riskLevel: 'medium',
  };

  // Check for going concern indicators
  const indicators = data.goingConcernIndicators || {};

  if (!indicators.assessmentPerformed) {
    result.status = 'non_compliant';
    result.findings.push('No evidence of going concern assessment being performed');
    result.recommendations.push(
      'Perform comprehensive going concern assessment for at least 12 months from balance sheet date'
    );
    result.riskLevel = 'high';
  } else {
    result.findings.push('Going concern assessment documented');

    // Check for adverse indicators
    const adverseIndicators = [
      indicators.netLiabilitiesPosition,
      indicators.loanDefaultsOrCovenantBreaches,
      indicators.substantialOperatingLosses,
      indicators.significantDependenceOnSpecificCustomers,
      indicators.lossOfKeyManagement,
    ].filter(Boolean).length;

    if (adverseIndicators >= 3) {
      result.status = 'requires_review';
      result.findings.push(`${adverseIndicators} adverse going concern indicators identified`);
      result.recommendations.push('Consider additional disclosures about material uncertainties');
      result.riskLevel = 'high';
    } else if (adverseIndicators > 0) {
      result.status = 'partial_compliance';
      result.findings.push(`${adverseIndicators} adverse going concern indicators noted`);
      result.recommendations.push('Monitor going concern indicators closely');
      result.riskLevel = 'medium';
    } else {
      result.status = 'compliant';
      result.findings.push('No significant going concern issues identified');
      result.riskLevel = 'low';
    }
  }

  return result;
}

function checkRelatedPartyDisclosures(data: any): ComplianceCheckResult {
  const result: ComplianceCheckResult = {
    ruleId: 'FRS_102_002',
    status: 'requires_review',
    confidence: 70,
    findings: [],
    recommendations: [],
    evidence: [],
    riskLevel: 'medium',
  };

  const relatedParties = data.relatedParties || {};

  if (!relatedParties.disclosed) {
    result.status = 'non_compliant';
    result.findings.push('No related party disclosures identified');
    result.recommendations.push(
      'Identify and disclose all related party relationships and transactions'
    );
    result.riskLevel = 'high';
  } else {
    const requiredDisclosures = [
      'natureOfRelationship',
      'transactionDescriptions',
      'transactionAmounts',
      'outstandingBalances',
      'provisionsForDoubtfulDebts',
    ];

    const missingDisclosures = requiredDisclosures.filter(
      (disclosure) => !relatedParties[disclosure]
    );

    if (missingDisclosures.length > 0) {
      result.status = 'partial_compliance';
      result.findings.push(`Missing disclosures: ${missingDisclosures.join(', ')}`);
      result.recommendations.push('Complete all required related party disclosures');
      result.riskLevel = 'medium';
    } else {
      result.status = 'compliant';
      result.findings.push('Related party disclosures appear complete');
      result.riskLevel = 'low';
    }
  }

  return result;
}

function checkPPEValuation(data: any): ComplianceCheckResult {
  const result: ComplianceCheckResult = {
    ruleId: 'FRS_102_003',
    status: 'requires_review',
    confidence: 80,
    findings: [],
    recommendations: [],
    evidence: [],
    riskLevel: 'medium',
  };

  const ppe = data.propertyPlantEquipment || {};

  if (!ppe.valuationMethod) {
    result.status = 'non_compliant';
    result.findings.push('PPE valuation method not documented');
    result.recommendations.push(
      'Document PPE valuation method and ensure compliance with cost model'
    );
    result.riskLevel = 'high';
  } else if (ppe.valuationMethod === 'cost') {
    result.status = 'compliant';
    result.findings.push('PPE valued at cost model in compliance with FRS 102');
    result.riskLevel = 'low';

    // Check depreciation
    if (!ppe.depreciationPolicyDocumented) {
      result.status = 'partial_compliance';
      result.findings.push('Depreciation policy not adequately documented');
      result.recommendations.push(
        'Document depreciation methods and useful lives for all PPE categories'
      );
      result.riskLevel = 'medium';
    }
  } else if (ppe.valuationMethod === 'revaluation') {
    result.status = 'requires_review';
    result.findings.push('PPE revaluation model requires additional compliance checks');
    result.recommendations.push('Ensure revaluation model complies with FRS 102 requirements');
    result.riskLevel = 'medium';
  }

  return result;
}

function checkImpairmentAssessment(data: any): ComplianceCheckResult {
  const result: ComplianceCheckResult = {
    ruleId: 'FRS_102_004',
    status: 'requires_review',
    confidence: 65,
    findings: [],
    recommendations: [],
    evidence: [],
    riskLevel: 'medium',
  };

  const impairment = data.impairmentAssessment || {};

  if (!impairment.assessmentPerformed) {
    result.status = 'partial_compliance';
    result.findings.push('No evidence of impairment assessment');
    result.recommendations.push('Perform annual impairment indicator assessment');
    result.riskLevel = 'medium';
  } else {
    result.findings.push('Impairment assessment documented');

    if (impairment.indicatorsIdentified && !impairment.impairmentTestPerformed) {
      result.status = 'non_compliant';
      result.findings.push('Impairment indicators identified but no impairment test performed');
      result.recommendations.push('Perform impairment test and recognize any impairment losses');
      result.riskLevel = 'high';
    } else {
      result.status = 'compliant';
      result.findings.push('Impairment assessment appears adequate');
      result.riskLevel = 'low';
    }
  }

  return result;
}

function checkSimplifiedStatements(data: any): ComplianceCheckResult {
  return {
    ruleId: 'FRS_1_001',
    status: 'not_applicable',
    confidence: 100,
    findings: ['Small entity exemption available'],
    recommendations: ['Consider simplified reporting if eligible'],
    evidence: [],
    riskLevel: 'low',
  };
}

function checkCashFlowExemption(data: any): ComplianceCheckResult {
  return {
    ruleId: 'FRS_1_002',
    status: 'not_applicable',
    confidence: 100,
    findings: ['Cash flow statement exemption available for small entities'],
    recommendations: ['Ensure entity qualifies for small company exemption'],
    evidence: [],
    riskLevel: 'low',
  };
}

function checkGoodwillRecognition(data: any): ComplianceCheckResult {
  const result: ComplianceCheckResult = {
    ruleId: 'FRS_3_001',
    status: 'not_applicable',
    confidence: 90,
    findings: [],
    recommendations: [],
    evidence: [],
    riskLevel: 'low',
  };

  const businessCombinations = data.businessCombinations || {};

  if (!businessCombinations.occurred) {
    result.findings.push('No business combinations during the period');
  } else {
    result.status = 'requires_review';
    result.findings.push('Business combination occurred - review goodwill treatment');
    result.recommendations.push('Ensure goodwill is recognized and tested for impairment annually');
    result.riskLevel = 'medium';
  }

  return result;
}

/**
 * CAMA 2020 Compliance Check Functions
 */
function checkAnnualReturnFiling(data: any): ComplianceCheckResult {
  const result: ComplianceCheckResult = {
    ruleId: 'CAMA_001',
    status: 'requires_review',
    confidence: 85,
    findings: [],
    recommendations: [],
    evidence: [],
    riskLevel: 'medium',
  };

  const filing = data.annualReturn || {};
  const agmDate = filing.agmDate ? new Date(filing.agmDate) : null;
  const filingDate = filing.filingDate ? new Date(filing.filingDate) : null;

  if (!agmDate) {
    result.status = 'non_compliant';
    result.findings.push('AGM date not documented');
    result.recommendations.push('Hold AGM and file annual return within 42 days');
    result.riskLevel = 'high';
  } else if (!filingDate) {
    result.status = 'non_compliant';
    result.findings.push('Annual return not filed');
    result.recommendations.push('File annual return with CAC immediately');
    result.riskLevel = 'critical';
  } else {
    const daysDifference = Math.ceil(
      (filingDate.getTime() - agmDate.getTime()) / (1000 * 3600 * 24)
    );

    if (daysDifference <= 42) {
      result.status = 'compliant';
      result.findings.push(`Annual return filed within ${daysDifference} days of AGM`);
      result.riskLevel = 'low';
    } else {
      result.status = 'non_compliant';
      result.findings.push(
        `Annual return filed ${daysDifference} days after AGM (exceeds 42-day limit)`
      );
      result.recommendations.push('Ensure future annual returns are filed within 42 days of AGM');
      result.riskLevel = 'high';
    }
  }

  return result;
}

function checkFinancialStatementsFiling(data: any): ComplianceCheckResult {
  const result: ComplianceCheckResult = {
    ruleId: 'CAMA_002',
    status: 'requires_review',
    confidence: 80,
    findings: [],
    recommendations: [],
    evidence: [],
    riskLevel: 'medium',
  };

  const filing = data.financialStatementsFiling || {};

  if (!filing.filed) {
    result.status = 'non_compliant';
    result.findings.push('Financial statements not filed with CAC');
    result.recommendations.push('File audited financial statements with CAC as required');
    result.riskLevel = 'critical';
  } else if (!filing.audited) {
    result.status = 'non_compliant';
    result.findings.push('Financial statements filed but not audited');
    result.recommendations.push('Ensure financial statements are audited before filing');
    result.riskLevel = 'high';
  } else {
    result.status = 'compliant';
    result.findings.push('Audited financial statements filed with CAC');
    result.riskLevel = 'low';
  }

  return result;
}

function checkBoardComposition(data: any): ComplianceCheckResult {
  const result: ComplianceCheckResult = {
    ruleId: 'CAMA_003',
    status: 'requires_review',
    confidence: 90,
    findings: [],
    recommendations: [],
    evidence: [],
    riskLevel: 'medium',
  };

  const board = data.boardComposition || {};
  const entityType = data.entityType;

  let minDirectors = 2; // Default for private companies
  if (entityType === 'public_company' || entityType === 'listed_company') {
    minDirectors = 3;
  }

  const directorCount = board.numberOfDirectors || 0;

  if (directorCount < minDirectors) {
    result.status = 'non_compliant';
    result.findings.push(
      `Board has ${directorCount} directors, minimum required is ${minDirectors}`
    );
    result.recommendations.push(
      `Appoint additional directors to meet minimum requirement of ${minDirectors}`
    );
    result.riskLevel = 'high';
  } else {
    result.status = 'compliant';
    result.findings.push(
      `Board composition meets minimum requirement (${directorCount} directors)`
    );
    result.riskLevel = 'low';
  }

  return result;
}

function checkAuditRequirements(data: any): ComplianceCheckResult {
  const result: ComplianceCheckResult = {
    ruleId: 'CAMA_004',
    status: 'requires_review',
    confidence: 85,
    findings: [],
    recommendations: [],
    evidence: [],
    riskLevel: 'medium',
  };

  const audit = data.auditRequirements || {};
  const financials = data.financialData || {};

  // Audit thresholds (simplified)
  const revenue = financials.revenue || 0;
  const assets = financials.totalAssets || 0;

  const requiresAudit = revenue > 120000000 || assets > 60000000; // ₦120M revenue or ₦60M assets

  if (requiresAudit && !audit.audited) {
    result.status = 'non_compliant';
    result.findings.push('Entity exceeds audit thresholds but financial statements not audited');
    result.recommendations.push('Appoint external auditors and obtain audit opinion');
    result.riskLevel = 'critical';
  } else if (requiresAudit && audit.audited) {
    result.status = 'compliant';
    result.findings.push('Financial statements audited as required');
    result.riskLevel = 'low';
  } else {
    result.status = 'not_applicable';
    result.findings.push('Entity below audit thresholds');
    result.riskLevel = 'low';
  }

  return result;
}

function checkDividendRestrictions(data: any): ComplianceCheckResult {
  const result: ComplianceCheckResult = {
    ruleId: 'CAMA_005',
    status: 'requires_review',
    confidence: 75,
    findings: [],
    recommendations: [],
    evidence: [],
    riskLevel: 'medium',
  };

  const dividends = data.dividends || {};
  const financials = data.financialData || {};

  if (!dividends.declared) {
    result.status = 'not_applicable';
    result.findings.push('No dividends declared during the period');
    result.riskLevel = 'low';
  } else {
    const distributableProfits = financials.retainedEarnings || 0;
    const dividendAmount = dividends.amount || 0;

    if (dividendAmount > distributableProfits) {
      result.status = 'non_compliant';
      result.findings.push('Dividends exceed distributable profits');
      result.recommendations.push('Ensure dividends are only paid from distributable profits');
      result.riskLevel = 'critical';
    } else {
      result.status = 'compliant';
      result.findings.push('Dividends within distributable profit limits');
      result.riskLevel = 'low';
    }
  }

  return result;
}

/**
 * Main compliance assessment function
 */
export function performComplianceAssessment(
  entityType: EntityType,
  data: any,
  reportingPeriod: string
): ComplianceAssessment {
  const assessment: ComplianceAssessment = {
    entityType,
    reportingPeriod,
    assessmentDate: new Date().toISOString(),
    frsCompliance: {
      overallScore: 0,
      totalRules: 0,
      compliantRules: 0,
      nonCompliantRules: 0,
      results: [],
    },
    camaCompliance: {
      overallScore: 0,
      totalRules: 0,
      compliantRules: 0,
      nonCompliantRules: 0,
      results: [],
    },
    overallComplianceScore: 0,
    criticalIssues: [],
    highPriorityIssues: [],
    recommendedActions: [],
  };

  // Assess FRS compliance
  const applicableFRSRules = FRS_COMPLIANCE_RULES.filter((rule) =>
    rule.applicableEntityTypes.includes(entityType)
  );

  assessment.frsCompliance.totalRules = applicableFRSRules.length;
  assessment.frsCompliance.results = applicableFRSRules.map((rule) => rule.checkFunction(data));

  assessment.frsCompliance.compliantRules = assessment.frsCompliance.results.filter(
    (r) => r.status === 'compliant'
  ).length;

  assessment.frsCompliance.nonCompliantRules = assessment.frsCompliance.results.filter(
    (r) => r.status === 'non_compliant'
  ).length;

  assessment.frsCompliance.overallScore =
    assessment.frsCompliance.totalRules > 0
      ? (assessment.frsCompliance.compliantRules / assessment.frsCompliance.totalRules) * 100
      : 100;

  // Assess CAMA compliance
  const applicableCAMARules = CAMA_COMPLIANCE_RULES.filter((rule) =>
    rule.applicableEntityTypes.includes(entityType)
  );

  assessment.camaCompliance.totalRules = applicableCAMARules.length;
  assessment.camaCompliance.results = applicableCAMARules.map((rule) => rule.checkFunction(data));

  assessment.camaCompliance.compliantRules = assessment.camaCompliance.results.filter(
    (r) => r.status === 'compliant'
  ).length;

  assessment.camaCompliance.nonCompliantRules = assessment.camaCompliance.results.filter(
    (r) => r.status === 'non_compliant'
  ).length;

  assessment.camaCompliance.overallScore =
    assessment.camaCompliance.totalRules > 0
      ? (assessment.camaCompliance.compliantRules / assessment.camaCompliance.totalRules) * 100
      : 100;

  // Calculate overall compliance score
  const totalRules = assessment.frsCompliance.totalRules + assessment.camaCompliance.totalRules;
  const totalCompliant =
    assessment.frsCompliance.compliantRules + assessment.camaCompliance.compliantRules;

  assessment.overallComplianceScore = totalRules > 0 ? (totalCompliant / totalRules) * 100 : 100;

  // Identify critical and high priority issues
  const allResults = [...assessment.frsCompliance.results, ...assessment.camaCompliance.results];

  assessment.criticalIssues = allResults.filter((r) => r.riskLevel === 'critical');
  assessment.highPriorityIssues = allResults.filter((r) => r.riskLevel === 'high');

  // Compile recommended actions
  assessment.recommendedActions = [...new Set(allResults.flatMap((r) => r.recommendations))].slice(
    0,
    10
  ); // Top 10 recommendations

  return assessment;
}

/**
 * Generate compliance report
 */
export function generateComplianceReport(assessment: ComplianceAssessment): string {
  const lines: string[] = [];

  lines.push('# NIGERIAN REGULATORY COMPLIANCE ASSESSMENT');
  lines.push(`## Entity Type: ${assessment.entityType.replace('_', ' ').toUpperCase()}`);
  lines.push(`## Reporting Period: ${assessment.reportingPeriod}`);
  lines.push(`## Assessment Date: ${new Date(assessment.assessmentDate).toLocaleDateString()}`);
  lines.push('');

  // Executive Summary
  lines.push('## EXECUTIVE SUMMARY');
  lines.push('');
  lines.push(`**Overall Compliance Score:** ${assessment.overallComplianceScore.toFixed(1)}%`);
  lines.push(`**Critical Issues:** ${assessment.criticalIssues.length}`);
  lines.push(`**High Priority Issues:** ${assessment.highPriorityIssues.length}`);
  lines.push('');

  // FRS Compliance
  lines.push('## FRS COMPLIANCE ASSESSMENT');
  lines.push('');
  lines.push(`**Overall Score:** ${assessment.frsCompliance.overallScore.toFixed(1)}%`);
  lines.push(
    `**Compliant Rules:** ${assessment.frsCompliance.compliantRules}/${assessment.frsCompliance.totalRules}`
  );
  lines.push('');

  // CAMA Compliance
  lines.push('## CAMA 2020 COMPLIANCE ASSESSMENT');
  lines.push('');
  lines.push(`**Overall Score:** ${assessment.camaCompliance.overallScore.toFixed(1)}%`);
  lines.push(
    `**Compliant Rules:** ${assessment.camaCompliance.compliantRules}/${assessment.camaCompliance.totalRules}`
  );
  lines.push('');

  // Critical Issues
  if (assessment.criticalIssues.length > 0) {
    lines.push('## CRITICAL COMPLIANCE ISSUES');
    lines.push('');
    assessment.criticalIssues.forEach((issue) => {
      lines.push(`### ${issue.ruleId}`);
      lines.push(`**Status:** ${issue.status.toUpperCase()}`);
      lines.push(`**Findings:** ${issue.findings.join(', ')}`);
      lines.push(`**Recommendations:** ${issue.recommendations.join(', ')}`);
      lines.push('');
    });
  }

  // Recommended Actions
  if (assessment.recommendedActions.length > 0) {
    lines.push('## RECOMMENDED ACTIONS');
    lines.push('');
    assessment.recommendedActions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}
