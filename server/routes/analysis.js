const express = require('express');
const router = express.Router();
const { supabase } = require('../shared/supabaseClient');
const { authenticateToken } = require('../middleware/auth');
const { applicationInsights } = require('../shared/logging');
const { DocumentAnalysisClient} = require('@azure/ai-form-recognizer');
const dotenv = require('dotenv');
const { SearchClient } = require('@azure/search-documents');
const { AzureKeyCredential } = require('@azure/core-auth');
const OpenAIClient = require('../shared/openaiClient');


dotenv.config({ path: '../.env' }); // Fallback to root .env

// Validate environment variables


// Initialize Document Intelligence (formerly Form Recognizer) with error handling
let documentIntelligenceClient;
try {
    if (!process.env.AZURE_FORM_RECOGNIZER_KEY || !process.env.AZURE_FORM_RECOGNIZER_ENDPOINT) {
        console.warn('Azure Form Recognizer credentials missing or invalid');
        documentIntelligenceClient = null;
    } else {
        documentIntelligenceClient = new DocumentAnalysisClient(
            process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
            new AzureKeyCredential(process.env.AZURE_FORM_RECOGNIZER_KEY)
        );
    }
} catch (error) {
    console.error('Failed to initialize Document Intelligence client:', error);
    documentIntelligenceClient = null;
}

// Initialize Cognitive Search with error handling
let searchClient;
try {
    if (!process.env.AZURE_SEARCH_API_KEY || !process.env.AZURE_SEARCH_ENDPOINT || !process.env.AZURE_SEARCH_INDEX_NAME) {
        console.warn('Azure Cognitive Search credentials missing or invalid');
        searchClient = null;
    } else {
        searchClient = new SearchClient(
            process.env.AZURE_SEARCH_ENDPOINT,
            process.env.AZURE_SEARCH_INDEX_NAME,
            new AzureKeyCredential(process.env.AZURE_SEARCH_API_KEY)
        );
    }
} catch (error) {
    console.error('Failed to initialize Cognitive Search client:', error);
    searchClient = null;
}

