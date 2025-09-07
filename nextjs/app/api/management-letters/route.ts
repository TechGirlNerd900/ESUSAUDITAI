import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  managementLetterGenerator,
  ManagementLetterFinding,
  GeneratedManagementLetter,
  categorizeFindings,
  generateFindingSummary,
  calculateImplementationEffort,
} from '@/lib/generators/managementLetterGenerator';

/**
 * Management Letter API
 * Handles management letter generation, findings management, and templates
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

      case 'findingTemplates':
        return await handleGetFindingTemplates();

      case 'letters':
        return await handleListManagementLetters(supabase, organizationId);

      case 'letter': {
        const letterId = searchParams.get('letterId');
        if (!letterId) {
          return NextResponse.json({ error: 'Letter ID required' }, { status: 400 });
        }
        return await handleGetManagementLetter(supabase, letterId, organizationId);
      }
      case 'findings': {
        const engagementId = searchParams.get('engagementId');
        if (!engagementId) {
          return NextResponse.json({ error: 'Engagement ID required' }, { status: 400 });
        }
        return await handleGetFindings(supabase, engagementId, organizationId);
      }

      case 'analytics':
        return await handleGetAnalytics(supabase, organizationId);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Management letter API error:', error);
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
        return await handleGenerateManagementLetter(supabase, body, user.id);

      case 'createFinding':
        return await handleCreateFinding(supabase, body, user.id);

      case 'bulkCreateFindings':
        return await handleBulkCreateFindings(supabase, body, user.id);

      case 'validate':
        return await handleValidateLetter(body);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Management letter POST error:', error);
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
    const { action, organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    switch (action) {
      case 'updateLetter': {
        const { letterId, updates } = body;
        if (!letterId) {
          return NextResponse.json({ error: 'Letter ID required' }, { status: 400 });
        }
        return await handleUpdateManagementLetter(
          supabase,
          letterId,
          updates,
          organizationId,
          user.id
        );
      }
      case 'updateFinding': {
        const { findingId, findingUpdates } = body;
        if (!findingId) {
          return NextResponse.json({ error: 'Finding ID required' }, { status: 400 });
        }
        return await handleUpdateFinding(
          supabase,
          findingId,
          findingUpdates,
          organizationId,
          user.id
        );
      }
      case 'updateStatus': {
        const { letterId: statusLetterId, status } = body;
        if (!statusLetterId || !status) {
          return NextResponse.json({ error: 'Letter ID and status required' }, { status: 400 });
        }
        return await handleUpdateLetterStatus(
          supabase,
          statusLetterId,
          status,
          organizationId,
          user.id
        );
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Management letter PUT error:', error);
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
    const action = searchParams.get('action');
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    switch (action) {
      case 'finding': {
        const findingId = searchParams.get('findingId');
        if (!findingId) {
          return NextResponse.json({ error: 'Finding ID required' }, { status: 400 });
        }
        return await handleDeleteFinding(supabase, findingId, organizationId);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Management letter DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handler Functions
 */

async function handleGetTemplates() {
  const templates = managementLetterGenerator.getAvailableTemplates();

  return NextResponse.json({
    success: true,
    data: {
      templates,
      total: templates.length,
    },
  });
}

async function handleGetFindingTemplates() {
  const findingTemplates = managementLetterGenerator.getAvailableFindingTemplates();

  return NextResponse.json({
    success: true,
    data: {
      findingTemplates,
      total: findingTemplates.length,
    },
  });
}

async function handleListManagementLetters(supabase: any, organizationId: string) {
  const { data: letters, error } = await supabase
    .from('management_letters')
    .select(
      `
      *,
      audit_engagements!inner(client_name, engagement_type, reporting_period_end)
    `
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch management letters: ${error.message}`);
  }

  // Calculate summary statistics
  const summary = {
    total: letters?.length || 0,
    byStatus:
      letters?.reduce((acc: any, letter: any) => {
        acc[letter.status] = (acc[letter.status] || 0) + 1;
        return acc;
      }, {}) || {},
    totalFindings:
      letters?.reduce((sum: number, letter: any) => sum + (letter.finding_count || 0), 0) || 0,
    criticalFindings:
      letters?.reduce(
        (sum: number, letter: any) => sum + (letter.critical_finding_count || 0),
        0
      ) || 0,
  };

  return NextResponse.json({
    success: true,
    data: {
      letters: letters || [],
      summary,
    },
  });
}

async function handleGetManagementLetter(supabase: any, letterId: string, organizationId: string) {
  const { data: letter, error } = await supabase
    .from('management_letters')
    .select(
      `
      *,
      audit_engagements!inner(*),
      management_letter_findings(*)
    `
    )
    .eq('id', letterId)
    .eq('organization_id', organizationId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch management letter: ${error.message}`);
  }

  if (!letter) {
    return NextResponse.json({ error: 'Management letter not found' }, { status: 404 });
  }

  // Generate analytics for the letter
  const findings = letter.management_letter_findings || [];
  const analytics = {
    findingSummary: generateFindingSummary(findings),
    categorizedFindings: categorizeFindings(findings),
    implementationEffort: calculateImplementationEffort(findings),
  };

  return NextResponse.json({
    success: true,
    data: {
      letter,
      analytics,
    },
  });
}

