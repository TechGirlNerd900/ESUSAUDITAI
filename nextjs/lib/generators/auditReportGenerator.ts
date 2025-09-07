/**
 * Audit Report Generation System
 * Provides comprehensive audit report templates and automated content generation
 */

export interface AuditReportSection {
  id: string;
  title: string;
  content: string;
  order: number;
  isRequired: boolean;
  templateVariables: Record<string, any>;
  generatedContent?: string;
  wordCount?: number;
  lastUpdated: string;
}

export interface AuditReportTemplate {
  id: string;
  name: string;
  description: string;
  reportType: 'statutory' | 'management' | 'special' | 'interim' | 'compilation';
  auditStandard: 'ISA' | 'ASA' | 'PCAOB' | 'Nigerian';
  applicableEntities: string[];
  sections: AuditReportSection[];
  metadata: {
    version: string;
    createdDate: string;
    lastUpdated: string;
    author: string;
    approvedBy?: string;
    effectiveDate: string;
    complianceStandards: string[];
  };
}

export interface AuditEngagement {
  id: string;
  clientName: string;
  clientId: string;
  engagementType: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  auditStandard: string;
  entityType: string;
  significantMatters: string[];
  keyAuditMatters: string[];
  materialWeaknesses: string[];
  managementLetterPoints: string[];
  organizationId: string;
}

export interface GeneratedAuditReport {
  id: string;
  engagementId: string;
  templateId: string;
  reportType: string;
  title: string;
  sections: AuditReportSection[];
  metadata: {
    generatedAt: string;
    generatedBy: string;
    version: string;
    status: 'draft' | 'review' | 'approved' | 'issued';
    wordCount: number;
    pageCount: number;
  };
  auditOpinion: {
    type: 'unmodified' | 'qualified' | 'adverse' | 'disclaimer';
    basis: string;
    emphasisOfMatter?: string;
    otherMatter?: string;
  };
  keyFindings: {
    materialMisstatements: string[];
    internalControlDeficiencies: string[];
    complianceIssues: string[];
    goingConcernMatters: string[];
  };
  recommendations: string[];
  organizationId: string;
}

/**
 * Audit Report Generator Engine
 */
export class AuditReportGenerator {
  private templates: Map<string, AuditReportTemplate> = new Map();
  private standardPhrases: Map<string, string[]> = new Map();

  constructor() {
    this.loadStandardTemplates();
    this.loadStandardPhrases();
  }

  /**
   * Generate complete audit report from engagement data
   */
  async generateAuditReport(
    engagement: AuditEngagement,
    templateId: string,
    additionalData?: Record<string, any>
  ): Promise<GeneratedAuditReport> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    // Generate each section
    const generatedSections = await Promise.all(
      template.sections.map((section) => this.generateSection(section, engagement, additionalData))
    );

    // Determine audit opinion
    const auditOpinion = this.determineAuditOpinion(engagement);

    // Extract key findings
    const keyFindings = this.extractKeyFindings(engagement, additionalData);

    // Generate recommendations
    const recommendations = this.generateRecommendations(engagement, keyFindings);