// Analyze document
router.post('/:documentId', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.id;
        const openai = new OpenAIClient();

        // Get document from database
        const { data: document, error: docError } = await supabase
            .from('documents')
            .select('*, projects!inner(*)')
            .eq('id', documentId)
            .single();

        if (docError || !document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check access
        const canAccess = document.projects.created_by === userId || 
                         document.projects.assigned_to.includes(userId) ||
                         req.user.role === 'admin';

        if (!canAccess) {
            return res.status(403).json({ error: 'Access denied to this document' });
        }

        // Update document status to processing
        const { error: updateError } = await supabase
            .from('documents')
            .update({ status: 'processing' })
            .eq('id', documentId);

        if (updateError) throw updateError;

        const startTime = Date.now();

        try {
            // Determine document type for Document Intelligence
            let documentType = 'prebuilt-document';
            if (document.file_type === 'application/pdf') {
                const filename = document.original_name.toLowerCase();
                if (filename.includes('invoice')) {
                    documentType = 'prebuilt-invoice';
                } else if (filename.includes('receipt')) {
                    documentType = 'prebuilt-receipt';
                }
            }

            // Get signed URL for document
            const { data: { signedUrl }, error: signedUrlError } = await supabase.storage
                .from('documents')
                .createSignedUrl(document.file_path, 60);

            if (signedUrlError) throw signedUrlError;

            // Analyze document with Document Intelligence
            applicationInsights.trackEvent({
                name: 'DocumentAnalysisStarted',
                properties: {
                    documentId,
                    documentType,
                    fileType: document.file_type
                }
            });

            let extractedData;
            
            if (!documentIntelligenceClient) {
                console.warn('Document Intelligence client not available, using fallback extraction');
                // Fallback to basic extraction when Document Intelligence is not available
                extractedData = {
                    content: `Document ID: ${documentId}, Type: ${document.file_type}, Name: ${document.original_name}`,
                    pages: 1,
                    tables: [],
                    keyValuePairs: {},
                    entities: []
                };
            } else {
                try {
                    const poller = await documentIntelligenceClient.beginAnalyzeDocumentFromUrl(
                        documentType,
                        signedUrl
                    );
                    
                    const result = await poller.pollUntilDone();
                    extractedData = extractDocumentData(result, documentType);
                } catch (docAnalysisError) {
                    console.error('Document analysis failed:', docAnalysisError);
                    // Fallback to basic extraction on error
                    extractedData = {
                        content: `Document ID: ${documentId}, Type: ${document.file_type}, Name: ${document.original_name}`,
                        pages: 1,
                        tables: [],
                        keyValuePairs: {},
                        entities: [],
                        error: docAnalysisError.message
                    };
                }
            }

            // Analyze with OpenAI
            const aiAnalysis = await openai.analyzeDocument(
                extractedData, 
                getDocumentCategory(document.file_type)
            );

            const processingTime = Date.now() - startTime;

            // Save analysis results to database
            const { data: analysisResult, error: analysisError } = await supabase
                .from('analysis_results')
                .insert([{
                    document_id: documentId,
                    extracted_data: extractedData,
                    ai_summary: aiAnalysis.summary,
                    red_flags: aiAnalysis.redFlags,
                    highlights: aiAnalysis.highlights,
                    confidence_score: aiAnalysis.confidenceScore,
                    processing_time_ms: processingTime
                }])
                .select()
                .single();

            if (analysisError) throw analysisError;

            // Index document for search
            const searchMetadata = {
                project_id: document.project_id,
                document_id: documentId,
                file_type: document.file_type,
                original_name: document.original_name,
                uploaded_by: document.uploaded_by
            };

            await indexDocument(
                documentId,
                `${extractedData.content} ${aiAnalysis.summary}`,
                searchMetadata
            );

            // Update document status to analyzed
            await supabase
                .from('documents')
                .update({ status: 'analyzed' })
                .eq('id', documentId);

            // Track successful analysis
            applicationInsights.trackEvent({
                name: 'DocumentAnalysisCompleted',
                properties: {
                    documentId,
                    processingTime,
                    confidenceScore: aiAnalysis.confidenceScore
                }
            });

            res.json({
                message: 'Document analyzed successfully',
                analysis: {
                    id: analysisResult.id,
                    summary: aiAnalysis.summary,
                    redFlags: aiAnalysis.redFlags,
                    highlights: aiAnalysis.highlights,
                    confidenceScore: aiAnalysis.confidenceScore,
                    processingTimeMs: processingTime,
                    extractedData: extractedData
                }
            });

        } catch (analysisError) {
            applicationInsights.trackException({ 
                exception: analysisError,
                properties: {
                    documentId,
                    operation: 'DocumentAnalysis'
                }
            });

            // Update document status to error
            await supabase
                .from('documents')
                .update({ status: 'error' })
                .eq('id', documentId);

            res.status(500).json({
                error: 'Document analysis failed',
                details: analysisError.message
            });
        }

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get analysis results for a document
router.get('/:documentId', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.id;

        // Get document and verify access
        const { data: document, error: docError } = await supabase
            .from('documents')
            .select('*, projects!inner(*)')
            .eq('id', documentId)
            .single();

        if (docError || !document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check access
        const canAccess = document.projects.created_by === userId || 
                         document.projects.assigned_to.includes(userId) ||
                         req.user.role === 'admin';

        if (!canAccess) {
            return res.status(403).json({ error: 'Access denied to this document' });
        }

        // Get analysis results
        const { data: analysis, error: analysisError } = await supabase
            .from('analysis_results')
            .select('*')
            .eq('document_id', documentId)
            .single();

        if (analysisError || !analysis) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        res.json({
            analysis: {
                id: analysis.id,
                summary: analysis.ai_summary,
                redFlags: analysis.red_flags,
                highlights: analysis.highlights,
                confidenceScore: analysis.confidence_score,
                processingTimeMs: analysis.processing_time_ms,
                extractedData: analysis.extracted_data,
                createdAt: analysis.created_at
            }
        });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search documents
router.post('/search', authenticateToken, async (req, res) => {
    try {
        const { query, projectId, limit = 10 } = req.body;
        const userId = req.user.id;

        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // If projectId is provided, verify access
        if (projectId) {
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (projectError || !project) {
                return res.status(404).json({ error: 'Project not found' });
            }

            const canAccess = project.created_by === userId || 
                             project.assigned_to.includes(userId) ||
                             req.user.role === 'admin';

            if (!canAccess) {
                return res.status(403).json({ error: 'Access denied to this project' });
            }
        }

        // Search documents
        const searchResults = await searchDocuments(query, projectId, limit);

        // Track search
        applicationInsights.trackEvent({
            name: 'DocumentSearch',
            properties: {
                userId,
                projectId: projectId || 'all',
                query,
                resultCount: searchResults.count,
                error: searchResults.error || null
            }
        });

        // If there's an error but it's just that search is unavailable, return 200 with empty results
        // Otherwise, return the results as normal
        if (searchResults.error && searchResults.error === 'Search service not available') {
            res.json({
                results: [],
                count: 0,
                message: 'Search service is currently unavailable'
            });
        } else {
            res.json(searchResults);
        }

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to extract document data
function extractDocumentData(result, documentType) {
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
        extractedData.invoice = extractInvoiceData(result);
    } else if (documentType === 'prebuilt-receipt') {
        extractedData.receipt = extractReceiptData(result);
    }

    return extractedData;
}

// Helper function to extract invoice data
function extractInvoiceData(result) {
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

// Helper function to extract receipt data
function extractReceiptData(result) {
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

// Helper function to determine document category for AI analysis
function getDocumentCategory(fileType) {
    const categoryMap = {
        'application/pdf': 'financial',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
        'application/vnd.ms-excel': 'spreadsheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
        'application/msword': 'document',
        'text/csv': 'data'
    };

    return categoryMap[fileType] || 'general';
}

// Helper function to index document for search
async function indexDocument(documentId, content, metadata) {
    // Skip indexing if search client is not available
    if (!searchClient) {
        console.warn('Search client not available, skipping document indexing');
        return false;
    }
    
    try {
        const document = {
            id: documentId,
            content: content,
            metadata: JSON.stringify(metadata),
            timestamp: new Date().toISOString()
        };

        await searchClient.uploadDocuments([document]);
        return true;
    } catch (error) {
        console.error('Search indexing error:', error);
        // Don't throw error, just return false to indicate failure
        return false;
    }
}

// Helper function to search documents
async function searchDocuments(query, projectId = null, top = 10) {
    // Return empty results if search client is not available
    if (!searchClient) {
        console.warn('Search client not available, returning empty search results');
        return {
            results: [],
            count: 0,
            error: 'Search service not available'
        };
    }
    
    try {
        let searchOptions = {
            top: top,
            includeTotalCount: true
        };

        if (projectId) {
            searchOptions.filter = `metadata/any(m: m eq 'project_id:${projectId}')`;
        }

        const searchResults = await searchClient.search(query, searchOptions);
        
        const results = [];
        for await (const result of searchResults.results) {
            results.push({
                id: result.document.id,
                content: result.document.content,
                metadata: JSON.parse(result.document.metadata || '{}'),
                score: result.score
            });
        }

        return {
            results: results,
            count: searchResults.count
        };
    } catch (error) {
        console.error('Search error:', error);
        // Return empty results with error message instead of throwing
        return {
            results: [],
            count: 0,
            error: error.message
        };
    }
}

module.exports = router;
