const { DocumentAnalysisClient } = require('@azure/ai-form-recognizer');
const { SearchClient, SearchIndexClient,SearchKeyCredential } = require('@azure/search-documents');
const { supabase } = require('../shared/supabaseClient');
const { applicationInsights } = require('./logging');
const NodeCache = require('node-cache');
const { promiseWithTimeout } = require('../utils/helpers');
const { AzureKeyCredential } = require('@azure/core-auth');
require('dotenv').config();

class AzureServices {
    constructor() {
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

                // Log retry attempt
                applicationInsights.trackEvent({
                    name: 'OperationRetry',
                    properties: {
                        ...context,
                        attempt,
                        error: error.message
                    }
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
                const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
                
                if (bucketError) throw bucketError;
                
                const bucketExists = buckets.some(bucket => bucket.name === this.bucketName);
                
                if (!bucketExists) {
                    const { error: createError } = await supabase.storage.createBucket(this.bucketName, {
                        public: false,
                        fileSizeLimit: parseInt(process.env.MAX_FILE_SIZE, 10) || 52428800
                    });
                    
                    if (createError) throw createError;
                }
                
                // Upload with progress tracking
                const { data, error } = await supabase.storage
                    .from(this.bucketName)
                    .upload(fileName, fileBuffer, {
                        contentType,
                        upsert: false
                    });
                    
                if (error) throw error;
                
                const { data: urlData } = supabase.storage
                    .from(this.bucketName)
                    .getPublicUrl(fileName);
                    
                applicationInsights.trackEvent({
                    name: 'FileUploaded',
                    properties: {
                        fileName,
                        contentType,
                        size: fileBuffer.length,
                        bucket: this.bucketName
                    }
                });
                
                return {
                    url: urlData.publicUrl,
                    fileName: fileName,
                    size: fileBuffer.length
                };
            } catch (error) {
                applicationInsights.trackException({ 
                    exception: error,
                    properties: {
                        fileName,
                        contentType,
                        operation: 'uploadToBlob'
                    }
                });
                throw error;
            }
        }, { operation: 'uploadToBlob', fileName });
    }

    async analyzeDocument(documentUrl, documentType = 'prebuilt-document') {
        const cacheKey = `analysis_${documentType}_${documentUrl}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        return await this.withRetry(async () => {
            try {
                const filePathParts = documentUrl.split('/');
                const filePath = filePathParts[filePathParts.length - 1];
                
                const { data: { signedUrl }, error: signedUrlError } = await supabase.storage
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
                
                // Cache successful results
                this.cache.set(cacheKey, extractedData);
                
                applicationInsights.trackEvent({
                    name: 'DocumentAnalyzed',
                    properties: {
                        documentType,
                        pages: result.pages?.length || 0,
                        tables: result.tables?.length || 0,
                        processingTime: Date.now() - poller.getOperationState().createdOn
                    }
                });
                
                return extractedData;
            } catch (error) {
                applicationInsights.trackException({ 
                    exception: error,
                    properties: {
                        documentUrl,
                        documentType,
                        operation: 'analyzeDocument'
                    }
                });
                throw error;
            }
        }, { operation: 'analyzeDocument', documentType });
    }

    extractDocumentData(result, documentType) {
        const extractedData = {
            content: result.content,
            pages: result.pages?.length || 0,
            tables: [],
            keyValuePairs: {},
            entities: []
        };

        // Extract tables
        if (result.tables) {
            extractedData.tables = result.tables.map(table => ({
                rowCount: table.rowCount,
                columnCount: table.columnCount,
                cells: table.cells.map(cell => ({
                    content: cell.content,
                    rowIndex: cell.rowIndex,
                    columnIndex: cell.columnIndex
                }))
            }));
        }

        // Extract key-value pairs
        if (result.keyValuePairs) {
            result.keyValuePairs.forEach(kvp => {
                if (kvp.key && kvp.value) {
                    extractedData.keyValuePairs[kvp.key.content] = kvp.value.content;
                }
            });
        }

        // Extract entities (for financial documents)
        if (result.entities) {
            extractedData.entities = result.entities.map(entity => ({
                category: entity.category,
                content: entity.content,
                confidence: entity.confidence
            }));
        }

        // Extract specific financial data based on document type
        if (documentType === 'prebuilt-invoice') {
            extractedData.invoice = this.extractInvoiceData(result);
        } else if (documentType === 'prebuilt-receipt') {
            extractedData.receipt = this.extractReceiptData(result);
        }

        return extractedData;
    }

    extractInvoiceData(result) {
        const invoice = {};
        
        if (result.documents && result.documents[0]) {
            const doc = result.documents[0];
            const fields = doc.fields;

            if (fields) {
                invoice.invoiceId = fields.InvoiceId?.value;
                invoice.invoiceDate = fields.InvoiceDate?.value;
                invoice.dueDate = fields.DueDate?.value;
                invoice.vendorName = fields.VendorName?.value;
                invoice.vendorAddress = fields.VendorAddress?.value;
                invoice.customerName = fields.CustomerName?.value;
                invoice.customerAddress = fields.CustomerAddress?.value;
                invoice.subtotal = fields.SubTotal?.value;
                invoice.totalTax = fields.TotalTax?.value;
                invoice.invoiceTotal = fields.InvoiceTotal?.value;
                
                // Extract line items
                if (fields.Items?.value) {
                    invoice.items = fields.Items.value.map(item => ({
                        description: item.value?.Description?.value,
                        quantity: item.value?.Quantity?.value,
                        unitPrice: item.value?.UnitPrice?.value,
                        amount: item.value?.Amount?.value
                    }));
                }
            }
        }

        return invoice;
    }

    extractReceiptData(result) {
        const receipt = {};
        
        if (result.documents && result.documents[0]) {
            const doc = result.documents[0];
            const fields = doc.fields;

            if (fields) {
                receipt.merchantName = fields.MerchantName?.value;
                receipt.merchantAddress = fields.MerchantAddress?.value;
                receipt.transactionDate = fields.TransactionDate?.value;
                receipt.transactionTime = fields.TransactionTime?.value;
                receipt.total = fields.Total?.value;
                receipt.subtotal = fields.Subtotal?.value;
                receipt.tax = fields.TotalTax?.value;
                
                // Extract items
                if (fields.Items?.value) {
                    receipt.items = fields.Items.value.map(item => ({
                        name: item.value?.Name?.value,
                        quantity: item.value?.Quantity?.value,
                        price: item.value?.Price?.value,
                        totalPrice: item.value?.TotalPrice?.value
                    }));
                }
            }
        }

        return receipt;
    }

    async indexDocument(documentId, content, metadata) {
        try {
            const document = {
                id: documentId,
                content: content,
                metadata: JSON.stringify(metadata),
                timestamp: new Date().toISOString()
            };

            await this.searchClient.uploadDocuments([document]);
            
            // Track the indexing in Application Insights
            applicationInsights.trackEvent({
                name: 'DocumentIndexed',
                properties: {
                    documentId,
                    contentLength: content.length,
                    metadataKeys: Object.keys(metadata)
                }
            });
            
            return true;
        } catch (error) {
            applicationInsights.trackException({ 
                exception: error,
                properties: {
                    documentId,
                    operation: 'indexDocument'
                }
            });
            throw new Error(`Failed to index document for search: ${error.message}`);
        }
    }

    async searchDocuments(query, projectId = null, top = 10) {
        try {
            let searchOptions = {
                top: top,
                includeTotalCount: true
            };

            if (projectId) {
                searchOptions.filter = `metadata/any(m: m eq 'project_id:${projectId}')`;
            }

            const searchResults = await this.searchClient.search(query, searchOptions);
            
            const results = [];
            for await (const result of searchResults.results) {
                results.push({
                    id: result.document.id,
                    content: result.document.content,
                    metadata: JSON.parse(result.document.metadata || '{}'),
                    score: result.score
                });
            }
            
            // Track the search in Application Insights
            applicationInsights.trackEvent({
                name: 'DocumentSearch',
                properties: {
                    query,
                    projectId: projectId || 'all',
                    resultCount: results.length
                }
            });

            return {
                results: results,
                count: searchResults.count
            };
        } catch (error) {
            applicationInsights.trackException({ 
                exception: error,
                properties: {
                    query,
                    projectId,
                    operation: 'searchDocuments'
                }
            });
            throw new Error(`Failed to search documents: ${error.message}`);
        }
    }

    generateUniqueFileName(originalName, userId) {
        const timestamp = Date.now();
        const extension = originalName.split('.').pop();
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
        const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
        
        return `${userId}/${timestamp}_${sanitizedName}.${extension}`;
    }

    async deleteBlob(fileName) {
        try {
            const { error } = await supabase.storage
                .from(this.bucketName)
                .remove([fileName]);
                
            if (error) {
                throw error;
            }
            
            // Track the deletion in Application Insights
            applicationInsights.trackEvent({
                name: 'FileDeleted',
                properties: {
                    fileName,
                    bucket: this.bucketName
                }
            });
            
            return true;
        } catch (error) {
            applicationInsights.trackException({ 
                exception: error,
                properties: {
                    fileName,
                    operation: 'deleteBlob'
                }
            });
            return false;
        }
    }
    
    // Get a temporary URL for a file
    async getSignedUrl(fileName, expiresIn = 3600) {
        try {
            const { data, error } = await supabase.storage
                .from(this.bucketName)
                .createSignedUrl(fileName, expiresIn);
                
            if (error) {
                throw error;
            }
            
            return data.signedUrl;
        } catch (error) {
            applicationInsights.trackException({ 
                exception: error,
                properties: {
                    fileName,
                    expiresIn,
                    operation: 'getSignedUrl'
                }
            });
            throw new Error(`Failed to generate signed URL: ${error.message}`);
        }
    }
    
    // Make a file publicly accessible
    async makePublic(fileName) {
        try {
            // Update the file's public status
            const { data, error } = await supabase.storage
                .from(this.bucketName)
                .update(fileName, undefined, {
                    cacheControl: '3600',
                    upsert: false
                });
                
            if (error) {
                throw error;
            }
            
            // Get the public URL
            const { data: urlData } = supabase.storage
                .from(this.bucketName)
                .getPublicUrl(fileName);
                
            return urlData.publicUrl;
        } catch (error) {
            applicationInsights.trackException({ 
                exception: error,
                properties: {
                    fileName,
                    operation: 'makePublic'
                }
            });
            throw new Error(`Failed to make file public: ${error.message}`);
        }
    }

    async clearCache() {
        this.cache.flushAll();
        applicationInsights.trackEvent({
            name: 'CacheCleared'
        });
    }
}

module.exports = AzureServices;
