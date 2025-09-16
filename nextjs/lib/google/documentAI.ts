/**
 * Google Cloud Document AI Service
 *
 * This service handles document processing using Google Cloud Document AI
 * to replace Azure Form Recognizer functionality.
 */

import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { Storage } from '@google-cloud/storage';
import { env } from '../env';

export interface DocumentAIResult {
  content: string;
  tables: Array<{
    rowCount: number;
    columnCount: number;
    cells: Array<{
      text: string;
      rowIndex: number;
      columnIndex: number;
    }>;
  }>;
  keyValuePairs: Record<string, string>;
  entities: Array<{
    text: string;
    type: string;
    confidence: number;
  }>;
  confidence: number;
}

export class DocumentAIService {
  private client: DocumentProcessorServiceClient;
  private storage: Storage;
  private projectId: string;
  private location: string;
  private processorId: string;

  constructor() {
    this.projectId = env.GOOGLE_PROJECT_ID || '';
    this.location = env.DOCUMENT_AI_LOCATION || 'us';
    this.processorId = env.DOCUMENT_AI_PROCESSOR_ID || '';

    if (!this.projectId || !this.processorId) {
      throw new Error(
        'Google Cloud Document AI configuration is missing. Please set GOOGLE_PROJECT_ID and DOCUMENT_AI_PROCESSOR_ID environment variables.'
      );
    }

    // Initialize Document AI client
    this.client = new DocumentProcessorServiceClient({
      projectId: this.projectId,
      ...(env.GOOGLE_APPLICATION_CREDENTIALS && {
        keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS
      })
    });

    // Initialize Cloud Storage client
    this.storage = new Storage({
      projectId: this.projectId,
      ...(env.GOOGLE_APPLICATION_CREDENTIALS && {
        keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS
      })
    });
  }

