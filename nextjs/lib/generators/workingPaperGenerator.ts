/**
 * Working Paper Generator System
 * Provides comprehensive working paper templates and automated generation
 */

export interface WorkingPaperTemplate {
  id: string;
  name: string;
  description: string;
  category:
    | 'analytical'
    | 'substantive'
    | 'compliance'
    | 'internal_control'
    | 'financial_statement'
    | 'documentation';
  auditArea: string;
  sections: WorkingPaperSection[];
  requiredFields: string[];
  optionalFields: string[];
  metadata: {
    version: string;
    createdDate: string;
    lastUpdated: string;
    author: string;
    applicableStandards: string[];
  };
}

export interface WorkingPaperSection {
  id: string;
  title: string;
  content: string;
  sectionType:
    | 'objective'
    | 'procedure'
    | 'finding'
    | 'conclusion'
    | 'evidence'
    | 'calculation'
    | 'analysis';
  order: number;
  isRequired: boolean;
  instructions: string;
  templateVariables: Record<string, any>;
  validationRules?: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'numeric' | 'date' | 'percentage' | 'currency' | 'custom';
  rule: string;
  message: string;
}

export interface WorkingPaperData {
  id: string;
  templateId: string;
  engagementId: string;
  title: string;
  auditArea: string;
  accountsInScope: string[];

  // Working paper content
  objective: string;
  procedures: AuditProcedure[];
  findings: WorkingPaperFinding[];
  conclusion: string;

  // Audit evidence
  evidenceReferences: EvidenceReference[];
  supportingDocuments: string[];

  // Review and completion
  preparedBy: string;
  reviewedBy?: string | undefined;  // Make explicitly optional
  completionStatus: 'draft' | 'complete' | 'reviewed' | 'approved';

  // Metadata
  workingPaperReference: string;
  dateCompleted?: string | undefined;  // Make explicitly optional
  hoursSpent: number;
  organizationId: string;
}

export interface AuditProcedure {
  id: string;
  description: string;
  type:
    | 'analytical'
    | 'substantive'
    | 'test_of_controls'
    | 'inquiry'
    | 'observation'
    | 'inspection';
  status: 'not_started' | 'in_progress' | 'complete' | 'not_applicable';
  result: string;
  exceptions: string[];
  evidenceObtained: string[];
  performedBy: string;
  datePerformed?: string;
  notes: string;
}

export interface WorkingPaperFinding {
  id: string;
  description: string;
  type: 'deficiency' | 'exception' | 'observation' | 'recommendation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  recommendation: string;
  managementResponse?: string;
  followUpRequired: boolean;
  resolved: boolean;
}

export interface EvidenceReference {
  id: string;
  description: string;
  type: 'document' | 'calculation' | 'confirmation' | 'observation' | 'inquiry';
  source: string;
  dateObtained: string;
  preparedBy: string;
  fileReference?: string;
  notes: string;
}

export interface GeneratedWorkingPaper {
  id: string;
  templateId: string;
  engagementId: string;
  title: string;
  workingPaperReference: string;
  sections: WorkingPaperSection[];
  data: WorkingPaperData;
  metadata: {
    generatedAt: string;
    generatedBy: string;
    version: string;
    status: 'draft' | 'complete' | 'reviewed' | 'approved';
    pageCount: number;
    wordCount: number;
  };
  organizationId: string;
}

/**
 * Working Paper Generator Engine
 */
export class WorkingPaperGenerator {
  private templates: Map<string, WorkingPaperTemplate> = new Map();
  private referenceCounter: Map<string, number> = new Map();

  constructor() {
    this.loadWorkingPaperTemplates();
  }

  /**
   * Generate working paper from template and data
   */
  async generateWorkingPaper(
    templateId: string,
    engagementData: any,
    workingPaperData: Partial<WorkingPaperData>,
    additionalData?: Record<string, any>
  ): Promise<GeneratedWorkingPaper> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    // Generate working paper reference
    const reference = this.generateWorkingPaperReference(
      engagementData.clientName,
      template.auditArea,
      engagementData.reportingPeriodEnd
    );

    // Validate required data
    this.validateWorkingPaperData(template, workingPaperData);

