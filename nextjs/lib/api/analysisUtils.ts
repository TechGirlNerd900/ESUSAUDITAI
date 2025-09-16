import { createClient } from '@/utils/supabase/server';
import { GeminiServices } from '@/lib/gemini/geminiServices';
import { generateChatResponse } from '@/lib/geminiClient';
import { calculateConfidenceScore } from '@/lib/analysis/confidenceScoring';
import { NextResponse } from 'next/server';

interface UserProfile {
  organization_id: string;
  role: string;
}

interface Document {
  id: string;
  organization_id: string;
  blob_url: string;
  file_type: string;
  file_size: number | null;
  projects: {
    id: string;
    created_by: string;
    assigned_to: string[] | null;
    deleted_at: string | null;
  };
  status: string;
}

interface AnalysisData {
  tables?: any[];
  keyValuePairs?: Record<string, any>;
  content?: string;
  [key: string]: any;
}

const RED_FLAG_KEYWORDS = [
  { keyword: 'discrepanc', message: 'Potential discrepancies detected' },
  { keyword: 'inconsisten', message: 'Inconsistencies found' },
  { keyword: 'unusual', message: 'Unusual patterns identified' },
  { keyword: 'concern', message: 'Areas of concern noted' },
];

export function extractRedFlags(summary: string): string[] {
  if (!summary || typeof summary !== 'string') {
    return [];
  }

  const redFlags: string[] = [];
  const lowerSummary = summary.toLowerCase();

  try {
    for (const { keyword, message } of RED_FLAG_KEYWORDS) {
      if (lowerSummary.includes(keyword)) {
        redFlags.push(message);
      }
    }
  } catch (error) {
    console.error('Error extracting red flags:', error);
  }

  return redFlags;
}

export function extractHighlights(summary: string): string[] {
  if (!summary || typeof summary !== 'string') {
    return [];
  }

  const highlights: string[] = [];

  try {
    const sentences = summary.split(/[.!?]+/);

    for (const sentence of sentences) {
      if (
        sentence &&
        sentence.length > 20 &&
        (sentence.toLowerCase().includes('key') ||
          sentence.toLowerCase().includes('important') ||
          sentence.toLowerCase().includes('significant'))
      ) {
        highlights.push(sentence.trim());
      }
    }
  } catch (error) {
    console.error('Error extracting highlights:', error);
  }

  return highlights.slice(0, 5);
}

import { SupabaseClient } from '@supabase/supabase-js';

// ... (other imports and interfaces)

export async function authenticateUserAndFetchProfile(supabase: SupabaseClient, userId: string): Promise<{ userProfile?: UserProfile; error?: string }> {
  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('auth_user_id', userId)
    .single();

  if (profileError || !userProfile) {
    return { error: 'User profile not found' };
  }
  return { userProfile };
}

export async function fetchAndValidateDocument(supabase: SupabaseClient, documentId: string, organizationId: string, userId: string): Promise<{ document?: Document; error?: string }> {
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select(
      `
      *,
      projects!inner(id, created_by, assigned_to, deleted_at)
    `
    )
    .eq('id', documentId)
    .eq('deleted_at', null)
    .single();

  if (docError) {
    console.error('Document fetch error:', docError);
    return { error: 'Document not found' };
  }

  if (!document || document.projects.deleted_at) {
    return { error: 'Document or project not found or archived' };
  }

  if (document.organization_id !== organizationId) {
    return { error: 'Cross-organization access denied' };
  }

  const project = document.projects;
  const hasAccess =
    organizationId === document.organization_id && // Ensure document belongs to the user's organization
    (userId === project.created_by ||
      (project.assigned_to && project.assigned_to.includes(userId)));

  if (!hasAccess) {
    return { error: 'Access denied' };
  }

  if (!document.blob_url) {
    return { error: 'Document URL not available' };
  }

  return { document };
}

