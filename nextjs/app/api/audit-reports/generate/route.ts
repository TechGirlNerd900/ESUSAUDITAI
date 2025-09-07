import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  auditReportGenerator,
  AuditEngagement,
  GeneratedAuditReport,
  formatAuditReportForPDF,
  generateReportSummary,
} from '@/lib/generators/auditReportGenerator';

/**
 * Audit Report Generation API
 * Handles audit report creation, templates, and automated content generation
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
      case 'templates':
        return await handleGetTemplates();

      case 'reports':
        return await handleListReports(supabase, organizationId);

      case 'report': {
        const reportId = searchParams.get('reportId');
        if (!reportId) {
          return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
        }
        return await handleGetReport(supabase, reportId, organizationId);
      }

      case 'engagements':
        return await handleListEngagements(supabase, organizationId);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Audit report API error:', error);
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
      case 'generate':
        return await handleGenerateReport(supabase, body, user.id);

      case 'createEngagement':
        return await handleCreateEngagement(supabase, body, user.id);

      case 'validate':
        return await handleValidateReport(body);

      case 'export':
        return await handleExportReport(supabase, body, organizationId);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Audit report POST error:', error);
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
    const { reportId, updates, organizationId } = body;

    if (!reportId || !organizationId) {
      return NextResponse.json(
        { error: 'Report ID and Organization ID required' },
        { status: 400 }
      );
    }

    return await handleUpdateReport(supabase, reportId, updates, organizationId, user.id);
  } catch (error) {
    console.error('Audit report PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handler Functions
 */

async function handleGetTemplates() {
  const templates = auditReportGenerator.getAvailableTemplates();

  return NextResponse.json({
    success: true,
    data: {
      templates,
      total: templates.length,
    },
  });
}

async function handleListReports(supabase: any, organizationId: string) {
  const { data: reports, error } = await supabase
    .from('audit_reports')
    .select(
      `
      *,
      audit_engagements!inner(client_name, engagement_type, reporting_period_end)
    `
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch reports: ${error.message}`);
  }

  // Calculate summary statistics
  const summary = {
    total: reports?.length || 0,
    byStatus:
      reports?.reduce((acc: any, report: any) => {
        acc[report.status] = (acc[report.status] || 0) + 1;
        return acc;
      }, {}) || {},
    byType:
      reports?.reduce((acc: any, report: any) => {
        acc[report.report_type] = (acc[report.report_type] || 0) + 1;
        return acc;
      }, {}) || {},
    totalWordCount:
      reports?.reduce((sum: number, report: any) => sum + (report.word_count || 0), 0) || 0,
  };

  return NextResponse.json({
    success: true,
    data: {
      reports: reports || [],
      summary,
    },
  });
}

async function handleGetReport(supabase: any, reportId: string, organizationId: string) {
  const { data: report, error } = await supabase
    .from('audit_reports')
    .select(
      `
      *,
      audit_engagements!inner(*)
    `
    )
    .eq('id', reportId)
    .eq('organization_id', organizationId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch report: ${error.message}`);
  }

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  // Generate report summary
  const summary = generateReportSummary(report);

  return NextResponse.json({
    success: true,
    data: {
      report,
      summary,
    },
  });
}

async function handleListEngagements(supabase: any, organizationId: string) {
  const { data: engagements, error } = await supabase
    .from('audit_engagements')
    .select('*')
    .eq('organization_id', organizationId)
    .order('reporting_period_end', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch engagements: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    data: {
      engagements: engagements || [],
    },
  });
}