    const report: GeneratedAuditReport = {
      id: `report_${engagement.id}_${Date.now()}`,
      engagementId: engagement.id,
      templateId: template.id,
      reportType: template.reportType,
      title: this.generateReportTitle(engagement, template),
      sections: generatedSections,
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
        version: '1.0',
        status: 'draft',
        wordCount: generatedSections.reduce((sum, section) => sum + (section.wordCount || 0), 0),
        pageCount: Math.ceil(
          generatedSections.reduce((sum, section) => sum + (section.wordCount || 0), 0) / 250
        ),
      },
      auditOpinion,
      keyFindings,
      recommendations,
      organizationId: engagement.organizationId,
    };

    return report;
  }

  /**
   * Generate individual report section
   */
  private async generateSection(
    section: AuditReportSection,
    engagement: AuditEngagement,
    additionalData?: Record<string, any>
  ): Promise<AuditReportSection> {
    let generatedContent = section.content;

    // Replace template variables
    const variables = this.buildTemplateVariables(engagement, section, additionalData);

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      generatedContent = generatedContent.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Apply intelligent content generation based on section type
    generatedContent = await this.enhanceContentWithAI(section.id, generatedContent, engagement);

    // Calculate word count
    const wordCount = generatedContent.split(/\s+/).length;

    return {
      ...section,
      generatedContent,
      wordCount,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Build template variables for content generation
   */
  private buildTemplateVariables(
    engagement: AuditEngagement,
    section: AuditReportSection,
    additionalData?: Record<string, any>
  ): Record<string, any> {
    const currentDate = new Date();
    const reportDate = currentDate.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      // Client information
      clientName: engagement.clientName,
      entityType: engagement.entityType,

      // Period information
      periodStart: new Date(engagement.reportingPeriodStart).toLocaleDateString('en-NG'),
      periodEnd: new Date(engagement.reportingPeriodEnd).toLocaleDateString('en-NG'),
      currentYear: new Date(engagement.reportingPeriodEnd).getFullYear(),
      priorYear: new Date(engagement.reportingPeriodEnd).getFullYear() - 1,

      // Report information
      reportDate,
      auditStandard: engagement.auditStandard,
      engagementType: engagement.engagementType,

      // Findings
      significantMattersCount: engagement.significantMatters.length,
      keyAuditMattersCount: engagement.keyAuditMatters.length,
      materialWeaknessesCount: engagement.materialWeaknesses.length,

      // Additional data
      ...additionalData,
      ...section.templateVariables,
    };
  }

  /**
   * Enhance content with AI-based generation
   */
  private async enhanceContentWithAI(
    sectionId: string,
    baseContent: string,
    engagement: AuditEngagement
  ): Promise<string> {
    // Section-specific enhancements
    switch (sectionId) {
      case 'executive_summary':
        return this.generateExecutiveSummary(engagement, baseContent);

      case 'audit_opinion':
        return this.generateAuditOpinion(engagement, baseContent);

      case 'key_audit_matters':
        return this.generateKeyAuditMatters(engagement, baseContent);

      case 'management_letter_points':
        return this.generateManagementLetterPoints(engagement, baseContent);

      case 'recommendations':
        return this.generateRecommendationsSection(engagement, baseContent);

      default:
        return baseContent;
    }
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(engagement: AuditEngagement, baseContent: string): string {
    const summaryPoints = [];

    // Add scope information
    summaryPoints.push(
      `We have audited the financial statements of ${engagement.clientName} for the year ended ${new Date(engagement.reportingPeriodEnd).toLocaleDateString('en-NG')}.`
    );

    // Add opinion summary
    if (engagement.materialWeaknesses.length === 0 && engagement.significantMatters.length === 0) {
      summaryPoints.push(
        'In our opinion, the financial statements present fairly, in all material respects, the financial position of the company.'
      );
    } else if (engagement.materialWeaknesses.length > 0) {
      summaryPoints.push(
        'Our audit identified certain material weaknesses in internal control that require management attention.'
      );
    }

    // Add key areas
    if (engagement.keyAuditMatters.length > 0) {
      summaryPoints.push(
        `We identified ${engagement.keyAuditMatters.length} key audit matter(s) that required special attention during our audit.`
      );
    }

    // Add recommendations note
    if (engagement.managementLetterPoints.length > 0) {
      summaryPoints.push(
        `We have provided ${engagement.managementLetterPoints.length} recommendations to strengthen internal controls and improve operational efficiency.`
      );
    }

    return baseContent + '\n\n' + summaryPoints.join(' ');
  }

  /**
   * Generate audit opinion section
   */
  private generateAuditOpinion(engagement: AuditEngagement, baseContent: string): string {
    const opinion = this.determineAuditOpinion(engagement);

    let opinionText = '';

    switch (opinion.type) {
      case 'unmodified':
        opinionText = `In our opinion, the financial statements present fairly, in all material respects, the financial position of ${engagement.clientName} as at ${new Date(engagement.reportingPeriodEnd).toLocaleDateString('en-NG')}, and its financial performance and cash flows for the year then ended in accordance with ${engagement.auditStandard === 'Nigerian' ? 'Financial Reporting Standards' : 'International Financial Reporting Standards'}.`;
        break;

      case 'qualified':
        opinionText = `In our opinion, except for the effects of the matter described in the Basis for Qualified Opinion section, the financial statements present fairly, in all material respects, the financial position of ${engagement.clientName}.`;
        break;

      case 'adverse':
        opinionText = `In our opinion, because of the significance of the matters described in the Basis for Adverse Opinion section, the financial statements do not present fairly the financial position of ${engagement.clientName}.`;
        break;

      case 'disclaimer':
        opinionText = `We do not express an opinion on the financial statements of ${engagement.clientName}. Because of the significance of the matters described in the Basis for Disclaimer of Opinion section, we were unable to obtain sufficient appropriate audit evidence.`;
        break;
    }

    return baseContent.replace('{{AUDIT_OPINION}}', opinionText);
  }

  /**
   * Generate key audit matters section
   */
  private generateKeyAuditMatters(engagement: AuditEngagement, baseContent: string): string {
    if (engagement.keyAuditMatters.length === 0) {
      return baseContent + '\n\nNo key audit matters were identified during our audit.';
    }

    let kamContent =
      '\n\nKey audit matters are those matters that, in our professional judgment, were of most significance in our audit:\n\n';

    engagement.keyAuditMatters.forEach((matter, index) => {
      kamContent += `${index + 1}. **${matter}**\n`;
      kamContent += `   This matter was significant to our audit because [specific reason related to ${matter}].\n`;
      kamContent += `   Our audit procedures included [relevant procedures for ${matter}].\n\n`;
    });

    return baseContent + kamContent;
  }

  /**
   * Generate management letter points section
   */
  private generateManagementLetterPoints(engagement: AuditEngagement, baseContent: string): string {
    if (engagement.managementLetterPoints.length === 0) {
      return (
        baseContent +
        '\n\nNo significant deficiencies in internal control were identified during our audit.'
      );
    }

    let mlContent = '\n\nDuring our audit, we identified the following areas for improvement:\n\n';

    engagement.managementLetterPoints.forEach((point, index) => {
      mlContent += `${index + 1}. **${point}**\n`;
      mlContent += `   Current Situation: [Description of current state]\n`;
      mlContent += `   Risk: [Potential risks if not addressed]\n`;
      mlContent += `   Recommendation: [Specific recommendation]\n`;
      mlContent += `   Management Response: [To be provided by management]\n\n`;
    });

    return baseContent + mlContent;
  }

  /**
   * Generate recommendations section
   */
  private generateRecommendationsSection(engagement: AuditEngagement, baseContent: string): string {
    const recommendations = this.generateRecommendations(
      engagement,
      this.extractKeyFindings(engagement)
    );

    if (recommendations.length === 0) {
      return baseContent + '\n\nNo specific recommendations are required at this time.';
    }

    let recContent = '\n\nBased on our audit findings, we recommend the following actions:\n\n';

    recommendations.forEach((rec, index) => {
      recContent += `${index + 1}. ${rec}\n\n`;
    });

    return baseContent + recContent;
  }

  /**
   * Determine audit opinion type
   */
  private determineAuditOpinion(engagement: AuditEngagement): GeneratedAuditReport['auditOpinion'] {
    // Logic to determine opinion type based on findings
    if (engagement.materialWeaknesses.length > 0) {
      return {
        type: 'qualified',
        basis: 'Material weaknesses in internal control were identified',
        emphasisOfMatter:
          engagement.significantMatters.length > 0 ? engagement.significantMatters[0] : undefined,
      };
    }

    if (
      engagement.significantMatters.some((matter) => matter.toLowerCase().includes('going concern'))
    ) {
      return {
        type: 'unmodified',
        basis: 'Financial statements are fairly presented',
        emphasisOfMatter: 'Material uncertainty related to going concern',
      };
    }

    return {
      type: 'unmodified',
      basis:
        'Financial statements are fairly presented in accordance with the applicable financial reporting framework',
    };
  }

  /**
   * Extract key findings from engagement
   */
  private extractKeyFindings(
    engagement: AuditEngagement,
    additionalData?: Record<string, any>
  ): GeneratedAuditReport['keyFindings'] {
    return {
      materialMisstatements: engagement.significantMatters.filter((matter) =>
        matter.toLowerCase().includes('misstatement')
      ),
      internalControlDeficiencies: engagement.materialWeaknesses,
      complianceIssues: engagement.significantMatters.filter((matter) =>
        matter.toLowerCase().includes('compliance')
      ),
      goingConcernMatters: engagement.significantMatters.filter((matter) =>
        matter.toLowerCase().includes('going concern')
      ),
    };
  }

  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(
    engagement: AuditEngagement,
    keyFindings: GeneratedAuditReport['keyFindings']
  ): string[] {
    const recommendations = [];

    // Internal control recommendations
    if (keyFindings.internalControlDeficiencies.length > 0) {
      recommendations.push(
        'Strengthen internal controls over financial reporting to prevent material misstatements'
      );
      recommendations.push('Implement regular monitoring and testing of key controls');
    }

    // Compliance recommendations
    if (keyFindings.complianceIssues.length > 0) {
      recommendations.push('Establish robust compliance monitoring procedures');
      recommendations.push('Provide regular training to staff on regulatory requirements');
    }

    // Going concern recommendations
    if (keyFindings.goingConcernMatters.length > 0) {
      recommendations.push('Develop detailed cash flow forecasts and contingency plans');
      recommendations.push('Consider additional financing options to ensure business continuity');
    }

    // Management letter specific recommendations
    engagement.managementLetterPoints.forEach((point) => {
      if (point.toLowerCase().includes('segregation')) {
        recommendations.push('Improve segregation of duties in critical financial processes');
      }
      if (point.toLowerCase().includes('documentation')) {
        recommendations.push('Enhance documentation of key business processes and controls');
      }
      if (point.toLowerCase().includes('authorization')) {
        recommendations.push('Strengthen authorization controls for significant transactions');
      }
    });

    return recommendations;
  }

  /**
   * Generate report title
   */
  private generateReportTitle(engagement: AuditEngagement, template: AuditReportTemplate): string {
    const year = new Date(engagement.reportingPeriodEnd).getFullYear();

    switch (template.reportType) {
      case 'statutory':
        return `Independent Auditor's Report on the Financial Statements of ${engagement.clientName} for the Year Ended December 31, ${year}`;

      case 'management':
        return `Management Letter for ${engagement.clientName} - Year Ended December 31, ${year}`;

      case 'special':
        return `Special Purpose Audit Report - ${engagement.clientName}`;

      case 'interim':
        return `Review Report on Interim Financial Statements of ${engagement.clientName}`;

      default:
        return `Audit Report - ${engagement.clientName} - ${year}`;
    }
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): AuditReportTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): AuditReportTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Validate report completeness
   */
  validateReport(report: GeneratedAuditReport): {
    isComplete: boolean;
    missingRequiredSections: string[];
    warnings: string[];
    completenessScore: number;
  } {
    const template = this.templates.get(report.templateId);
    if (!template) {
      return {
        isComplete: false,
        missingRequiredSections: ['Template not found'],
        warnings: [],
        completenessScore: 0,
      };
    }

    const missingRequiredSections = template.sections
      .filter((section) => section.isRequired)
      .filter((section) => !report.sections.find((rs) => rs.id === section.id)?.generatedContent)
      .map((section) => section.title);

    const warnings = [];

    // Check word count
    if (report.metadata.wordCount < 500) {
      warnings.push('Report appears to be too short (< 500 words)');
    }

    // Check audit opinion
    if (!report.auditOpinion.basis) {
      warnings.push('Audit opinion basis is not specified');
    }

    // Check for placeholder text
    const hasPlaceholders = report.sections.some(
      (section) =>
        section.generatedContent?.includes('{{') || section.generatedContent?.includes('}}')
    );

    if (hasPlaceholders) {
      warnings.push('Report contains unreplaced template variables');
    }

    const completenessScore = Math.round(
      ((template.sections.length - missingRequiredSections.length) / template.sections.length) * 100
    );

    return {
      isComplete: missingRequiredSections.length === 0,
      missingRequiredSections,
      warnings,
      completenessScore,
    };
  }

  /**
   * Load standard templates
   */
  private loadStandardTemplates(): void {
    // Nigerian Statutory Audit Report Template
    const nigerianStatutoryTemplate: AuditReportTemplate = {
      id: 'nigerian_statutory_audit',
      name: 'Nigerian Statutory Audit Report',
      description: 'Standard statutory audit report template for Nigerian companies',
      reportType: 'statutory',
      auditStandard: 'Nigerian',
      applicableEntities: ['Public Company', 'Private Company', 'SME'],
      sections: [
        {
          id: 'title_page',
          title: 'Title Page',
          content: "INDEPENDENT AUDITOR'S REPORT\n\nTo the Members of {{clientName}}",
          order: 1,
          isRequired: true,
          templateVariables: {},
          lastUpdated: new Date().toISOString(),
        },
        {
          id: 'opinion',
          title: 'Opinion',
          content: '{{AUDIT_OPINION}}',
          order: 2,
          isRequired: true,
          templateVariables: {},
          lastUpdated: new Date().toISOString(),
        },
        {
          id: 'basis_for_opinion',
          title: 'Basis for Opinion',
          content:
            "We conducted our audit in accordance with International Standards on Auditing (ISAs). Our responsibilities under those standards are further described in the Auditor's Responsibilities section of our report.",
          order: 3,
          isRequired: true,
          templateVariables: {},
          lastUpdated: new Date().toISOString(),
        },
        {
          id: 'key_audit_matters',
          title: 'Key Audit Matters',
          content:
            'Key audit matters are those matters that, in our professional judgment, were of most significance in our audit of the financial statements.',
          order: 4,
          isRequired: false,
          templateVariables: {},
          lastUpdated: new Date().toISOString(),
        },
        {
          id: 'responsibilities',
          title: 'Responsibilities of Management and Auditor',
          content:
            'Management is responsible for the preparation and fair presentation of the financial statements in accordance with Financial Reporting Standards, and for such internal control as management determines is necessary.',
          order: 5,
          isRequired: true,
          templateVariables: {},
          lastUpdated: new Date().toISOString(),
        },
      ],
      metadata: {
        version: '1.0',
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        author: 'System',
        effectiveDate: '2025-01-01',
        complianceStandards: ['ISA', 'FRS', 'CAMA 2020'],
      },
    };

    this.templates.set(nigerianStatutoryTemplate.id, nigerianStatutoryTemplate);

    // Management Letter Template
    const managementLetterTemplate: AuditReportTemplate = {
      id: 'management_letter',
      name: 'Management Letter Template',
      description: 'Standard management letter template for internal control recommendations',
      reportType: 'management',
      auditStandard: 'ISA',
      applicableEntities: ['All'],
      sections: [
        {
          id: 'introduction',
          title: 'Introduction',
          content:
            'In connection with our audit of the financial statements of {{clientName}} for the year ended {{periodEnd}}, we identified certain matters that we believe warrant your attention.',
          order: 1,
          isRequired: true,
          templateVariables: {},
          lastUpdated: new Date().toISOString(),
        },
        {
          id: 'executive_summary',
          title: 'Executive Summary',
          content:
            'This management letter summarizes our observations and recommendations arising from our audit.',
          order: 2,
          isRequired: true,
          templateVariables: {},
          lastUpdated: new Date().toISOString(),
        },
        {
          id: 'findings_and_recommendations',
          title: 'Findings and Recommendations',
          content:
            'Based on our audit procedures, we have identified the following areas for improvement:',
          order: 3,
          isRequired: true,
          templateVariables: {},
          lastUpdated: new Date().toISOString(),
        },
        {
          id: 'conclusion',
          title: 'Conclusion',
          content:
            'We believe that implementing these recommendations will strengthen your internal control environment and improve operational efficiency.',
          order: 4,
          isRequired: true,
          templateVariables: {},
          lastUpdated: new Date().toISOString(),
        },
      ],
      metadata: {
        version: '1.0',
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        author: 'System',
        effectiveDate: '2025-01-01',
        complianceStandards: ['ISA'],
      },
    };

    this.templates.set(managementLetterTemplate.id, managementLetterTemplate);
  }

  /**
   * Load standard phrases
   */
  private loadStandardPhrases(): void {
    this.standardPhrases.set('unmodified_opinion', [
      'In our opinion, the financial statements present fairly, in all material respects',
      'The financial statements give a true and fair view',
      'We have obtained sufficient appropriate audit evidence',
    ]);

    this.standardPhrases.set('qualified_opinion', [
      'In our opinion, except for the effects of the matter described',
      'Except for the possible effects of the matter described',
      'Subject to the matter described in the Basis for Qualified Opinion section',
    ]);

    this.standardPhrases.set('management_responsibilities', [
      'Management is responsible for the preparation and fair presentation',
      'Management is responsible for such internal control as management determines',
      "Management is responsible for assessing the entity's ability to continue as a going concern",
    ]);
  }
}

