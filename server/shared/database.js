const { supabase } = require('../shared/supabaseClient');
const { applicationInsights } = require('./logging');

class Database {
    constructor() {
        // Supabase client is already initialized in app.js
        this.client = supabase;
    }

    

    // User operations
    async createUser(userData) {
        const { email, passwordHash, firstName, lastName, role, company } = userData;
        
        try {
            const { data, error } = await this.client
                .from('users')
                .insert([{
                    email,
                    password_hash: passwordHash,
                    first_name: firstName,
                    last_name: lastName,
                    role,
                    company
                }])
                .select('id, email, first_name, last_name, role, company, created_at')
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async getUserByEmail(email) {
        try {
            const { data, error } = await this.client
                .from('users')
                .select('*')
                .eq('email', email)
                .eq('is_active', true)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "No rows returned" error
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async getUserById(id) {
        try {
            const { data, error } = await this.client
                .from('users')
                .select('id, email, first_name, last_name, role, company, created_at')
                .eq('id', id)
                .eq('is_active', true)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async updateUser(id, updates) {
        try {
            const { data, error } = await this.client
                .from('users')
                .update(updates)
                .eq('id', id)
                .select('id, email, first_name, last_name, role, company, created_at')
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    // Project operations
    async createProject(projectData) {
        const { name, description, clientName, clientEmail, createdBy, assignedTo, startDate, endDate } = projectData;
        
        try {
            const { data, error } = await this.client
                .from('projects')
                .insert([{
                    name,
                    description,
                    client_name: clientName,
                    client_email: clientEmail,
                    created_by: createdBy,
                    assigned_to: assignedTo,
                    start_date: startDate,
                    end_date: endDate
                }])
                .select('*')
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async getProjectsByUser(userId) {
        try {
            // First get projects created by the user
            const { data: createdProjects, error: createdError } = await this.client
                .from('projects')
                .select('*')
                .eq('created_by', userId)
                .order('created_at', { ascending: false });

            if (createdError) throw createdError;

            // Then get projects where user is assigned
            const { data: assignedProjects, error: assignedError } = await this.client
                .from('projects')
                .select('*')
                .contains('assigned_to', [userId])
                .order('created_at', { ascending: false });

            if (assignedError) throw assignedError;

            // Combine and remove duplicates
            const allProjects = [...createdProjects];
            assignedProjects.forEach(project => {
                if (!allProjects.some(p => p.id === project.id)) {
                    allProjects.push(project);
                }
            });

            // Sort by created_at
            return allProjects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async getProjectById(id) {
        try {
            const { data, error } = await this.client
                .from('projects')
                .select('*')
                .eq('id', id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async updateProject(id, updates) {
        try {
            const { data, error } = await this.client
                .from('projects')
                .update(updates)
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    // Document operations
    async createDocument(documentData) {
        const { projectId, uploadedBy, originalName, filePath, fileSize, fileType, blobUrl } = documentData;
        
        try {
            const { data, error } = await this.client
                .from('documents')
                .insert([{
                    project_id: projectId,
                    uploaded_by: uploadedBy,
                    original_name: originalName,
                    file_path: filePath,
                    file_size: fileSize,
                    file_type: fileType,
                    blob_url: blobUrl
                }])
                .select('*')
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async getDocumentsByProject(projectId) {
        try {
            const { data, error } = await this.client
                .from('documents')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async updateDocumentStatus(id, status) {
        try {
            const { data, error } = await this.client
                .from('documents')
                .update({ status })
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    // Analysis results operations
    async createAnalysisResult(analysisData) {
        const { documentId, extractedData, aiSummary, redFlags, highlights, confidenceScore, processingTime } = analysisData;
        
        try {
            const { data, error } = await this.client
                .from('analysis_results')
                .insert([{
                    document_id: documentId,
                    extracted_data: extractedData,
                    ai_summary: aiSummary,
                    red_flags: redFlags,
                    highlights: highlights,
                    confidence_score: confidenceScore,
                    processing_time_ms: processingTime
                }])
                .select('*')
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async getAnalysisResultsByDocument(documentId) {
        try {
            const { data, error } = await this.client
                .from('analysis_results')
                .select('*')
                .eq('document_id', documentId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async getAnalysisResultsByProject(projectId) {
        try {
            const { data, error } = await this.client
                .from('analysis_results')
                .select(`
                    *,
                    documents!inner (
                        original_name,
                        file_type,
                        project_id
                    )
                `)
                .eq('documents.project_id', projectId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            // Transform the result to match the expected format
            return data.map(item => ({
                ...item,
                original_name: item.documents.original_name,
                file_type: item.documents.file_type
            }));
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    // Chat history operations
    async createChatEntry(chatData) {
        const { projectId, userId, question, answer, contextDocuments } = chatData;
        
        try {
            const { data, error } = await this.client
                .from('chat_history')
                .insert([{
                    project_id: projectId,
                    user_id: userId,
                    question,
                    answer,
                    context_documents: contextDocuments
                }])
                .select('*')
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async getChatHistory(projectId, limit = 50) {
        try {
            const { data, error } = await this.client
                .from('chat_history')
                .select(`
                    *,
                    users (
                        first_name,
                        last_name
                    )
                `)
                .eq('project_id', projectId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            
            // Transform the result to match the expected format
            return data.map(item => ({
                ...item,
                first_name: item.users.first_name,
                last_name: item.users.last_name
            }));
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    // Audit reports operations
    async createAuditReport(reportData) {
        const { projectId, generatedBy, reportName, reportData: reportContent, pdfUrl } = reportData;
        
        try {
            const { data, error } = await this.client
                .from('audit_reports')
                .insert([{
                    project_id: projectId,
                    generated_by: generatedBy,
                    report_name: reportName,
                    report_data: reportContent,
                    pdf_url: pdfUrl
                }])
                .select('*')
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async getAuditReportsByProject(projectId) {
        try {
            const { data, error } = await this.client
                .from('audit_reports')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    // Helper method for direct queries (for backward compatibility)
    async query(text, params) {
        try {
            const { data, error, count } = await this.client.rpc('execute_sql', { 
                query_text: text, 
                query_params: params 
            });
            
            if (error) throw error;
            
            return {
                rows: data || [],
                rowCount: count || 0
            };
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }
}

module.exports = Database;
