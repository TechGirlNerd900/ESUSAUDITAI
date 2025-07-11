import { DocumentAnalysisClient, AnalyzeResult } from '@azure/ai-form-recognizer';
import { SearchClient, SearchIndexClient, SearchResult } from '@azure/search-documents';
import { createServerClient } from '@supabase/ssr';
import NodeCache from 'node-cache';
import { promiseWithTimeout } from './helpers';
import { AzureKeyCredential } from '@azure/core-auth';
import type { CookieOptions } from '@supabase/ssr';

interface CookieStore {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options?: CookieOptions }[]): void;
}

interface UploadResult {
  url: string;
  fileName: string;
  size: number;
}

interface ExtractedDocument {
  content: string;
  tables?: any[];
  keyValuePairs?: Record<string, any>;
  confidence?: number;
}

interface SearchResultItem {
  textContent: string;
  sourceDocument: string;
}

interface RetryContext {
  operation?: string;
  fileName?: string;
  documentType?: string;
  query?: string;
  projectId?: string;
}

export class AzureServices {
  private supabase;
  private cache: NodeCache;
  private maxRetries: number;
  private retryDelay: number;
  private documentIntelligenceClient: DocumentAnalysisClient;
  private searchClient: SearchClient<any>;
  private bucketName: string;
  private analysisTimeout: number;

