/**
 * Management Letter Generator
 * Specialized system for drafting management letters with recommendations
 */

export interface ManagementLetterFinding {
  id: string;
  title: string;
  category:
    | 'internal_control'
    | 'compliance'
    | 'operational'
    | 'financial_reporting'
    | 'governance'
    | 'it_controls';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  currentSituation: string;
  risks: string[];
  businessImpact: string;
  recommendation: string;
  managementResponse?: string;
  agreedActionPlan?: string;
  targetDate?: string;
  responsiblePerson?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'management_accepted' | 'management_rejected';
  auditEvidence: string[];
  relatedAccounts: string[];
  priority: number;
  estimatedImplementationEffort: 'low' | 'medium' | 'high';
  costBenefitAnalysis?: string;
}

export interface ManagementLetterTemplate {
  id: string;
  name: string;
  description: string;
  letterType: 'annual' | 'interim' | 'special' | 'follow_up';
  clientType: string[];
  sections: ManagementLetterSection[];
  metadata: {
    version: string;
    createdDate: string;
    lastUpdated: string;
    author: string;
    complianceFrameworks: string[];
  };
}

export interface ManagementLetterSection {
  id: string;
  title: string;
  content: string;
  order: number;
  isRequired: boolean;
  findingCategories: string[];
  templateVariables: Record<string, any>;
}

export interface GeneratedManagementLetter {
  id: string;
  engagementId: string;
  templateId: string;
  title: string;
  executiveSummary: string;
  findings: ManagementLetterFinding[];
  sections: ManagementLetterSection[];
  metadata: {
    generatedAt: string;
    generatedBy: string;
    version: string;
    status: 'draft' | 'review' | 'approved' | 'issued';
    wordCount: number;
    findingCount: number;
    criticalFindingCount: number;
  };
  overallAssessment: {
    controlEnvironmentRating: 'strong' | 'adequate' | 'needs_improvement' | 'weak';
    keyRiskAreas: string[];
    priorityRecommendations: string[];
    positiveObservations: string[];
  };
  organizationId: string;
}

/**
 * Management Letter Generator Engine
 */
export class ManagementLetterGenerator {
  private templates: Map<string, ManagementLetterTemplate> = new Map();
  private findingTemplates: Map<string, Partial<ManagementLetterFinding>> = new Map();

  constructor() {
    this.loadManagementLetterTemplates();
    this.loadFindingTemplates();
  }

  /**
   * Generate complete management letter
   */
  async generateManagementLetter(
    engagementId: string,
    templateId: string,
    findings: ManagementLetterFinding[],
    engagementData: any,
    additionalData?: Record<string, any>
  ): Promise<GeneratedManagementLetter> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    // Sort findings by priority and severity
    const sortedFindings = this.prioritizeFindings(findings);

    // Generate executive summary
    const executiveSummary = this.generateExecutiveSummary(sortedFindings, engagementData);

    // Generate sections with content
    const generatedSections = await Promise.all(
      template.sections.map((section) =>
        this.generateSection(section, sortedFindings, engagementData, additionalData)
      )
    );

    // Assess overall control environment
    const overallAssessment = this.assessControlEnvironment(sortedFindings);

