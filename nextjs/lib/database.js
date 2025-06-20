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
                    start_date: projectData.startDate,
                    end_date: projectData.endDate,
                    status: projectData.status || 'active',
                    project_type: projectData.projectType || 'general',
                    created_by: projectData.userId,
                    assigned_to: projectData.assignedTo || [projectData.userId],
                    organization_id: projectData.organizationId
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

    async getProjects(userId, options = {}) {
        try {
            const {
                page = 1,
                pageSize = 10,
                status,
                search,
                sortBy = 'created_at',
                sortOrder = 'desc'
            } = options;

            // Calculate offset for pagination
            const offset = (page - 1) * pageSize;
            
            // Start building the query
            let query = this.client
                .from('projects')
                .select(`
                    *,
                    documents (id),
                    analysis_results (id)
                `, { count: 'exact' });
            
            // Add filters
            // Filter by user access (created by user or assigned to user)
            query = query.or(`created_by.eq.${userId},assigned_to.cs.{${userId}}`);
            
            // Filter by status if provided
            if (status) {
                query = query.eq('status', status);
            }
            
            // Filter by search term if provided
            if (search) {
                query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,client_name.ilike.%${search}%`);
            }
            
            // Add sorting
            query = query.order(sortBy, { ascending: sortOrder === 'asc' });
            
            // Add pagination
            query = query.range(offset, offset + pageSize - 1);
            
            // Execute the query
            const { data, error, count } = await query;
            
            if (error) throw error;
            
            // Calculate total pages
            const totalPages = Math.ceil(count / pageSize);
            
            return {
                data,
                pagination: {
                    total: count,
                    page,
                    pageSize,
                    totalPages
                }
            };
        } catch (error) {
            console.error('Error getting projects:', error);
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