async function handleGetFindings(supabase: any, engagementId: string, organizationId: string) {
  const { data: findings, error } = await supabase
    .from('management_letter_findings')
    .select('*')
    .eq('engagement_id', engagementId)
    .eq('organization_id', organizationId)
    .order('priority', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch findings: ${error.message}`);
  }

  const analytics = {
    summary: generateFindingSummary(findings || []),
    categorized: categorizeFindings(findings || []),
    implementationEffort: calculateImplementationEffort(findings || []),
  };

  return NextResponse.json({
    success: true,
    data: {
      findings: findings || [],
      analytics,
    },
  });
}

async function handleGetAnalytics(supabase: any, organizationId: string) {
  // Get management letters analytics
  const { data: letters, error: lettersError } = await supabase
    .from('management_letters')
    .select('*')
    .eq('organization_id', organizationId);

  if (lettersError) {
    throw new Error(`Failed to fetch letters for analytics: ${lettersError.message}`);
  }

  // Get findings analytics
  const { data: findings, error: findingsError } = await supabase
    .from('management_letter_findings')
    .select('*')
    .eq('organization_id', organizationId);

  if (findingsError) {
    throw new Error(`Failed to fetch findings for analytics: ${findingsError.message}`);
  }

  const analytics = {
    letters: {
      total: letters?.length || 0,
      byStatus:
        letters?.reduce((acc: any, letter: any) => {
          acc[letter.status] = (acc[letter.status] || 0) + 1;
          return acc;
        }, {}) || {},
      averageWordCount:
        letters?.length > 0
          ? Math.round(
              letters.reduce((sum: number, letter: any) => sum + (letter.word_count || 0), 0) /
                letters.length
            )
          : 0,
    },
    findings: generateFindingSummary(findings || []),
    trends: {
      monthlyLetters: {}, // Would need more complex query for time-based analytics
      topCategories: Object.entries(categorizeFindings(findings || []))
        .map(([category, categoryFindings]) => ({
          category,
          count: categoryFindings.length,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    },
  };

  return NextResponse.json({
    success: true,
    data: { analytics },
  });
}

async function handleGenerateManagementLetter(supabase: any, body: any, userId: string) {
  const { engagementId, templateId, findingIds = [], additionalData, organizationId } = body;

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

  // Fetch findings if specific findings are requested
  let findings: ManagementLetterFinding[] = [];

  if (findingIds.length > 0) {
    const { data: findingsData, error: findingsError } = await supabase
      .from('management_letter_findings')
      .select('*')
      .in('id', findingIds)
      .eq('organization_id', organizationId);

    if (findingsError) {
      return NextResponse.json({ error: 'Failed to fetch findings' }, { status: 500 });
    }

    findings = findingsData || [];
  } else {
    // Fetch all findings for engagement
    const { data: allFindings, error: allFindingsError } = await supabase
      .from('management_letter_findings')
      .select('*')
      .eq('engagement_id', engagementId)
      .eq('organization_id', organizationId);

    if (!allFindingsError) {
      findings = allFindings || [];
    }
  }

  // Generate the management letter
  const generatedLetter = await managementLetterGenerator.generateManagementLetter(
    engagementId,
    templateId,
    findings,
    engagementData,
    additionalData
  );

  // Save the letter to database
  const { data: savedLetter, error: saveError } = await supabase
    .from('management_letters')
    .insert({
      id: generatedLetter.id,
      engagement_id: generatedLetter.engagementId,
      template_id: generatedLetter.templateId,
      title: generatedLetter.title,
      executive_summary: generatedLetter.executiveSummary,
      sections: generatedLetter.sections,
      overall_assessment: generatedLetter.overallAssessment,
      status: generatedLetter.metadata.status,
      word_count: generatedLetter.metadata.wordCount,
      finding_count: generatedLetter.metadata.findingCount,
      critical_finding_count: generatedLetter.metadata.criticalFindingCount,
      version: generatedLetter.metadata.version,
      organization_id: organizationId,
      created_by: userId,
      generated_at: generatedLetter.metadata.generatedAt,
    })
    .select()
    .single();

  if (saveError) {
    console.error('Failed to save management letter:', saveError);
    return NextResponse.json(
      { error: 'Failed to save generated management letter' },
      { status: 500 }
    );
  }

  // Validate the letter
  const validation = managementLetterGenerator.validateManagementLetter(generatedLetter);

  return NextResponse.json({
    success: true,
    data: {
      letter: savedLetter,
      validation,
      analytics: {
        findingSummary: generateFindingSummary(findings),
        implementationEffort: calculateImplementationEffort(findings),
      },
    },
  });
}

async function handleCreateFinding(supabase: any, body: any, userId: string) {
  const { finding, organizationId } = body;

  if (!finding) {
    return NextResponse.json({ error: 'Finding data required' }, { status: 400 });
  }

  const { data: savedFinding, error } = await supabase
    .from('management_letter_findings')
    .insert({
      id: finding.id || crypto.randomUUID(),
      engagement_id: finding.engagementId,
      title: finding.title,
      category: finding.category,
      severity: finding.severity,
      description: finding.description,
      current_situation: finding.currentSituation,
      risks: finding.risks || [],
      business_impact: finding.businessImpact,
      recommendation: finding.recommendation,
      management_response: finding.managementResponse,
      agreed_action_plan: finding.agreedActionPlan,
      target_date: finding.targetDate,
      responsible_person: finding.responsiblePerson,
      status: finding.status || 'open',
      audit_evidence: finding.auditEvidence || [],
      related_accounts: finding.relatedAccounts || [],
      priority: finding.priority || 1,
      estimated_implementation_effort: finding.estimatedImplementationEffort || 'medium',
      cost_benefit_analysis: finding.costBenefitAnalysis,
      organization_id: organizationId,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create finding: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    data: { finding: savedFinding },
  });
}

async function handleBulkCreateFindings(supabase: any, body: any, userId: string) {
  const { findings, organizationId } = body;

  if (!findings || !Array.isArray(findings)) {
    return NextResponse.json({ error: 'Findings array required' }, { status: 400 });
  }

  const findingsToInsert = findings.map((finding) => ({
    id: finding.id || crypto.randomUUID(),
    engagement_id: finding.engagementId,
    title: finding.title,
    category: finding.category,
    severity: finding.severity,
    description: finding.description,
    current_situation: finding.currentSituation,
    risks: finding.risks || [],
    business_impact: finding.businessImpact,
    recommendation: finding.recommendation,
    status: finding.status || 'open',
    priority: finding.priority || 1,
    estimated_implementation_effort: finding.estimatedImplementationEffort || 'medium',
    organization_id: organizationId,
    created_by: userId,
  }));

  const { data: savedFindings, error } = await supabase
    .from('management_letter_findings')
    .insert(findingsToInsert)
    .select();

  if (error) {
    throw new Error(`Failed to create findings: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    data: {
      findings: savedFindings,
      count: savedFindings.length,
    },
  });
}