    const managementLetter: GeneratedManagementLetter = {
      id: `ml_${engagementId}_${Date.now()}`,
      engagementId,
      templateId: template.id,
      title: this.generateLetterTitle(engagementData, template),
      executiveSummary,
      findings: sortedFindings,
      sections: generatedSections,
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
        version: '1.0',
        status: 'draft',
        wordCount: this.calculateWordCount(executiveSummary, generatedSections),
        findingCount: sortedFindings.length,
        criticalFindingCount: sortedFindings.filter((f) => f.severity === 'critical').length,
      },
      overallAssessment,
      organizationId: engagementData.organizationId,
    };

    return managementLetter;
  }

  /**
   * Create finding from template
   */
  createFindingFromTemplate(
    templateId: string,
    customData: Partial<ManagementLetterFinding>
  ): ManagementLetterFinding {
    const template = this.findingTemplates.get(templateId);
    if (!template) {
      throw new Error(`Finding template with ID ${templateId} not found`);
    }

    return {
      id: customData.id || `finding_${Date.now()}`,
      status: 'open',
      auditEvidence: [],
      relatedAccounts: [],
      priority: 1,
      estimatedImplementationEffort: 'medium',
      ...template,
      ...customData,
    } as ManagementLetterFinding;
  }

  /**
   * Prioritize findings based on severity and business impact
   */
  private prioritizeFindings(findings: ManagementLetterFinding[]): ManagementLetterFinding[] {
    const severityWeight = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return findings.sort((a, b) => {
      // Primary sort by severity
      const severityDiff = severityWeight[b.severity] - severityWeight[a.severity];
      if (severityDiff !== 0) return severityDiff;

      // Secondary sort by priority
      return b.priority - a.priority;
    });
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(
    findings: ManagementLetterFinding[],
    engagementData: any
  ): string {
    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const highCount = findings.filter((f) => f.severity === 'high').length;
    const totalFindings = findings.length;

    let summary = `During our audit of ${engagementData.clientName} for the year ended ${new Date(engagementData.reportingPeriodEnd).toLocaleDateString('en-NG')}, we identified ${totalFindings} area${totalFindings > 1 ? 's' : ''} where improvements to internal controls and operational processes could be beneficial.\n\n`;

    if (criticalCount > 0) {
      summary += `Of particular concern are ${criticalCount} critical finding${criticalCount > 1 ? 's' : ''} that require immediate management attention to mitigate significant risks to the organization. `;
    }

    if (highCount > 0) {
      summary += `Additionally, ${highCount} high-severity matter${highCount > 1 ? 's' : ''} should be addressed in the near term to strengthen the control environment. `;
    }

    summary += `\n\nOur recommendations are designed to enhance operational efficiency, strengthen internal controls, and ensure compliance with applicable regulations. We believe that implementing these recommendations will provide significant value to the organization.`;

    // Add positive observations if available
    const positiveFindings = findings.filter(
      (f) => f.category === 'operational' && f.severity === 'low'
    );
    if (positiveFindings.length > 0) {
      summary += `\n\nWe also acknowledge the effective controls and processes that we observed during our audit, which demonstrate management's commitment to maintaining a strong control environment.`;
    }

    return summary;
  }

  /**
   * Generate individual section
   */
  private async generateSection(
    section: ManagementLetterSection,
    findings: ManagementLetterFinding[],
    engagementData: any,
    additionalData?: Record<string, any>
  ): Promise<ManagementLetterSection> {
    let generatedContent = section.content;

    // Replace template variables
    const variables = this.buildTemplateVariables(engagementData, section, additionalData);

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      generatedContent = generatedContent.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Add findings content based on section type
    if (section.id === 'findings_detail') {
      generatedContent += this.generateFindingsContent(findings);
    } else if (section.id === 'summary_of_recommendations') {
      generatedContent += this.generateRecommendationsSummary(findings);
    } else if (section.id === 'follow_up_items') {
      generatedContent += this.generateFollowUpItems(findings);
    }

    return {
      ...section,
      content: generatedContent,
    };
  }

  /**
   * Generate detailed findings content
   */
  private generateFindingsContent(findings: ManagementLetterFinding[]): string {
    let content = '\n\n';

    findings.forEach((finding, index) => {
      content += `## ${index + 1}. ${finding.title}\n\n`;
      content += `**Category:** ${this.formatCategory(finding.category)}\n`;
      content += `**Severity:** ${finding.severity.toUpperCase()}\n\n`;

      content += `**Current Situation:**\n${finding.currentSituation}\n\n`;

      if (finding.risks.length > 0) {
        content += `**Risks:**\n`;
        finding.risks.forEach((risk) => {
          content += `• ${risk}\n`;
        });
        content += '\n';
      }

      content += `**Business Impact:**\n${finding.businessImpact}\n\n`;
      content += `**Recommendation:**\n${finding.recommendation}\n\n`;

      if (finding.estimatedImplementationEffort) {
        content += `**Implementation Effort:** ${finding.estimatedImplementationEffort.toUpperCase()}\n\n`;
      }

      if (finding.managementResponse) {
        content += `**Management Response:**\n${finding.managementResponse}\n\n`;
      }

      if (finding.agreedActionPlan) {
        content += `**Agreed Action Plan:**\n${finding.agreedActionPlan}\n`;
        if (finding.targetDate) {
          content += `**Target Date:** ${new Date(finding.targetDate).toLocaleDateString('en-NG')}\n`;
        }
        if (finding.responsiblePerson) {
          content += `**Responsible Person:** ${finding.responsiblePerson}\n`;
        }
        content += '\n';
      }

      content += '---\n\n';
    });

    return content;
  }

  /**
   * Generate recommendations summary
   */
  private generateRecommendationsSummary(findings: ManagementLetterFinding[]): string {
    let content =
      '\n\nBased on our findings, we recommend that management prioritize the following actions:\n\n';

    const criticalFindings = findings.filter((f) => f.severity === 'critical');
    const highFindings = findings.filter((f) => f.severity === 'high');

    if (criticalFindings.length > 0) {
      content += '**Immediate Actions Required (Critical):**\n';
      criticalFindings.forEach((finding, index) => {
        content += `${index + 1}. ${finding.title}: ${this.extractKeyRecommendation(finding.recommendation)}\n`;
      });
      content += '\n';
    }

    if (highFindings.length > 0) {
      content += '**High Priority Actions:**\n';
      highFindings.forEach((finding, index) => {
        content += `${index + 1}. ${finding.title}: ${this.extractKeyRecommendation(finding.recommendation)}\n`;
      });
      content += '\n';
    }

    // Add implementation timeline
    content += '**Recommended Implementation Timeline:**\n';
    content += `• Critical items: Within 30 days\n`;
    content += `• High priority items: Within 90 days\n`;
    content += `• Medium priority items: Within 180 days\n`;
    content += `• Low priority items: Within 12 months\n\n`;

    return content;
  }

  /**
   * Generate follow-up items
   */
  private generateFollowUpItems(findings: ManagementLetterFinding[]): string {
    let content =
      '\n\nWe recommend that management establish a formal process to track the implementation of these recommendations. ';
    content +=
      'We would be pleased to assist in monitoring progress and providing additional guidance as needed.\n\n';

    content += '**Follow-up Actions:**\n';
    content += '• Assign responsibility for each recommendation to specific individuals\n';
    content += '• Establish target completion dates for all recommendations\n';
    content += '• Implement regular progress reporting to senior management and the board\n';
    content += '• Consider engaging external experts where specialized knowledge is required\n';
    content += '• Schedule periodic reviews to assess implementation progress\n\n';

    const openFindings = findings.filter((f) => f.status === 'open').length;
    if (openFindings > 0) {
      content += `We will follow up on the implementation of these ${openFindings} recommendation${openFindings > 1 ? 's' : ''} during our next engagement and report on progress made.\n\n`;
    }

    return content;
  }

  /**
   * Assess overall control environment
   */
  private assessControlEnvironment(
    findings: ManagementLetterFinding[]
  ): GeneratedManagementLetter['overallAssessment'] {
    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const highCount = findings.filter((f) => f.severity === 'high').length;
    const totalFindings = findings.length;

    // Determine control environment rating
    let rating: 'strong' | 'adequate' | 'needs_improvement' | 'weak';

    if (criticalCount > 0 || (highCount > criticalCount && totalFindings > 5)) {
      rating = 'weak';
    } else if (highCount > 0 || totalFindings > 3) {
      rating = 'needs_improvement';
    } else if (totalFindings > 0) {
      rating = 'adequate';
    } else {
      rating = 'strong';
    }

    // Identify key risk areas
    const riskAreas = [...new Set(findings.map((f) => this.formatCategory(f.category)))];

    // Generate priority recommendations
    const priorityRecommendations = findings
      .filter((f) => f.severity === 'critical' || f.severity === 'high')
      .slice(0, 5)
      .map((f) => this.extractKeyRecommendation(f.recommendation));

    // Generate positive observations
    const positiveObservations = [
      'Management demonstrated a commitment to addressing audit findings',
      'Existing financial reporting processes show evidence of proper oversight',
      'Key personnel displayed appropriate technical competence',
    ];

    return {
      controlEnvironmentRating: rating,
      keyRiskAreas: riskAreas,
      priorityRecommendations,
      positiveObservations,
    };
  }

  /**
   * Build template variables
   */
  private buildTemplateVariables(
    engagementData: any,
    section: ManagementLetterSection,
    additionalData?: Record<string, any>
  ): Record<string, any> {
    const currentDate = new Date();

    return {
      clientName: engagementData.clientName,
      periodEnd: new Date(engagementData.reportingPeriodEnd).toLocaleDateString('en-NG'),
      currentDate: currentDate.toLocaleDateString('en-NG'),
      engagementType: engagementData.engagementType,
      ...additionalData,
      ...section.templateVariables,
    };
  }

  /**
   * Utility methods
   */
  private formatCategory(category: string): string {
    type CategoryMap = {
      internal_control: string;
      compliance: string;
      operational: string;
      financial_reporting: string;
      governance: string;
      it_controls: string;
    };

    const categoryMap: CategoryMap = {
      internal_control: 'Internal Control',
      compliance: 'Compliance',
      operational: 'Operational',
      financial_reporting: 'Financial Reporting',
      governance: 'Governance',
      it_controls: 'IT Controls',
    };

    return (categoryMap as Record<string, string>)[category] || category;
  }

  private extractKeyRecommendation(recommendation: string): string {
    const sentences = recommendation.split('.');
    const firstSentence = sentences[0] || '';
    return firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence;
  }

  private generateLetterTitle(engagementData: any, template: ManagementLetterTemplate): string {
    const year = new Date(engagementData.reportingPeriodEnd).getFullYear();
    return `Management Letter - ${engagementData.clientName} - Year Ended December 31, ${year}`;
  }

  private calculateWordCount(summary: string, sections: ManagementLetterSection[]): number {
    const summaryWords = summary.split(/\s+/).length;
    const sectionWords = sections.reduce((total, section) => {
      return total + section.content.split(/\s+/).length;
    }, 0);
    return summaryWords + sectionWords;
  }

  /**
   * Load templates
   */
  private loadManagementLetterTemplates(): void {
    const standardTemplate: ManagementLetterTemplate = {
      id: 'standard_management_letter',
      name: 'Standard Management Letter',
      description: 'Standard template for annual management letters',
      letterType: 'annual',
      clientType: ['All'],
      sections: [
        {
          id: 'introduction',
          title: 'Introduction',
          content:
            'In connection with our audit of the financial statements of {{clientName}} for the year ended {{periodEnd}}, we identified certain matters that we believe warrant your attention. These observations are intended to assist management in strengthening internal controls and improving operational efficiency.',
          order: 1,
          isRequired: true,
          findingCategories: [],
          templateVariables: {},
        },
        {
          id: 'findings_detail',
          title: 'Detailed Findings and Recommendations',
          content:
            'The following sections present our detailed findings, along with recommendations for improvement:',
          order: 2,
          isRequired: true,
          findingCategories: ['all'],
          templateVariables: {},
        },
        {
          id: 'summary_of_recommendations',
          title: 'Summary of Recommendations',
          content:
            'To assist management in prioritizing the implementation of our recommendations, we have summarized the key actions below:',
          order: 3,
          isRequired: true,
          findingCategories: [],
          templateVariables: {},
        },
        {
          id: 'follow_up_items',
          title: 'Follow-up and Implementation',
          content:
            'We believe that implementing these recommendations will strengthen your control environment and enhance operational effectiveness.',
          order: 4,
          isRequired: true,
          findingCategories: [],
          templateVariables: {},
        },
      ],
      metadata: {
        version: '1.0',
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        author: 'System',
        complianceFrameworks: ['ISA', 'COSO'],
      },
    };

    this.templates.set(standardTemplate.id, standardTemplate);
  }

  private loadFindingTemplates(): void {
    // Segregation of Duties template
    this.findingTemplates.set('segregation_of_duties', {
      title: 'Inadequate Segregation of Duties',
      category: 'internal_control',
      severity: 'high',
      description: 'Insufficient segregation of duties in key financial processes',
      currentSituation:
        'Our review identified instances where the same individual performs incompatible functions within the financial reporting process.',
      risks: [
        'Increased risk of errors going undetected',
        'Higher likelihood of fraudulent activity',
        'Potential for unauthorized transactions',
        'Weakness in preventive controls',
      ],
      businessImpact:
        'This deficiency could result in material misstatements in financial reporting and increased risk of asset misappropriation.',
      recommendation:
        'Implement proper segregation of duties by separating authorization, recording, and custody functions. Where segregation is not practical due to limited staff, implement compensating controls such as management review and approval.',
    });

    // Documentation template
    this.findingTemplates.set('inadequate_documentation', {
      title: 'Inadequate Documentation of Key Processes',
      category: 'operational',
      severity: 'medium',
      description: 'Key business processes lack proper documentation',
      currentSituation:
        'Several critical business processes are not adequately documented, creating dependency on key personnel and increasing operational risk.',
      risks: [
        'Business disruption if key personnel are unavailable',
        'Inconsistent process execution',
        'Training difficulties for new staff',
        'Compliance risks',
      ],
      businessImpact:
        'Lack of documentation increases operational risk and may impact business continuity.',
      recommendation:
        'Develop comprehensive process documentation including flowcharts, procedures manuals, and checklists for all key business processes.',
    });
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): ManagementLetterTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get finding templates
   */
  getAvailableFindingTemplates(): Array<{
    id: string;
    template: Partial<ManagementLetterFinding>;
  }> {
    return Array.from(this.findingTemplates.entries()).map(([id, template]) => ({
      id,
      template,
    }));
  }

  /**
   * Validate management letter
   */
  validateManagementLetter(letter: GeneratedManagementLetter): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    completenessScore: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!letter.title) errors.push('Letter title is required');
    if (!letter.executiveSummary) errors.push('Executive summary is required');
    if (letter.findings.length === 0) warnings.push('No findings included in management letter');

    // Check for critical findings without management response
    const criticalWithoutResponse = letter.findings.filter(
      (f) => f.severity === 'critical' && !f.managementResponse
    );

    if (criticalWithoutResponse.length > 0) {
      warnings.push(
        `${criticalWithoutResponse.length} critical finding(s) lack management response`
      );
    }

    const completenessScore = Math.round(
      (letter.sections.length > 0 ? 25 : 0) +
        (letter.executiveSummary ? 25 : 0) +
        (letter.findings.length > 0 ? 25 : 0) +
        (letter.overallAssessment ? 25 : 0)
    );

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completenessScore,
    };
  }
}

