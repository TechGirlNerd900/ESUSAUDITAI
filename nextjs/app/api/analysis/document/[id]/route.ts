import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { GeminiServices } from '@/lib/gemini/geminiServices';
import { generateChatResponse } from '@/lib/geminiClient';
import { calculateConfidenceScore } from '@/lib/analysis/confidenceScoring';
import {
  authenticateUserAndFetchProfile,
  fetchAndValidateDocument,
  checkExistingAnalysis,
  initializeGeminiServices,
  performDocumentAnalysisAndSummary,
  saveAnalysisResults,
  updateDocumentStatus,
  handleAnalysisError,
  extractRedFlags, // Keep this import as it's used in saveAnalysisResults
  extractHighlights, // Keep this import as it's used in saveAnalysisResults
} from '@/lib/api/analysisUtils';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let supabase: Awaited<ReturnType<typeof createClient>> | undefined;
  let documentId: string | undefined;

  try {
    const resolvedParams = await params;
    documentId = resolvedParams.id;

    supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userProfile, error: profileError } = await authenticateUserAndFetchProfile(supabase, user.id);
    if (profileError || !userProfile) {
      return NextResponse.json({ error: profileError || 'User profile not found' }, { status: 403 });
    }

    const { document, error: documentError } = await fetchAndValidateDocument(
      supabase,
      documentId,
      userProfile.organization_id,
      user.id
    );
    if (documentError || !document) {
      return NextResponse.json({ error: documentError || 'Document not found' }, { status: 404 });
    }

    const { analysis: existingAnalysis, message: existingAnalysisMessage, error: existingAnalysisError } = await checkExistingAnalysis(
      supabase,
      documentId,
      userProfile.organization_id
    );
    if (existingAnalysisError) {
      console.error('Existing analysis check failed:', existingAnalysisError);
    }
    if (existingAnalysis) {
      return NextResponse.json({ analysis: existingAnalysis, message: existingAnalysisMessage });
    }

    await updateDocumentStatus(supabase, documentId, 'processing');

    const { geminiServices, error: geminiInitError } = await initializeGeminiServices();
    if (geminiInitError || !geminiServices) {
      await updateDocumentStatus(supabase, documentId, 'error');
      return NextResponse.json({ error: geminiInitError || 'Failed to initialize document analysis service' }, { status: 500 });
    }

    const startTime = Date.now();

    const { documentAnalysis, aiSummary, error: analysisSummaryError } = await performDocumentAnalysisAndSummary(geminiServices, document);
    if (analysisSummaryError || !documentAnalysis || !aiSummary) {
      await updateDocumentStatus(supabase, documentId, 'error');
      return NextResponse.json({ error: analysisSummaryError || 'Document analysis or summary failed' }, { status: 500 });
    }

    const { analysisResult, error: saveError } = await saveAnalysisResults(
      supabase,
      documentId,
      userProfile.organization_id,
      documentAnalysis,
      aiSummary,
      document,
      startTime
    );
    if (saveError || !analysisResult) {
      await updateDocumentStatus(supabase, documentId, 'error');
      return NextResponse.json({ error: saveError || 'Failed to save analysis results' }, { status: 500 });
    }

    await updateDocumentStatus(supabase, documentId, 'analyzed');

    return NextResponse.json({
      analysis: analysisResult,
      message: 'Document analyzed successfully',
    });
  } catch (error) {
    console.error('Document analysis error in route:', error);
    if (supabase && documentId) {
      await updateDocumentStatus(supabase, documentId, 'error');
    }
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