async function handleGenerateReport(supabase: any, body: any, userId: string) {
  const { engagementId, templateId, additionalData, organizationId } = body;

  if (!engagementId || !templateId) {
    return NextResponse.json(
      { error: 'Engagement ID and Template ID are required' },
      { status: 400 }
    );
  }

  // Fetch engagement data
  const { data: engagementData, error: engagementError } = await supabase
    .from('audit_engagements')
    .select('*')
    .eq('id', engagementId)
    .eq('organization_id', organizationId)
    .single();

  if (engagementError || !engagementData) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  // Convert database record to AuditEngagement interface
  const engagement: AuditEngagement = {
    id: engagementData.id,
    clientName: engagementData.client_name,
    clientId: engagementData.client_id,
    engagementType: engagementData.engagement_type,
    reportingPeriodStart: engagementData.reporting_period_start,
    reportingPeriodEnd: engagementData.reporting_period_end,
    auditStandard: engagementData.audit_standard,
    entityType: engagementData.entity_type,
    significantMatters: engagementData.significant_matters || [],
    keyAuditMatters: engagementData.key_audit_matters || [],
    materialWeaknesses: engagementData.material_weaknesses || [],
    managementLetterPoints: engagementData.management_letter_points || [],
    organizationId: engagementData.organization_id,
  };

  // Generate the report
  const generatedReport = await auditReportGenerator.generateAuditReport(
    engagement,
    templateId,
    additionalData
  );

  // Save the report to database
  const { data: savedReport, error: saveError } = await supabase
    .from('audit_reports')
    .insert({
      id: generatedReport.id,
      engagement_id: generatedReport.engagementId,
      template_id: generatedReport.templateId,
      report_type: generatedReport.reportType,
      title: generatedReport.title,
      sections: generatedReport.sections,
      audit_opinion: generatedReport.auditOpinion,
      key_findings: generatedReport.keyFindings,
      recommendations: generatedReport.recommendations,
      status: generatedReport.metadata.status,
      word_count: generatedReport.metadata.wordCount,
      page_count: generatedReport.metadata.pageCount,
      version: generatedReport.metadata.version,
      organization_id: organizationId,
      created_by: userId,
      generated_at: generatedReport.metadata.generatedAt,
    })
    .select()
    .single();

  if (saveError) {
    console.error('Failed to save report:', saveError);
    return NextResponse.json({ error: 'Failed to save generated report' }, { status: 500 });
  }

  // Validate the report
  const validation = auditReportGenerator.validateReport(generatedReport);

  return NextResponse.json({
    success: true,
    data: {
      report: savedReport,
      validation,
      summary: generateReportSummary(generatedReport),
    },
  });
}

async function handleCreateEngagement(supabase: any, body: any, userId: string) {
  const { engagement, organizationId } = body;

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement data required' }, { status: 400 });
  }

  const { data: savedEngagement, error } = await supabase
    .from('audit_engagements')
    .insert({
      id: engagement.id || crypto.randomUUID(),
      client_name: engagement.clientName,
      client_id: engagement.clientId,
      engagement_type: engagement.engagementType,
      reporting_period_start: engagement.reportingPeriodStart,
      reporting_period_end: engagement.reportingPeriodEnd,
      audit_standard: engagement.auditStandard,
      entity_type: engagement.entityType,
      significant_matters: engagement.significantMatters || [],
      key_audit_matters: engagement.keyAuditMatters || [],
      material_weaknesses: engagement.materialWeaknesses || [],
      management_letter_points: engagement.managementLetterPoints || [],
      organization_id: organizationId,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create engagement: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    data: { engagement: savedEngagement },
  });
}

async function handleValidateReport(body: any) {
  const { report } = body;

  if (!report) {
    return NextResponse.json({ error: 'Report data required' }, { status: 400 });
  }

  const validation = auditReportGenerator.validateReport(report);

  return NextResponse.json({
    success: true,
    data: { validation },
  });
}

async function handleExportReport(supabase: any, body: any, organizationId: string) {
  const { reportId, format = 'pdf' } = body;

  if (!reportId) {
    return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
  }

  // Fetch the report
  const { data: report, error } = await supabase
    .from('audit_reports')
    .select('*')
    .eq('id', reportId)
    .eq('organization_id', organizationId)
    .single();

  if (error || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  let exportContent = '';
  let contentType = '';

  switch (format.toLowerCase()) {
    case 'pdf':
      exportContent = formatAuditReportForPDF(report);
      contentType = 'application/pdf';
      break;

    case 'docx':
      exportContent = formatAuditReportForPDF(report); // Would need proper DOCX formatting
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      break;

    case 'html':
      exportContent = formatAuditReportForPDF(report)
        .replace(/\n/g, '<br>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>');
      contentType = 'text/html';
      break;

    default:
      return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    data: {
      content: exportContent,
      filename: `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.${format}`,
      contentType,
    },
  });
}

async function handleUpdateReport(
  supabase: any,
  reportId: string,
  updates: any,
  organizationId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('audit_reports')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', reportId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update report: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    data: { report: data },
  });
}