/**
 * Export singleton instance
 */
export const auditReportGenerator = new AuditReportGenerator();

/**
 * Utility functions
 */
export function formatAuditReportForPDF(report: GeneratedAuditReport): string {
  let pdfContent = '';

  // Add title
  pdfContent += `# ${report.title}\n\n`;

  // Add metadata
  pdfContent += `**Generated:** ${new Date(report.metadata.generatedAt).toLocaleDateString('en-NG')}\n`;
  pdfContent += `**Status:** ${report.metadata.status.toUpperCase()}\n`;
  pdfContent += `**Version:** ${report.metadata.version}\n\n`;

  // Add sections in order
  report.sections
    .sort((a, b) => a.order - b.order)
    .forEach((section) => {
      pdfContent += `## ${section.title}\n\n`;
      pdfContent += `${section.generatedContent || section.content}\n\n`;
    });

  return pdfContent;
}

export function generateReportSummary(report: GeneratedAuditReport): {
  totalSections: number;
  completedSections: number;
  wordCount: number;
  pageCount: number;
  opinionType: string;
  keyFindingsCount: number;
  recommendationsCount: number;
} {
  return {
    totalSections: report.sections.length,
    completedSections: report.sections.filter((s) => s.generatedContent).length,
    wordCount: report.metadata.wordCount,
    pageCount: report.metadata.pageCount,
    opinionType: report.auditOpinion.type,
    keyFindingsCount: Object.values(report.keyFindings).flat().length,
    recommendationsCount: report.recommendations.length,
  };
}