  /**
   * Process a document using Google Cloud Document AI
   * @param fileBuffer - The document file as a buffer
   * @param mimeType - The MIME type of the document
   * @returns Processed document data
   */
  async processDocument(fileBuffer: Buffer, mimeType: string): Promise<DocumentAIResult> {
    try {
      const name = `projects/${this.projectId}/locations/${this.location}/processors/${this.processorId}`;

      const request = {
        name,
        rawDocument: {
          content: fileBuffer,
          mimeType,
        },
      };

      const [result] = await this.client.processDocument(request);
      const document = result.document;

      if (!document) {
        throw new Error('No document returned from Document AI');
      }

      // Extract text content
      const content = document.text || '';

      // Extract tables
      const tables = this.extractTables(document);

      // Extract key-value pairs
      const keyValuePairs = this.extractKeyValuePairs(document);

      // Extract entities
      const entities = this.extractEntities(document);

      // Calculate overall confidence
      const confidence = this.calculateConfidence(document);

      return {
        content,
        tables,
        keyValuePairs,
        entities,
        confidence,
      };
    } catch (error) {
      console.error('Document AI processing error:', error);
      throw new Error(
        `Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Process a document from Google Cloud Storage
   * @param gcsUri - The Google Cloud Storage URI of the document
   * @param mimeType - The MIME type of the document
   * @returns Processed document data
   */
  async processDocumentFromGCS(gcsUri: string, mimeType: string): Promise<DocumentAIResult> {
    try {
      const name = `projects/${this.projectId}/locations/${this.location}/processors/${this.processorId}`;

      const request = {
        name,
        gcsDocument: {
          gcsUri,
          mimeType,
        },
      };

      const [result] = await this.client.processDocument(request);
      const document = result.document;

      if (!document) {
        throw new Error('No document returned from Document AI');
      }

      // Extract text content
      const content = document.text || '';

      // Extract tables
      const tables = this.extractTables(document);

      // Extract key-value pairs
      const keyValuePairs = this.extractKeyValuePairs(document);

      // Extract entities
      const entities = this.extractEntities(document);

      // Calculate overall confidence
      const confidence = this.calculateConfidence(document);

      return {
        content,
        tables,
        keyValuePairs,
        entities,
        confidence,
      };
    } catch (error) {
      console.error('Document AI processing error:', error);
      throw new Error(
        `Failed to process document from GCS: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract tables from the document
   */
  private extractTables(document: any): Array<{
    rowCount: number;
    columnCount: number;
    cells: Array<{
      text: string;
      rowIndex: number;
      columnIndex: number;
    }>;
  }> {
    const tables = [];

    if (document.pages) {
      for (const page of document.pages) {
        if (page.tables) {
          for (const table of page.tables) {
            const tableData: {
              rowCount: number;
              columnCount: number;
              cells: Array<{
                text: string;
                rowIndex: number;
                columnIndex: number;
              }>;
            } = {
              rowCount: table.bodyRows?.length || 0,
              columnCount: table.headerRows?.[0]?.cells?.length || 0,
              cells: [],
            };

            // Extract header cells
            if (table.headerRows) {
              for (const row of table.headerRows) {
                if (row.cells) {
                  for (const cell of row.cells) {
                    tableData.cells.push({
                      text: this.extractTextFromLayout(cell.layout),
                      rowIndex: 0,
                      columnIndex: cell.startIndex || 0,
                    });
                  }
                }
              }
            }

            // Extract body cells
            if (table.bodyRows) {
              for (let rowIndex = 0; rowIndex < table.bodyRows.length; rowIndex++) {
                const row = table.bodyRows[rowIndex];
                if (row.cells) {
                  for (const cell of row.cells) {
                    tableData.cells.push({
                      text: this.extractTextFromLayout(cell.layout),
                      rowIndex: rowIndex + 1,
                      columnIndex: cell.startIndex || 0,
                    });
                  }
                }
              }
            }

            tables.push(tableData);
          }
        }
      }
    }

    return tables;
  }

  /**
   * Extract key-value pairs from the document
   */
  private extractKeyValuePairs(document: any): Record<string, string> {
    const keyValuePairs: Record<string, string> = {};

    if (document.entities) {
      for (const entity of document.entities) {
        if (entity.type === 'key_value_pair' && entity.properties) {
          const key = entity.properties.find((prop: any) => prop.type === 'key');
          const value = entity.properties.find((prop: any) => prop.type === 'value');

          if (key && value) {
            const keyText = this.extractTextFromLayout(key.layout);
            const valueText = this.extractTextFromLayout(value.layout);
            keyValuePairs[keyText] = valueText;
          }
        }
      }
    }

    return keyValuePairs;
  }

  /**
   * Extract entities from the document
   */
  private extractEntities(document: any): Array<{
    text: string;
    type: string;
    confidence: number;
  }> {
    const entities = [];

    if (document.entities) {
      for (const entity of document.entities) {
        entities.push({
          text: this.extractTextFromLayout(entity.layout),
          type: entity.type || 'unknown',
          confidence: entity.confidence || 0,
        });
      }
    }

    return entities;
  }

  /**
   * Extract text from layout element
   */
  private extractTextFromLayout(layout: any): string {
    if (!layout) return '';

    if (layout.textAnchor && layout.textAnchor.textSegments) {
      return layout.textAnchor.textSegments.map((segment: any) => segment.text || '').join('');
    }

    return '';
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(document: any): number {
    let totalConfidence = 0;
    let confidenceCount = 0;

    // Check page confidence
    if (document.pages) {
      for (const page of document.pages) {
        if (page.confidence) {
          totalConfidence += page.confidence;
          confidenceCount++;
        }
      }
    }

    // Check entity confidence
    if (document.entities) {
      for (const entity of document.entities) {
        if (entity.confidence) {
          totalConfidence += entity.confidence;
          confidenceCount++;
        }
      }
    }

    return confidenceCount > 0 ? totalConfidence / confidenceCount : 0.5;
  }
}

// Export a singleton instance
export const documentAIService = new DocumentAIService();