    // Generate sections with content
    const generatedSections = await Promise.all(
      template.sections.map((section) =>
        this.generateSection(section, workingPaperData, engagementData, additionalData)
      )
    );

    // Build complete working paper data
    const completeData: WorkingPaperData = {
      id: workingPaperData.id || `wp_${Date.now()}`,
      templateId: template.id,
      engagementId: engagementData.id,
      title: workingPaperData.title || this.generateWorkingPaperTitle(template, engagementData),
      auditArea: template.auditArea,
      accountsInScope: workingPaperData.accountsInScope || [],
      objective: workingPaperData.objective || this.generateDefaultObjective(template),
      procedures: workingPaperData.procedures || this.generateDefaultProcedures(template),
      findings: workingPaperData.findings || [],
      conclusion: workingPaperData.conclusion || '',
      evidenceReferences: workingPaperData.evidenceReferences || [],
      supportingDocuments: workingPaperData.supportingDocuments || [],
      preparedBy: workingPaperData.preparedBy || 'system',
      reviewedBy: workingPaperData.reviewedBy,
      completionStatus: workingPaperData.completionStatus || 'draft',
      workingPaperReference: reference,
      dateCompleted: workingPaperData.dateCompleted,
      hoursSpent: workingPaperData.hoursSpent || 0,
      organizationId: engagementData.organizationId,
    };

