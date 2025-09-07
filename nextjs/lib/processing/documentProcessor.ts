/**
 * Document Processor Worker
 *
 * This module handles background processing of documents using the job queue.
 * It processes documents asynchronously to avoid blocking the main thread.
 */

import { createClient } from '@supabase/supabase-js';
import { withRetry, DatabaseError, ExternalServiceError } from '../errorHandler';
import { CircuitBreaker } from '../errorHandler';
import { generateChatResponse } from '../geminiClient';

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
 * Process a document using Gemini and OpenAI
 * @param document Document to process
 * @returns Analysis results
 */
async function processDocument(document: any): Promise<any> {
  const startTime = Date.now();

  // Use circuit breaker pattern for Gemini
  const documentAnalysis = await geminiCircuitBreaker.execute(async () => {
    try {
      // Mock implementation - in a real app, you would call Gemini
      if (process.env.NODE_ENV === 'development') {
        console.log(`Processing document: ${document.id}`);
      }

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Return mock analysis results
      return {
        content: `Sample content for document ${document.id}`,
        tables: [
          {
            rowCount: 3,
            columnCount: 4,
            cells: [],
          },
        ],
        keyValuePairs: {
          'Invoice Number': 'INV-12345',
          Date: '2023-05-15',
          'Total Amount': '$1,234.56',
        },
      };
    } catch (error) {
      throw new ExternalServiceError(
        'Gemini',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  // Use circuit breaker pattern for OpenAI
  let aiSummary: string;
  try {
    const aiAnalysisPrompt = `
      Analyze this financial document data and provide:
      1. A comprehensive summary
      2. Key financial insights
      3. Potential red flags or areas of concern
      4. Important highlights
      
      Document Data:
      ${JSON.stringify(documentAnalysis, null, 2)}
    `;
    const completion = await geminiCircuitBreaker.execute(async () => {
      return await generateChatResponse([], {}, aiAnalysisPrompt);
    });
    aiSummary = completion.answer || 'Analysis completed';
  } catch (error) {
    console.error('Gemini analysis error:', error);
    aiSummary = 'AI analysis unavailable - using extracted data only';
  }

  // Calculate confidence score
  const confidence = calculateConfidenceScore(documentAnalysis);

  // Extract red flags and highlights
  const redFlags = extractRedFlags(aiSummary);
  const highlights = extractHighlights(aiSummary);

  // Return analysis results
  return {
    extracted_data: documentAnalysis,
    ai_summary: aiSummary,
    red_flags: redFlags,
    highlights: highlights,
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
 * Calculate confidence score based on data completeness
 * @param analysisData Analysis data
 * @returns Confidence score between 0 and 1
 */
function calculateConfidenceScore(analysisData: any): number {
  // Simple confidence calculation based on data completeness
  let score = 0.5; // Base score

  try {
    if (analysisData?.tables && analysisData.tables.length > 0) score += 0.2;
    if (analysisData?.keyValuePairs && Object.keys(analysisData.keyValuePairs).length > 0)
      score += 0.2;
    if (analysisData?.content && analysisData.content.length > 100) score += 0.1;
  } catch (error) {
    console.error('Error calculating confidence score:', error);
  }

  return Math.min(score, 1.0);
}

/**
 * Extract red flags from AI summary
 * @param summary AI summary
 * @returns Array of red flags
 */
function extractRedFlags(summary: string): string[] {
  if (!summary || typeof summary !== 'string') {
    return [];
  }

  const redFlags = [];
  const lowerSummary = summary.toLowerCase();

  try {
    if (lowerSummary.includes('discrepanc')) redFlags.push('Potential discrepancies detected');
    if (lowerSummary.includes('inconsisten')) redFlags.push('Inconsistencies found');
    if (lowerSummary.includes('unusual')) redFlags.push('Unusual patterns identified');
    if (lowerSummary.includes('concern')) redFlags.push('Areas of concern noted');
  } catch (error) {
    console.error('Error extracting red flags:', error);
  }

  return redFlags;
}

/**
 * Extract highlights from AI summary
 * @param summary AI summary
 * @returns Array of highlights
 */
function extractHighlights(summary: string): string[] {
  if (!summary || typeof summary !== 'string') {
    return [];
  }

  const highlights = [];

  try {
    const sentences = summary.split(/[.!?]+/);

    // Extract sentences that seem like key insights
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

  return highlights.slice(0, 5); // Limit to 5 highlights
}
