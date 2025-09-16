/**
 * Google Cloud Vertex AI Service
 *
 * This service handles AI operations using Google Cloud Vertex AI
 * to replace Azure OpenAI functionality.
 */

import { VertexAI } from '@google-cloud/vertexai';
import { env } from '../env';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface DocumentAnalysisRequest {
  documentContent: string;
  documentType: string;
  analysisType: 'financial' | 'compliance' | 'general';
  context?: string;
}

export interface DocumentAnalysisResponse {
  summary: string;
  keyInsights: string[];
  redFlags: string[];
  recommendations: string[];
  confidence: number;
}

export class VertexAIService {
  private vertexAI: VertexAI;
  private model: any;
  private projectId: string;
  private location: string;
  private modelName: string = env.VERTEX_AI_MODEL_NAME || 'gemini-1.5-pro-001';

  constructor() {
    if (!env.GOOGLE_PROJECT_ID) {
      throw new Error('GOOGLE_PROJECT_ID environment variable is required');
    }

    this.projectId = env.GOOGLE_PROJECT_ID;
    this.location = env.GOOGLE_LOCATION || 'us-central1';

    // Initialize Vertex AI client
    this.vertexAI = new VertexAI({
      project: this.projectId,
      location: this.location,
      // Auth is handled automatically by the Google Cloud client library
      // using Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS
    });

    // Initialize the generative model
    this.model = this.vertexAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      },
    });
  }

  /**
   * Generate a chat response using Vertex AI
   * @param messages - Array of chat messages
   * @returns Chat response
   */
  async generateChatResponse(messages: ChatMessage[]): Promise<ChatResponse> {
    try {
      // Convert messages to Vertex AI format
      const contents = messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }],
      }));

      const result = await this.model.generateContent({
        contents,
      });

      const response = result.response;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Extract usage information if available
      const usage = response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount || 0,
            completionTokens: response.usageMetadata.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata.totalTokenCount || 0,
          }
        : {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          };

      return {
        message: {
          role: 'assistant',
          content: text,
          timestamp: new Date().toISOString(),
        },
        usage,
      };
    } catch (error) {
      console.error('Vertex AI chat error:', error);
      throw new Error(
        `Failed to generate chat response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Analyze a document using Vertex AI
   * @param request - Document analysis request
   * @returns Document analysis response
   */
  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResponse> {
    try {
      const prompt = this.buildAnalysisPrompt(request);

      const result = await this.model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      });

      const response = result.response;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse the response to extract structured data
      return this.parseAnalysisResponse(text);
    } catch (error) {
      console.error('Vertex AI document analysis error:', error);
      throw new Error(
        `Failed to analyze document: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate a summary of document content
   * @param content - Document content
   * @param maxLength - Maximum summary length
   * @returns Document summary
   */
  async generateSummary(content: string, maxLength: number = 500): Promise<string> {
    try {
      const prompt = `Please provide a concise summary of the following document content in no more than ${maxLength} characters:

${content}

Summary:`;

      const result = await this.model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      });

      const response = result.response;
      return response.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate summary';
    } catch (error) {
      console.error('Vertex AI summary generation error:', error);
      throw new Error(
        `Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract key insights from document content
   * @param content - Document content
   * @param documentType - Type of document
   * @returns Array of key insights
   */
  async extractKeyInsights(content: string, documentType: string): Promise<string[]> {
    try {
      const prompt = `Analyze the following ${documentType} document and extract 5-7 key insights. Return them as a bulleted list:

${content}

Key Insights:`;

      const result = await this.model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      });

      const response = result.response;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse bullet points with explicit types
      return text
        .split('\n')
        .filter((line: string) =>
          line.trim().startsWith('•') ||
          line.trim().startsWith('-') ||
          line.trim().startsWith('*')
        )
        .map((line: string) => line.replace(/^[•\-*]\s*/, '').trim())
        .filter((line: string) => line.length > 0)
        .slice(0, 7);
    } catch (error) {
      console.error('Vertex AI insight extraction error:', error);
      throw new Error(
        `Failed to extract insights: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build analysis prompt based on request type
   */
  private buildAnalysisPrompt(request: DocumentAnalysisRequest): string {
    const basePrompt = `You are an expert AI audit assistant specializing in financial auditing, compliance, and risk assessment. Analyze the following document and provide a comprehensive analysis.

Document Type: ${request.documentType}
Analysis Type: ${request.analysisType}
${request.context ? `Context: ${request.context}` : ''}

Document Content:
${request.documentContent}

Please provide your analysis in the following JSON format:
{
  "summary": "A comprehensive summary of the document",
  "keyInsights": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "redFlags": ["Potential issue 1", "Potential issue 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "confidence": 0.85
}`;

    if (request.analysisType === 'financial') {
      return (
        basePrompt +
        `

Focus on:
- Financial ratios and metrics
- Revenue and expense patterns
- Cash flow analysis
- Budget variances
- Financial compliance issues
- Risk indicators`
      );
    } else if (request.analysisType === 'compliance') {
      return (
        basePrompt +
        `

Focus on:
- Regulatory compliance
- Policy adherence
- Documentation completeness
- Risk management practices
- Control effectiveness
- Audit trail quality`
      );
    }

    return basePrompt;
  }

  /**
   * Parse analysis response from JSON format
   */
  private parseAnalysisResponse(text: string): DocumentAnalysisResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'Analysis completed',
          keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
          redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        };
      }
    } catch (error) {
      console.warn('Failed to parse JSON response, using fallback parsing');
    }

    // Fallback parsing if JSON extraction fails
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return {
      summary: lines.find((line) => line.toLowerCase().includes('summary')) || 'Analysis completed',
      keyInsights: lines
        .filter(
          (line) =>
            line.toLowerCase().includes('insight') ||
            line.startsWith('•') ||
            line.startsWith('-') ||
            line.startsWith('*')
        )
        .slice(0, 5),
      redFlags: lines
        .filter(
          (line) =>
            line.toLowerCase().includes('red flag') ||
            line.toLowerCase().includes('concern') ||
            line.toLowerCase().includes('issue')
        )
        .slice(0, 3),
      recommendations: lines
        .filter(
          (line) =>
            line.toLowerCase().includes('recommend') || line.toLowerCase().includes('suggest')
        )
        .slice(0, 3),
      confidence: 0.7,
    };
  }
}

// Export a singleton instance
export const vertexAIService = new VertexAIService();