    const workingPaper: GeneratedWorkingPaper = {
      id: completeData.id,
      templateId: template.id,
      engagementId: engagementData.id,
      title: completeData.title,
      workingPaperReference: reference,
      sections: generatedSections,
      data: completeData,
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
        version: '1.0',
        status: 'draft',
        pageCount: this.calculatePageCount(generatedSections),
        wordCount: this.calculateWordCount(generatedSections),
      },
      organizationId: engagementData.organizationId,
    };

    return workingPaper;
  }

  /**
   * Generate working paper section
   */
  private async generateSection(
    section: WorkingPaperSection,
    workingPaperData: Partial<WorkingPaperData>,
    engagementData: any,
    additionalData?: Record<string, any>
  ): Promise<WorkingPaperSection> {
    let generatedContent = section.content;

    // Replace template variables
    const variables = this.buildTemplateVariables(
      workingPaperData,
      engagementData,
      section,
      additionalData
    );

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      generatedContent = generatedContent.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Add section-specific content
    generatedContent = await this.enhanceContentByType(
      section.sectionType,
      generatedContent,
      workingPaperData
    );

    return {
      ...section,
      content: generatedContent,
    };
  }

  /**
   * Enhance content based on section type
   */
  private async enhanceContentByType(
    sectionType: WorkingPaperSection['sectionType'],
    baseContent: string,
    workingPaperData: Partial<WorkingPaperData>
  ): Promise<string> {
    switch (sectionType) {
      case 'objective':
        return this.generateObjectiveContent(baseContent, workingPaperData);

      case 'procedure':
        return this.generateProcedureContent(baseContent, workingPaperData);

      case 'finding':
        return this.generateFindingContent(baseContent, workingPaperData);

      case 'conclusion':
        return this.generateConclusionContent(baseContent, workingPaperData);

      case 'evidence':
        return this.generateEvidenceContent(baseContent, workingPaperData);

      case 'calculation':
        return this.generateCalculationContent(baseContent, workingPaperData);

      case 'analysis':
        return this.generateAnalysisContent(baseContent, workingPaperData);

      default:
        return baseContent;
    }
  }

  /**
   * Generate objective content
   */
  private generateObjectiveContent(baseContent: string, data: Partial<WorkingPaperData>): string {
    if (data.objective) {
      return baseContent + '\n\n' + data.objective;
    }
    return baseContent;
  }

  /**
   * Generate procedure content
   */
  private generateProcedureContent(baseContent: string, data: Partial<WorkingPaperData>): string {
    if (!data.procedures || data.procedures.length === 0) {
      return baseContent;
    }

    let procedureContent = baseContent + '\n\n**Audit Procedures Performed:**\n\n';

    data.procedures.forEach((procedure, index) => {
      procedureContent += `${index + 1}. **${procedure.description}**\n`;
      procedureContent += `   - Type: ${this.formatProcedureType(procedure.type)}\n`;
      procedureContent += `   - Status: ${this.formatStatus(procedure.status)}\n`;
      procedureContent += `   - Performed by: ${procedure.performedBy}\n`;

      if (procedure.datePerformed) {
        procedureContent += `   - Date performed: ${new Date(procedure.datePerformed).toLocaleDateString('en-NG')}\n`;
      }

      if (procedure.result) {
        procedureContent += `   - Result: ${procedure.result}\n`;
      }

      if (procedure.exceptions.length > 0) {
        procedureContent += `   - Exceptions: ${procedure.exceptions.join(', ')}\n`;
      }

      if (procedure.notes) {
        procedureContent += `   - Notes: ${procedure.notes}\n`;
      }

      procedureContent += '\n';
    });

    return procedureContent;
  }

  /**
   * Generate finding content
   */
  private generateFindingContent(baseContent: string, data: Partial<WorkingPaperData>): string {
    if (!data.findings || data.findings.length === 0) {
      return baseContent + '\n\nNo significant findings identified.';
    }

    let findingContent = baseContent + '\n\n**Findings:**\n\n';

    data.findings.forEach((finding, index) => {
      findingContent += `${index + 1}. **${finding.description}**\n`;
      findingContent += `   - Type: ${finding.type}\n`;
      findingContent += `   - Severity: ${finding.severity.toUpperCase()}\n`;
      findingContent += `   - Impact: ${finding.impact}\n`;
      findingContent += `   - Recommendation: ${finding.recommendation}\n`;

      if (finding.managementResponse) {
        findingContent += `   - Management Response: ${finding.managementResponse}\n`;
      }

      findingContent += `   - Follow-up Required: ${finding.followUpRequired ? 'Yes' : 'No'}\n`;
      findingContent += `   - Status: ${finding.resolved ? 'Resolved' : 'Open'}\n\n`;
    });

    return findingContent;
  }

  /**
   * Generate conclusion content
   */
  private generateConclusionContent(baseContent: string, data: Partial<WorkingPaperData>): string {
    let conclusionContent = baseContent;

    if (data.conclusion) {
      conclusionContent += '\n\n' + data.conclusion;
    } else {
      // Generate default conclusion based on findings
      const hasFindings = data.findings && data.findings.length > 0;
      const hasCriticalFindings = data.findings?.some((f) => f.severity === 'critical');

      if (hasCriticalFindings) {
        conclusionContent +=
          '\n\nBased on our procedures, we identified critical issues that require immediate attention. See findings section for details.';
      } else if (hasFindings) {
        conclusionContent +=
          '\n\nBased on our procedures, we identified areas for improvement. See findings section for recommendations.';
      } else {
        conclusionContent +=
          '\n\nBased on our procedures, no significant issues were identified in this area.';
      }
    }

    return conclusionContent;
  }

  /**
   * Generate evidence content
   */
  private generateEvidenceContent(baseContent: string, data: Partial<WorkingPaperData>): string {
    if (!data.evidenceReferences || data.evidenceReferences.length === 0) {
      return baseContent;
    }

    let evidenceContent = baseContent + '\n\n**Evidence Obtained:**\n\n';

    data.evidenceReferences.forEach((evidence, index) => {
      evidenceContent += `${index + 1}. **${evidence.description}**\n`;
      evidenceContent += `   - Type: ${evidence.type}\n`;
      evidenceContent += `   - Source: ${evidence.source}\n`;
      evidenceContent += `   - Date obtained: ${new Date(evidence.dateObtained).toLocaleDateString('en-NG')}\n`;
      evidenceContent += `   - Prepared by: ${evidence.preparedBy}\n`;

      if (evidence.fileReference) {
        evidenceContent += `   - File reference: ${evidence.fileReference}\n`;
      }

      if (evidence.notes) {
        evidenceContent += `   - Notes: ${evidence.notes}\n`;
      }

      evidenceContent += '\n';
    });

    return evidenceContent;
  }

  /**
   * Generate calculation content
   */
  private generateCalculationContent(baseContent: string, data: Partial<WorkingPaperData>): string {
    // This would contain specific calculation logic based on the working paper type
    return (
      baseContent +
      '\n\n[Calculations would be inserted here based on the specific working paper type]'
    );
  }

  /**
   * Generate analysis content
   */
  private generateAnalysisContent(baseContent: string, data: Partial<WorkingPaperData>): string {
    // This would contain analytical procedures and analysis
    return (
      baseContent +
      '\n\n[Analysis content would be inserted here based on the specific working paper type]'
    );
  }

  /**
   * Generate working paper reference
   */
  private generateWorkingPaperReference(
    clientName: string,
    auditArea: string,
    periodEnd: string
  ): string {
    const year = new Date(periodEnd).getFullYear();
    const clientCode = clientName.substring(0, 4).toUpperCase();
    const areaCode = auditArea.substring(0, 2).toUpperCase();

    // Get and increment counter for this client/area combination
    const counterKey = `${clientCode}_${areaCode}_${year}`;
    const counter = (this.referenceCounter.get(counterKey) || 0) + 1;
    this.referenceCounter.set(counterKey, counter);

    return `${clientCode}-${areaCode}-${year}-${counter.toString().padStart(3, '0')}`;
  }

  /**
   * Validate working paper data against template requirements
   */
  private validateWorkingPaperData(
    template: WorkingPaperTemplate,
    data: Partial<WorkingPaperData>
  ): void {
    const missing = template.requiredFields.filter(
      (field) => !data[field as keyof WorkingPaperData]
    );

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Apply section-specific validation rules
    template.sections.forEach((section) => {
      if (section.validationRules) {
        section.validationRules.forEach((rule) => {
          this.applyValidationRule(rule, data);
        });
      }
    });
  }

  /**
   * Apply validation rule
   */
  private applyValidationRule(rule: ValidationRule, data: Partial<WorkingPaperData>): void {
    const value = data[rule.field as keyof WorkingPaperData];

    switch (rule.type) {
      case 'required':
        if (!value) {
          throw new Error(rule.message);
        }
        break;

      case 'numeric':
        if (isNaN(Number(value))) {
          throw new Error(rule.message);
        }
        break;

      case 'date':
        if (value && isNaN(Date.parse(value.toString()))) {
          throw new Error(rule.message);
        }
        break;

      case 'custom':
        // Custom validation logic would be implemented here
        break;
    }
  }

  /**
   * Generate default objective
   */
  private generateDefaultObjective(template: WorkingPaperTemplate): string {
    return `To test the accuracy and completeness of ${template.auditArea} as presented in the financial statements.`;
  }

  /**
   * Generate default procedures
   */
  private generateDefaultProcedures(template: WorkingPaperTemplate): AuditProcedure[] {
    const defaultProcedures = [
      {
        id: 'proc_1',
        description: `Review ${template.auditArea} account activity`,
        type: 'analytical' as const,
        status: 'not_started' as const,
        result: '',
        exceptions: [],
        evidenceObtained: [],
        performedBy: '',
        notes: '',
      },
    ];

    return defaultProcedures;
  }

  /**
   * Build template variables
   */
  private buildTemplateVariables(
    workingPaperData: Partial<WorkingPaperData>,
    engagementData: any,
    section: WorkingPaperSection,
    additionalData?: Record<string, any>
  ): Record<string, any> {
    return {
      clientName: engagementData.clientName,
      auditArea: workingPaperData.auditArea,
      periodEnd: new Date(engagementData.reportingPeriodEnd).toLocaleDateString('en-NG'),
      preparedBy: workingPaperData.preparedBy,
      workingPaperReference: workingPaperData.workingPaperReference,
      currentDate: new Date().toLocaleDateString('en-NG'),
      ...additionalData,
      ...section.templateVariables,
    };
  }

  /**
   * Generate working paper title
   */
  private generateWorkingPaperTitle(template: WorkingPaperTemplate, engagementData: any): string {
    return `${template.name} - ${engagementData.clientName} - ${new Date(engagementData.reportingPeriodEnd).getFullYear()}`;
  }

  /**
   * Calculate page count (estimate)
   */
  private calculatePageCount(sections: WorkingPaperSection[]): number {
    const totalWords = this.calculateWordCount(sections);
    return Math.ceil(totalWords / 250); // Assuming 250 words per page
  }

  /**
   * Calculate word count
   */
  private calculateWordCount(sections: WorkingPaperSection[]): number {
    return sections.reduce((total, section) => {
      return total + section.content.split(/\s+/).length;
    }, 0);
  }

  /**
   * Utility formatting methods
   */
  private formatProcedureType(type: string): string {
    const typeMap: Record<string, string> = {
      analytical: 'Analytical Procedure',
      substantive: 'Substantive Test',
      test_of_controls: 'Test of Controls',
      inquiry: 'Inquiry',
      observation: 'Observation',
      inspection: 'Inspection',
    };
    return typeMap[type] || type;
  }

  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      not_started: 'Not Started',
      in_progress: 'In Progress',
      complete: 'Complete',
      not_applicable: 'Not Applicable',
    };
    return statusMap[status] || status;
  }

  /**
   * Load working paper templates
   */
  private loadWorkingPaperTemplates(): void {
    // Cash and Bank Working Paper Template
    const cashTemplate: WorkingPaperTemplate = {
      id: 'cash_and_bank_wp',
      name: 'Cash and Bank Working Paper',
      description: 'Working paper for testing cash and bank balances',
      category: 'substantive',
      auditArea: 'Cash and Bank',
      sections: [
        {
          id: 'objective',
          title: 'Audit Objective',
          content:
            'To verify the existence, accuracy, and completeness of cash and bank balances as at {{periodEnd}}.',
          sectionType: 'objective',
          order: 1,
          isRequired: true,
          instructions: 'State the specific objectives for this working paper',
          templateVariables: {},
        },
        {
          id: 'procedures',
          title: 'Audit Procedures',
          content: 'The following procedures were performed:',
          sectionType: 'procedure',
          order: 2,
          isRequired: true,
          instructions: 'Document all procedures performed',
          templateVariables: {},
        },
        {
          id: 'findings',
          title: 'Findings and Exceptions',
          content: 'Based on our procedures, the following findings were identified:',
          sectionType: 'finding',
          order: 3,
          isRequired: false,
          instructions: 'Document any exceptions or findings',
          templateVariables: {},
        },
        {
          id: 'conclusion',
          title: 'Conclusion',
          content: 'Based on the procedures performed:',
          sectionType: 'conclusion',
          order: 4,
          isRequired: true,
          instructions: 'Provide conclusion on the audit objective',
          templateVariables: {},
        },
      ],
      requiredFields: ['objective', 'procedures'],
      optionalFields: ['findings', 'conclusion'],
      metadata: {
        version: '1.0',
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        author: 'System',
        applicableStandards: ['ISA 500', 'ISA 505'],
      },
    };

    this.templates.set(cashTemplate.id, cashTemplate);

    // Accounts Receivable Working Paper Template
    const receivablesTemplate: WorkingPaperTemplate = {
      id: 'accounts_receivable_wp',
      name: 'Accounts Receivable Working Paper',
      description: 'Working paper for testing accounts receivable balances',
      category: 'substantive',
      auditArea: 'Accounts Receivable',
      sections: [
        {
          id: 'objective',
          title: 'Audit Objective',
          content:
            'To verify the existence, valuation, and collectibility of accounts receivable as at {{periodEnd}}.',
          sectionType: 'objective',
          order: 1,
          isRequired: true,
          instructions: 'State the specific objectives for accounts receivable testing',
          templateVariables: {},
        },
        {
          id: 'procedures',
          title: 'Audit Procedures',
          content: 'The following procedures were performed:',
          sectionType: 'procedure',
          order: 2,
          isRequired: true,
          instructions: 'Document procedures for receivables testing',
          templateVariables: {},
        },
        {
          id: 'analysis',
          title: 'Aging Analysis',
          content: 'Analysis of accounts receivable aging:',
          sectionType: 'analysis',
          order: 3,
          isRequired: true,
          instructions: 'Perform aging analysis of receivables',
          templateVariables: {},
        },
        {
          id: 'findings',
          title: 'Findings and Exceptions',
          content: 'Based on our procedures, the following findings were identified:',
          sectionType: 'finding',
          order: 4,
          isRequired: false,
          instructions: 'Document any exceptions or findings',
          templateVariables: {},
        },
        {
          id: 'conclusion',
          title: 'Conclusion',
          content: 'Based on the procedures performed:',
          sectionType: 'conclusion',
          order: 5,
          isRequired: true,
          instructions: 'Provide conclusion on receivables testing',
          templateVariables: {},
        },
      ],
      requiredFields: ['objective', 'procedures'],
      optionalFields: ['findings', 'conclusion'],
      metadata: {
        version: '1.0',
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        author: 'System',
        applicableStandards: ['ISA 500', 'ISA 505', 'ISA 540'],
      },
    };

    this.templates.set(receivablesTemplate.id, receivablesTemplate);
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): WorkingPaperTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): WorkingPaperTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Validate working paper completeness
   */
  validateWorkingPaper(workingPaper: GeneratedWorkingPaper): {
    isComplete: boolean;
    missingItems: string[];
    warnings: string[];
    completenessScore: number;
  } {
    const missingItems: string[] = [];
    const warnings: string[] = [];

    // Check required sections
    const template = this.templates.get(workingPaper.templateId);
    if (template) {
      const requiredSections = template.sections.filter((s) => s.isRequired);
      const missingSections = requiredSections.filter(
        (rs) => !workingPaper.sections.find((ws) => ws.id === rs.id)?.content
      );

      missingSections.forEach((section) => {
        missingItems.push(`Missing content for required section: ${section.title}`);
      });
    }

    // Check data completeness
    if (!workingPaper.data.objective) {
      missingItems.push('Audit objective not specified');
    }

    if (!workingPaper.data.procedures || workingPaper.data.procedures.length === 0) {
      missingItems.push('No audit procedures documented');
    }

    if (!workingPaper.data.conclusion) {
      warnings.push('Conclusion section is empty');
    }

    if (!workingPaper.data.reviewedBy) {
      warnings.push('Working paper has not been reviewed');
    }

    const completenessScore = Math.round(
      (workingPaper.sections.length > 0 ? 25 : 0) +
        (workingPaper.data.objective ? 25 : 0) +
        (workingPaper.data.procedures.length > 0 ? 25 : 0) +
        (workingPaper.data.conclusion ? 25 : 0)
    );

    return {
      isComplete: missingItems.length === 0,
      missingItems,
      warnings,
      completenessScore,
    };
  }
}

