import { createServerClient } from '@supabase/ssr';

export class Database {
    constructor(cookieStore) {
        // Initialize Supabase client with SSR support
        this.client = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: cookieStore
            }
        );
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
            console.error('Error creating user:', error);
            throw error;
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
            console.error('Error getting user:', error);
            throw error;
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
            console.error('Error updating user:', error);
            throw error;
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
            console.error('Error creating project:', error);
            throw error;
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
            console.error('Error getting project:', error);
            throw error;
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
            console.error('Error getting storage URL:', error);
            throw error;
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
            console.error('Error uploading file:', error);
            throw error;
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
            console.error('Error deleting file:', error);
            throw error;
        }
    }
}