async function handleValidateLetter(body: any) {
  const { letter } = body;

  if (!letter) {
    return NextResponse.json({ error: 'Letter data required' }, { status: 400 });
  }

  const validation = managementLetterGenerator.validateManagementLetter(letter);

  return NextResponse.json({
    success: true,
    data: { validation },
  });
}

async function handleUpdateManagementLetter(
  supabase: any,
  letterId: string,
  updates: any,
  organizationId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('management_letters')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', letterId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update management letter: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    data: { letter: data },
  });
}

async function handleUpdateFinding(
  supabase: any,
  findingId: string,
  updates: any,
  organizationId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('management_letter_findings')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', findingId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update finding: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    data: { finding: data },
  });
}

async function handleUpdateLetterStatus(
  supabase: any,
  letterId: string,
  status: string,
  organizationId: string,
  userId: string
) {
  const validStatuses = ['draft', 'review', 'approved', 'issued'];

  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('management_letters')
    .update({
      status,
      updated_at: new Date().toISOString(),
      updated_by: userId,
      ...(status === 'approved' && { approved_at: new Date().toISOString(), approved_by: userId }),
      ...(status === 'issued' && { issued_at: new Date().toISOString() }),
    })
    .eq('id', letterId)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update letter status: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    data: { letter: data },
  });
}

async function handleDeleteFinding(supabase: any, findingId: string, organizationId: string) {
  const { error } = await supabase
    .from('management_letter_findings')
    .delete()
    .eq('id', findingId)
    .eq('organization_id', organizationId);

  if (error) {
    throw new Error(`Failed to delete finding: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    message: 'Finding deleted successfully',
  });
}
