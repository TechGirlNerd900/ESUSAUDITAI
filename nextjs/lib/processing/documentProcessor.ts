/**
 * Document Processor Worker
 *
 * This module handles background processing of documents using the job queue.
 * It processes documents asynchronously to avoid blocking the main thread.
 */

import { createClient } from '@supabase/supabase-js';
import { withRetry, DatabaseError, ExternalServiceError } from '../errorHandler';
import { CircuitBreaker } from '../errorHandler';
import { documentAIService } from '../google/documentAI';
import { vertexAIService } from '../google/vertexAI';

// Initialize Supabase client for the worker
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Create circuit breakers for external services
const geminiCircuitBreaker = new CircuitBreaker(3, 60000, 2);

/**
 * Initialize the document processor
 * Registers the document analysis processor with the job queue
 */
/**
 * Update document status
 * @param documentId Document ID
 * @param status New status
 */
async function updateDocumentStatus(documentId: string, status: string): Promise<void> {
  await withRetry(
    async () => {
      const { error } = await supabase
        .from('documents')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (error) {
        throw new DatabaseError('update', error.message, { table: 'documents' });
      }
    },
    { maxRetries: 3 }
  );
}

/**
 * Get document details
 * @param documentId Document ID
 * @returns Document details
 */
async function getDocument(documentId: string): Promise<any> {
  return await withRetry(
    async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) {
        throw new DatabaseError('select', error.message, { table: 'documents' });
      }

      return data;
    },
    { maxRetries: 3 }
  );
}

/**
 * Process a document using Google Cloud Document AI and Vertex AI
 * @param document Document to process
 * @returns Analysis results
 */
async function processDocument(document: any): Promise<any> {
  const startTime = Date.now();

  // Use circuit breaker pattern for Document AI
  const documentAnalysis = await geminiCircuitBreaker.execute(async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Processing document: ${document.id}`);
      }

      // Process document using Google Cloud Document AI
      const fileBuffer = Buffer.from(document.content || '', 'base64');
      const mimeType = document.mime_type || 'application/pdf';

      const result = await documentAIService.processDocument(fileBuffer, mimeType);

      return {
        content: result.content,
        tables: result.tables,
        keyValuePairs: result.keyValuePairs,
        entities: result.entities,
        confidence: result.confidence,
      };
    } catch (error) {
      throw new ExternalServiceError(
        'Document AI',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  // Use circuit breaker pattern for Vertex AI analysis
  let aiAnalysis: any;
  try {
    const analysisRequest = {
      documentContent: documentAnalysis.content,
      documentType: document.document_type || 'financial',
      analysisType: 'financial' as const,
      context: `Document ID: ${document.id}, Organization: ${document.organization_id}`,
    };

    aiAnalysis = await geminiCircuitBreaker.execute(async () => {
      return await vertexAIService.analyzeDocument(analysisRequest);
    });
  } catch (error) {
    console.error('Vertex AI analysis error:', error);
    aiAnalysis = {
      summary: 'AI analysis unavailable - using extracted data only',
      keyInsights: [],
      redFlags: [],
      recommendations: [],
      confidence: 0.5,
    };
  }

  // Calculate confidence score
  const confidence = calculateConfidenceScore(documentAnalysis, aiAnalysis);

  // Return analysis results
  return {
    extracted_data: documentAnalysis,
    ai_summary: aiAnalysis.summary,
    key_insights: aiAnalysis.keyInsights,
    red_flags: aiAnalysis.redFlags,
    recommendations: aiAnalysis.recommendations,
    confidence_score: confidence,
    processing_time_ms: Date.now() - startTime,
  };
}

/**
 * Save analysis results to the database
 * @param documentId Document ID
 * @param organizationId Organization ID
 * @param analysisResult Analysis results
 */
async function saveAnalysisResults(
  documentId: string,
  organizationId: string,
  analysisResult: any
): Promise<void> {
  await withRetry(
    async () => {
      const { error } = await supabase.from('analysis_results').insert([
        {
          document_id: documentId,
          organization_id: organizationId,
          extracted_data: analysisResult.extracted_data,
          ai_summary: analysisResult.ai_summary,
          red_flags: analysisResult.red_flags,
          highlights: analysisResult.highlights,
          confidence_score: analysisResult.confidence_score,
          processing_time_ms: analysisResult.processing_time_ms,
        },
      ]);

      if (error) {
        throw new DatabaseError('insert', error.message, { table: 'analysis_results' });
      }
    },
    { maxRetries: 3 }
  );
}

/**
 * Calculate confidence score based on data completeness and AI analysis
 * @param analysisData Document AI analysis data
 * @param aiAnalysis Vertex AI analysis data
 * @returns Confidence score between 0 and 1
 */
function calculateConfidenceScore(analysisData: any, aiAnalysis: any): number {
  // Start with Document AI confidence
  let score = analysisData?.confidence || 0.5;

  try {
    // Boost score based on data completeness
    if (analysisData?.tables && analysisData.tables.length > 0) score += 0.1;
    if (analysisData?.keyValuePairs && Object.keys(analysisData.keyValuePairs).length > 0)
      score += 0.1;
    if (analysisData?.content && analysisData.content.length > 100) score += 0.1;
    if (analysisData?.entities && analysisData.entities.length > 0) score += 0.05;

    // Factor in AI analysis confidence
    if (aiAnalysis?.confidence) {
      score = (score + aiAnalysis.confidence) / 2;
    }

    // Boost score based on AI analysis quality
    if (aiAnalysis?.keyInsights && aiAnalysis.keyInsights.length > 0) score += 0.05;
    if (aiAnalysis?.summary && aiAnalysis.summary.length > 50) score += 0.05;
  } catch (error) {
    console.error('Error calculating confidence score:', error);
  }

  return Math.min(score, 1.0);
}