export async function checkExistingAnalysis(supabase: SupabaseClient, documentId: string, organizationId: string): Promise<{ analysis?: any; message?: string; error?: string }> {
  const { data: existingAnalysis, error: analysisCheckError } = await supabase
    .from('analysis_results')
    .select('*')
    .eq('document_id', documentId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (analysisCheckError) {
    console.error('Analysis check error:', analysisCheckError);
    return { error: 'Failed to check existing analysis' };
  }

  if (existingAnalysis && existingAnalysis.length > 0) {
    return { analysis: existingAnalysis[0], message: 'Analysis already exists' };
  }
  return {};
}

export async function initializeGeminiServices(): Promise<{ geminiServices?: GeminiServices; error?: string }> {
  const cookieStore = {
    getAll: () => [],
    setAll: () => {},
  };

  try {
    const geminiServices = new GeminiServices(cookieStore);
    return { geminiServices };
  } catch (geminiError) {
    console.error('Gemini services initialization error:', geminiError);
    return { error: 'Failed to initialize document analysis service' };
  }
}

export async function performDocumentAnalysisAndSummary(geminiServices: GeminiServices, document: Document): Promise<{ documentAnalysis?: AnalysisData; aiSummary?: string; error?: string }> {
  let documentAnalysis: AnalysisData;
  try {
    documentAnalysis = await geminiServices.analyzeDocument(
      document.blob_url,
      'prebuilt-document'
    );
  } catch (geminiAnalysisError: unknown) {
    console.error('Gemini document analysis error:', geminiAnalysisError);
    let errorMessage = 'Document analysis failed';
    if (geminiAnalysisError instanceof Error) {
      errorMessage += ': ' + geminiAnalysisError.message;
    } else if (typeof geminiAnalysisError === 'string') {
      errorMessage += ': ' + geminiAnalysisError;
    }
    return { error: errorMessage };
  }

  if (!documentAnalysis) {
    return { error: 'No analysis results received from Gemini' };
  }

  const aiAnalysisPrompt = `
    Analyze this financial document data and provide:
    1. A comprehensive summary
    2. Key financial insights
    3. Potential red flags or areas of concern
    4. Important highlights
    
    Document Data:
    ${JSON.stringify(documentAnalysis, null, 2)}
  `;

  let aiSummary: string;
  try {
    const completion = await generateChatResponse([], {}, aiAnalysisPrompt);
    aiSummary = completion.answer || 'Analysis completed';
  } catch (geminiError) {
    console.error('Gemini analysis error:', geminiError);
    aiSummary = 'AI analysis unavailable - using extracted data only';
  }

  return { documentAnalysis, aiSummary };
}

export async function saveAnalysisResults(
  supabase: SupabaseClient,
  documentId: string,
  organizationId: string,
  documentAnalysis: AnalysisData,
  aiSummary: string,
  document: Document,
  startTime: number
): Promise<{ analysisResult?: any; error?: string }> {
  const confidence = calculateConfidenceScore(documentAnalysis);

  const { data: analysisResult, error: analysisError } = await supabase
    .from('analysis_results')
    .insert([
      {
        document_id: documentId,
        organization_id: organizationId,
        extracted_data: documentAnalysis,
        ai_summary: aiSummary,
        red_flags: extractRedFlags(aiSummary),
        highlights: extractHighlights(aiSummary),
        confidence_score: confidence,
        processing_time_ms: Date.now() - startTime,
        analysis_type: 'document_analysis',
        model_version: 'gemini-pro',
        metadata: {
          file_type: document.file_type,
          file_size: document.file_size || null,
          processing_duration: Date.now() - startTime,
        },
      },
    ])
    .select()
    .single();

  if (analysisError) {
    console.error('Analysis save error:', analysisError);
    return { error: 'Failed to save analysis results: ' + analysisError.message };
  }
  return { analysisResult };
}

export async function updateDocumentStatus(supabase: SupabaseClient, documentId: string, status: string): Promise<{ error?: string }> {
  const { error: statusUpdateError } = await supabase
    .from('documents')
    .update({ status })
    .eq('id', documentId);

  if (statusUpdateError) {
    console.error(`Status update to ${status} error:`, statusUpdateError);
    return { error: `Failed to update document status to ${status}` };
  }
  return {};
}

export async function handleAnalysisError(supabase: SupabaseClient, documentId: string, error: unknown): Promise<NextResponse> {
  console.error('Analysis processing error:', error);

  // Compensating transaction: reset document status
  await updateDocumentStatus(supabase, documentId, 'error');

  return NextResponse.json(
    {
      error: 'Analysis failed',
      details: error instanceof Error ? error.message : 'Unknown analysis error',
    },
    { status: 500 }
  );
}