/**
 * Export singleton instance
 */
export const workingPaperGenerator = new WorkingPaperGenerator();

/**
 * Utility functions
 */
export function categorizeWorkingPapers(
  workingPapers: GeneratedWorkingPaper[]
): Record<string, GeneratedWorkingPaper[]> {
  return workingPapers.reduce(
    (acc, wp) => {
      const template = workingPaperGenerator.getTemplate(wp.templateId);
      const category = template?.category || 'other';

      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(wp);
      return acc;
    },
    {} as Record<string, GeneratedWorkingPaper[]>
  );
}

export function calculateWorkingPaperStats(workingPapers: GeneratedWorkingPaper[]): {
  totalPapers: number;
  byStatus: Record<string, number>;
  totalHours: number;
  averageCompleteness: number;
  totalPages: number;
} {
  const byStatus = workingPapers.reduce(
    (acc, wp) => {
      acc[wp.metadata.status] = (acc[wp.metadata.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalHours = workingPapers.reduce((sum, wp) => sum + wp.data.hoursSpent, 0);
  const totalPages = workingPapers.reduce((sum, wp) => sum + wp.metadata.pageCount, 0);

  const completenessScores = workingPapers.map((wp) => {
    const validation = workingPaperGenerator.validateWorkingPaper(wp);
    return validation.completenessScore;
  });

  const averageCompleteness =
    completenessScores.length > 0
      ? Math.round(
          completenessScores.reduce((sum, score) => sum + score, 0) / completenessScores.length
        )
      : 0;

  return {
    totalPapers: workingPapers.length,
    byStatus,
    totalHours,
    averageCompleteness,
    totalPages,
  };
}