/**
 * Export singleton instance
 */
export const managementLetterGenerator = new ManagementLetterGenerator();

/**
 * Utility functions
 */
export function categorizeFindings(
  findings: ManagementLetterFinding[]
): Record<string, ManagementLetterFinding[]> {
  return findings.reduce(
    (acc, finding) => {
      if (!acc[finding.category]) {
        acc[finding.category] = [];
      }
      acc[finding.category]!.push(finding); // Use non-null assertion since we just initialized it
      return acc;
    },
    {} as Record<string, ManagementLetterFinding[]>
  );
}

export function calculateImplementationEffort(findings: ManagementLetterFinding[]): {
  low: number;
  medium: number;
  high: number;
  total: number;
} {
  const effort = findings.reduce(
    (acc, finding) => {
      acc[finding.estimatedImplementationEffort]++;
      acc.total++;
      return acc;
    },
    { low: 0, medium: 0, high: 0, total: 0 }
  );

  return effort;
}

export function generateFindingSummary(findings: ManagementLetterFinding[]): {
  totalFindings: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  averagePriority: number;
} {
  const bySeverity = findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const byCategory = findings.reduce(
    (acc, f) => {
      acc[f.category] = (acc[f.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const byStatus = findings.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const averagePriority =
    findings.length > 0 ? findings.reduce((sum, f) => sum + f.priority, 0) / findings.length : 0;

  return {
    totalFindings: findings.length,
    bySeverity,
    byCategory,
    byStatus,
    averagePriority: Math.round(averagePriority * 100) / 100,
  };
}
