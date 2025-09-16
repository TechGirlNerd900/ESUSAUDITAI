import { createServerClient } from '@supabase/ssr';
import NodeCache from 'node-cache';
import { promiseWithTimeout } from '@/lib/core/helpers';
import type { CookieOptions } from '@supabase/ssr';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

export class GeminiServices {
  private supabase;
  private cache: NodeCache;
  private maxRetries: number;
  private retryDelay: number;
  private generativeAI: GoogleGenerativeAI;
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

    // Initialize Gemini with fallback for development
    this.generativeAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key-for-dev');

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
    // Placeholder for Gemini document analysis
    console.log('analyzeDocument called with:', documentUrl, documentType);
    return Promise.resolve({
      content: 'Placeholder content from Gemini',
      tables: [],
      keyValuePairs: {},
      confidence: 1,
    });
  }

  private extractDocumentData(result: any, _documentType: string): ExtractedDocument {
    // Placeholder for Gemini data extraction
    console.log('extractDocumentData called with:', result, _documentType);
    return {
      content: 'Placeholder content from Gemini',
      tables: [],
      keyValuePairs: {},
      confidence: 1,
    };
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

  async search(query: string, projectId: string): Promise<SearchResultItem[]> {
    // Placeholder for Gemini search
    console.log('search called with:', query, projectId);
    return Promise.resolve([]);
  }
}
