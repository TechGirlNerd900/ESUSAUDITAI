import { DocumentAnalysisClient } from '@azure/ai-form-recognizer';
import { SearchClient, SearchIndexClient, SearchKeyCredential } from '@azure/search-documents';
import { createServerClient } from '@supabase/ssr';
import NodeCache from 'node-cache';
import { promiseWithTimeout } from './helpers.js';
import { AzureKeyCredential } from '@azure/core-auth';

export class AzureServices {
    constructor(cookieStore) {
        // Initialize Supabase client with SSR support
        this.supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: cookieStore
            }
        );

        // Initialize caching
        this.cache = new NodeCache({
            stdTTL: 3600, // 1 hour default TTL
            checkperiod: 600 // Check for expired entries every 10 minutes
        });

        // Retry configuration
        this.maxRetries = process.env.NODE_ENV === 'production' ? 3 : 1;
        this.retryDelay = 1000; // Start with 1 second delay

        // Initialize Document Intelligence
        this.documentIntelligenceClient = new DocumentAnalysisClient(
            process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
            new AzureKeyCredential(process.env.AZURE_FORM_RECOGNIZER_KEY)
        );

        // Initialize Cognitive Search
        this.searchClient = new SearchClient(
            process.env.AZURE_SEARCH_ENDPOINT,
            process.env.AZURE_SEARCH_INDEX_NAME,
            new SearchKeyCredential(process.env.AZURE_SEARCH_API_KEY)
        );

        this.bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'documents';
        
        // Analysis timeout (configurable via env)
        this.analysisTimeout = parseInt(process.env.DEFAULT_ANALYSIS_TIMEOUT_SECONDS, 10) * 1000 || 300000;
    }

    async withRetry(operation, context = {}) {
        let lastError;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (attempt === this.maxRetries) break;

                console.log('Operation retry:', {
                    ...context,
                    attempt,
                    error: error.message
                });

                // Exponential backoff
                await new Promise(resolve => 
                    setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1))
                );
            }
        }
        throw lastError;
    }

    async uploadToBlob(fileName, fileBuffer, contentType) {
        return await this.withRetry(async () => {
            try {
                // Check bucket existence and create if needed
                const { data: buckets, error: bucketError } = await this.supabase.storage.listBuckets();
                
                if (bucketError) throw bucketError;
                
                const bucketExists = buckets.some(bucket => bucket.name === this.bucketName);
                
                if (!bucketExists) {
                    const { error: createError } = await this.supabase.storage.createBucket(this.bucketName, {
                        public: false,
                        fileSizeLimit: parseInt(process.env.MAX_FILE_SIZE, 10) || 52428800
                    });
                    
                    if (createError) throw createError;
                }
                
                // Upload file
                const { data, error } = await this.supabase.storage
                    .from(this.bucketName)
                    .upload(fileName, fileBuffer, {
                        contentType,
                        upsert: false
                    });
                    
                if (error) throw error;
                
                const { data: urlData } = this.supabase.storage
                    .from(this.bucketName)
                    .getPublicUrl(fileName);
                
                return {
                    url: urlData.publicUrl,
                    fileName: fileName,
                    size: fileBuffer.length
                };
            } catch (error) {
                console.error('Error uploading to blob:', error);
                throw error;
            }
        }, { operation: 'uploadToBlob', fileName });
    }

    // Rest of the methods remain the same, just update supabase references
    async analyzeDocument(documentUrl, documentType = 'prebuilt-document') {
        const cacheKey = `analysis_${documentType}_${documentUrl}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        return await this.withRetry(async () => {
            try {
                const filePathParts = documentUrl.split('/');
                const filePath = filePathParts[filePathParts.length - 1];
                
                const { data: { signedUrl }, error: signedUrlError } = await this.supabase.storage
                    .from(this.bucketName)
                    .createSignedUrl(filePath, 60);
                    
                if (signedUrlError) throw signedUrlError;
                
                // Use timeout for analysis
                const poller = await promiseWithTimeout(
                    this.documentIntelligenceClient.beginAnalyzeDocumentFromUrl(
                        documentType,
                        signedUrl
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
        }, { operation: 'analyzeDocument', documentType });
    }

    // Keep all the existing helper methods (extractDocumentData, extractInvoiceData, extractReceiptData)
    // They don't need any changes as they don't interact with external services
    extractDocumentData(result, documentType) {
        // ... existing implementation ...
    }

    extractInvoiceData(result) {
        // ... existing implementation ...
    }

    extractReceiptData(result) {
        // ... existing implementation ...
    }

    // Storage operations with updated Supabase client
    async deleteBlob(fileName) {
        try {
            const { error } = await this.supabase.storage
                .from(this.bucketName)
                .remove([fileName]);
                
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting blob:', error);
            return false;
        }
    }
    
    async getSignedUrl(fileName, expiresIn = 3600) {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .createSignedUrl(fileName, expiresIn);
                
            if (error) throw error;
            return data.signedUrl;
        } catch (error) {
            console.error('Error getting signed URL:', error);
            throw error;
        }
    }
    
    async makePublic(fileName) {
        try {
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .update(fileName, undefined, {
                    cacheControl: '3600',
                    upsert: false
                });
                
            if (error) throw error;
            
            const { data: urlData } = this.supabase.storage
                .from(this.bucketName)
                .getPublicUrl(fileName);
                
            return urlData.publicUrl;
        } catch (error) {
            console.error('Error making file public:', error);
            throw error;
        }
    }

    async clearCache() {
        this.cache.flushAll();
    }
}