  constructor(cookieStore: CookieStore) {
    // Initialize Supabase client with SSR support
    this.supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: cookieStore,
      }
    );

    // Initialize caching
    this.cache = new NodeCache({
      stdTTL: 3600, // 1 hour default TTL
      checkperiod: 600, // Check for expired entries every 10 minutes
    });

    // Retry configuration
    this.maxRetries = process.env.NODE_ENV === 'production' ? 3 : 1;
    this.retryDelay = 1000; // Start with 1 second delay

    // Initialize Document Intelligence
    this.documentIntelligenceClient = new DocumentAnalysisClient(
      process.env.AZURE_FORM_RECOGNIZER_ENDPOINT!,
      new AzureKeyCredential(process.env.AZURE_FORM_RECOGNIZER_KEY!)
    );

    // Initialize Cognitive Search
    this.searchClient = new SearchClient(
      process.env.AZURE_SEARCH_ENDPOINT!,
      process.env.AZURE_SEARCH_INDEX_NAME!,
      new AzureKeyCredential(process.env.AZURE_SEARCH_API_KEY!)
    );

    this.bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'documents';

    // Analysis timeout (configurable via env)
    this.analysisTimeout =
      parseInt(process.env.DEFAULT_ANALYSIS_TIMEOUT_SECONDS!, 10) * 1000 || 300000;
  }

  async withRetry<T>(operation: () => Promise<T>, context: RetryContext = {}): Promise<T> {
    let lastError: Error;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt === this.maxRetries) break;

        if (process.env.NODE_ENV === 'development') {
          console.log('Operation retry:', {
            ...context,
            attempt,
            error: lastError.message,
          });
        }

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1))
        );
      }
    }
    throw lastError!;
  }

  async uploadToBlob(
    fileName: string,
    fileBuffer: Buffer,
    contentType: string
  ): Promise<UploadResult> {
    return await this.withRetry(
      async () => {
        try {
          // Check bucket existence and create if needed
          const { data: buckets, error: bucketError } = await this.supabase.storage.listBuckets();

          if (bucketError) throw bucketError;

          const bucketExists = buckets?.some((bucket) => bucket.name === this.bucketName) ?? false;

          if (!bucketExists) {
            const { error: createError } = await this.supabase.storage.createBucket(
              this.bucketName,
              {
                public: false,
                fileSizeLimit: parseInt(process.env.MAX_FILE_SIZE!, 10) || 52428800,
              }
            );

            if (createError) throw createError;
          }

          // Upload file
          const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .upload(fileName, fileBuffer, {
              contentType,
              upsert: false,
            });

          if (error) throw error;

          const { data: urlData } = this.supabase.storage
            .from(this.bucketName)
            .getPublicUrl(fileName);

          return {
            url: urlData.publicUrl,
            fileName: fileName,
            size: fileBuffer.length,
          };
        } catch (error) {
          console.error('Error uploading to blob:', error);
          throw error;
        }
      },
      { operation: 'uploadToBlob', fileName }
    );
  }

  async analyzeDocument(
    documentUrl: string,
    documentType: string = 'prebuilt-document'
  ): Promise<ExtractedDocument> {
    const cacheKey = `analysis_${documentType}_${documentUrl}`;
    const cached = this.cache.get<ExtractedDocument>(cacheKey);
    if (cached) return cached;

    return await this.withRetry(
      async () => {
        try {
          const filePathParts = documentUrl.split('/');
          const filePath = filePathParts[filePathParts.length - 1];

          if (!filePath) throw new Error('Invalid document URL - no file path found');

          const { data, error: signedUrlError } = await this.supabase.storage
            .from(this.bucketName)
            .createSignedUrl(filePath, 60);

          if (signedUrlError) throw signedUrlError;
          if (!data?.signedUrl) throw new Error('Failed to generate signed URL');

          // Use timeout for analysis
          const poller = await promiseWithTimeout(
            this.documentIntelligenceClient.beginAnalyzeDocumentFromUrl(
              documentType,
              data.signedUrl
            ),
            this.analysisTimeout,
            'Document analysis timed out'
          );

          const result = await poller.pollUntilDone();
          const extractedData = this.extractDocumentData(result, documentType);
          this.cache.set(cacheKey, extractedData);

          return extractedData;
        } catch (error) {
          console.error('Error analyzing document:', error);
          throw error;
        }
      },
      { operation: 'analyzeDocument', documentType }
    );
  }

  private extractDocumentData(result: AnalyzeResult, documentType: string): ExtractedDocument {
    const extracted: ExtractedDocument = {
      content: '',
      tables: [],
      keyValuePairs: {},
      confidence: 0,
    };

    // Extract content from pages
    if (result.pages) {
      result.pages.forEach((page) => {
        if (page.lines) {
          page.lines.forEach((line) => {
            extracted.content += line.content + '\n';
          });
        }
      });
    }

    // Extract tables
    if (result.tables) {
      extracted.tables = result.tables.map((table) => ({
        rowCount: table.rowCount,
        columnCount: table.columnCount,
        cells: table.cells?.map((cell) => ({
          content: cell.content,
          rowIndex: cell.rowIndex,
          columnIndex: cell.columnIndex,
          confidence: (cell as any).confidence,
        })),
      }));
    }

    // Extract key-value pairs
    if (result.keyValuePairs) {
      result.keyValuePairs.forEach((kvp) => {
        if (kvp.key && kvp.value) {
          extracted.keyValuePairs![kvp.key.content || ''] = kvp.value.content;
        }
      });
    }

    // Calculate average confidence
    let totalConfidence = 0;
    let confidenceCount = 0;

    if (result.pages) {
      result.pages.forEach((page) => {
        if (page.lines) {
          page.lines.forEach((line) => {
            if ((line as any).confidence !== undefined) {
              totalConfidence += (line as any).confidence;
              confidenceCount++;
            }
          });
        }
      });
    }

    extracted.confidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    return extracted;
  }

  async deleteBlob(fileName: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage.from(this.bucketName).remove([fileName]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting blob:', error);
      return false;
    }
  }

  async getSignedUrl(fileName: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(fileName, expiresIn);

      if (error) throw error;
      return data!.signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      throw error;
    }
  }

  async makePublic(fileName: string): Promise<string> {
    try {
      // Note: Supabase storage doesn't have an update method for making files public
      // Files are already public if the bucket is public, or use getPublicUrl directly
      const { data: urlData } = this.supabase.storage.from(this.bucketName).getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error making file public:', error);
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    this.cache.flushAll();
  }

  async searchCognitive(query: string, projectId: string): Promise<SearchResultItem[]> {
    // Query Azure Cognitive Search for relevant document chunks for the project
    // Returns array of { textContent, sourceDocument }
    return await this.withRetry(
      async () => {
        const results: SearchResultItem[] = [];
        const searchResults = await this.searchClient.search(query, {
          filter: `project_id eq '${projectId}'`,
          top: 5,
        });

        for await (const result of searchResults.results) {
          results.push({
            textContent: result.document.content,
            sourceDocument: result.document.file_path || result.document.id,
          });
        }
        return results;
      },
      { operation: 'searchCognitive', query, projectId }
    );
  }
}
