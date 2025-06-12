import { supabase } from '../shared/supabaseClient.js';
import { applicationInsights } from './logging.js';

class Database {
    constructor() {
        this.client = supabase;
    }

    // Helper method for handling Supabase errors
    handleError(error, operation, details = {}) {
        applicationInsights.trackException({ 
            exception: error,
            properties: {
                operation,
                ...details
            }
        });
        throw error;
    }

    // User operations
    async createUser(userData) {
        try {
            const { data, error } = await this.client
                .from('users')
                .insert([{
                    email: userData.email,
                    first_name: userData.firstName,
                    last_name: userData.lastName,
                    role: userData.role,
                    company: userData.company
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError(error, 'createUser', { email: userData.email });
        }
    }

    async getUser(userId) {
        try {
            const { data, error } = await this.client
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError(error, 'getUser', { userId });
        }
    }

    async updateUser(userId, updates) {
        try {
            const { data, error } = await this.client
                .from('users')
                .update(updates)
                .eq('id', userId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError(error, 'updateUser', { userId });
        }
    }

    // Project operations
    async createProject(projectData) {
        try {
            const { data, error } = await this.client
                .from('projects')
                .insert([{
                    name: projectData.name,
                    description: projectData.description,
                    client_name: projectData.clientName,
                    client_email: projectData.clientEmail,
                    status: projectData.status || 'active',
                    created_by: projectData.userId,
                    assigned_to: projectData.assignedTo || [projectData.userId]
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError(error, 'createProject', { 
                userId: projectData.userId,
                projectName: projectData.name 
            });
        }
    }

    async getProject(projectId, userId) {
        try {
            const { data, error } = await this.client
                .from('projects')
                .select(`
                    *,
                    documents (*),
                    analysis_results (*)
                `)
                .eq('id', projectId)
                .single();

            if (error) throw error;
            
            // Check access
            const canAccess = data.created_by === userId || 
                            data.assigned_to.includes(userId);
            
            if (!canAccess) {
                throw new Error('Access denied to this project');
            }

            return data;
        } catch (error) {
            this.handleError(error, 'getProject', { projectId, userId });
        }
    }

    // Storage operations
    async getStorageUrl(bucket, path) {
        try {
            const { data: { publicUrl }, error } = this.client.storage
                .from(bucket)
                .getPublicUrl(path);

            if (error) throw error;
            return publicUrl;
        } catch (error) {
            this.handleError(error, 'getStorageUrl', { bucket, path });
        }
    }

    async uploadFile(bucket, path, file) {
        try {
            const { data, error } = await this.client.storage
                .from(bucket)
                .upload(path, file.buffer, {
                    contentType: file.mimetype,
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError(error, 'uploadFile', { 
                bucket, 
                path, 
                fileType: file.mimetype 
            });
        }
    }

    async deleteFile(bucket, path) {
        try {
            const { error } = await this.client.storage
                .from(bucket)
                .remove([path]);

            if (error) throw error;
            return true;
        } catch (error) {
            this.handleError(error, 'deleteFile', { bucket, path });
        }
    }
}

export default Database;
