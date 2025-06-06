const express = require('express');
const router = express.Router();
const { supabase } = require('../shared/supabaseClient');
const { authenticateToken } = require('../middleware/auth');
const { applicationInsights } = require('../shared/logging');
const OpenAIClient = require('../shared/openaiClient');
const { SearchClient } = require('@azure/search-documents');
const { AzureKeyCredential } = require('@azure/core-auth');
require('dotenv').config();

// Initialize Cognitive Search
const searchClient = new SearchClient(
    process.env.AZURE_SEARCH_ENDPOINT,
    process.env.AZURE_SEARCH_INDEX_NAME,
    new AzureKeyCredential(process.env.AZURE_SEARCH_API_KEY)
);

// Ask Esus
router.post('/ask', authenticateToken, async (req, res) => {
    try {
        const { question, projectId } = req.body;
        const userId = req.user.id;
        const openai = new OpenAIClient();

        if (!question || !projectId) {
            return res.status(400).json({ error: 'Question and project ID are required' });
        }

        // Verify user can access project
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

        // Search for relevant documents using Azure Cognitive Search
        const searchResults = await searchDocuments(question, projectId, 5);

        // Get analysis results for the project to provide context
        const { data: analysisResults, error: analysisError } = await supabase
            .from('analysis_results')
            .select('*, documents!inner(original_name, file_type)')
            .eq('documents.project_id', projectId);

        if (analysisError) throw analysisError;

        // Build context from search results and analysis
        const context = buildContextFromResults(searchResults.results, analysisResults);

        // Track question
        applicationInsights.trackEvent({
            name: 'AskEsusQuestion',
            properties: {
                userId,
                projectId,
                questionLength: question.length
            }
        });

        // Get AI response from OpenAI
        const answer = await openai.askEsus(question, context, project);

        // Save chat entry to database
        const contextDocuments = searchResults.results.map(result => result.id);
        
        const { data: chatEntry, error: chatError } = await supabase
            .from('chat_history')
            .insert([{
                project_id: projectId,
                user_id: userId,
                question: question,
                answer: answer,
                context_documents: contextDocuments
            }])
            .select()
            .single();

        if (chatError) throw chatError;

        // Track successful response
        applicationInsights.trackEvent({
            name: 'AskEsusResponse',
            properties: {
                userId,
                projectId,
                chatId: chatEntry.id,
                answerLength: answer.length,
                contextDocumentsCount: contextDocuments.length
            }
        });

        res.json({
            answer: answer,
            chatId: chatEntry.id,
            contextDocuments: contextDocuments,
            relevantDocuments: searchResults.results.map(result => ({
                id: result.id,
                score: result.score,
                metadata: result.metadata
            }))
        });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get chat history for a project
router.get('/history/:projectId', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;

        // Verify user can access project
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

        // Get chat history
        const { data: chatHistory, error: chatError } = await supabase
            .from('chat_history')
            .select('*, users(first_name, last_name)')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (chatError) throw chatError;

        res.json({
            chatHistory: chatHistory.map(chat => ({
                id: chat.id,
                question: chat.question,
                answer: chat.answer,
                user: {
                    firstName: chat.users.first_name,
                    lastName: chat.users.last_name
                },
                contextDocuments: chat.context_documents,
                createdAt: chat.created_at
            }))
        });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get suggested questions based on project analysis
router.get('/suggested-questions/:projectId', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.id;

        // Verify user can access project
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

        // Get analysis results to generate relevant questions
        const { data: analysisResults, error: analysisError } = await supabase
            .from('analysis_results')
            .select('*, documents!inner(original_name, file_type)')
            .eq('documents.project_id', projectId);

        if (analysisError) throw analysisError;

        const suggestedQuestions = generateSuggestedQuestions(analysisResults, project);

        res.json({
            suggestedQuestions: suggestedQuestions
        });

    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to search documents
async function searchDocuments(query, projectId = null, top = 10) {
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
        throw new Error('Failed to search documents');
    }
}

// Helper function to build context from search results and analysis
function buildContextFromResults(searchResults, analysisResults) {
    const context = [];

    // Add analysis results as context
    analysisResults.forEach(analysis => {
        context.push({
            summary: analysis.ai_summary,
            redFlags: analysis.red_flags,
            highlights: analysis.highlights,
            documentName: analysis.documents.original_name,
            fileType: analysis.documents.file_type
        });
    });

    // Add search results as additional context
    searchResults.forEach(result => {
        context.push({
            content: result.content.substring(0, 1000), // Limit content length
            metadata: result.metadata,
            score: result.score
        });
    });

    return context;
}

// Helper function to generate suggested questions based on analysis results
function generateSuggestedQuestions(analysisResults, project) {
    const questions = [
        `What are the key financial highlights for ${project.client_name}?`,
        'Are there any compliance issues I should be aware of?',
        'What are the main risk factors identified in the documents?',
        'Can you summarize the financial performance?'
    ];

    // Add specific questions based on red flags found
    const allRedFlags = analysisResults.flatMap(result => result.red_flags || []);
    if (allRedFlags.length > 0) {
        questions.push('What are the most critical red flags found?');
        questions.push('How should I address the identified issues?');
    }

    // Add questions based on document types
    const hasInvoices = analysisResults.some(result =>
        result.documents.original_name.toLowerCase().includes('invoice')
    );
    if (hasInvoices) {
        questions.push('What is the total invoice amount for this period?');
        questions.push('Are there any invoice discrepancies?');
    }

    const hasFinancialStatements = analysisResults.some(result =>
        result.documents.original_name.toLowerCase().includes('financial') ||
        result.documents.original_name.toLowerCase().includes('statement')
    );
    if (hasFinancialStatements) {
        questions.push('What is the company\'s current financial position?');
        questions.push('How does this compare to previous periods?');
    }

    return questions.slice(0, 8); // Return max 8 questions
}

module.exports = router;
