import { createServerClient } from '@supabase/ssr';

export class Database {
    constructor(cookieStore) {
        // Initialize Supabase client with SSR support
        this.client = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        try {
                            // Set all cookies with their proper options
                            cookiesToSet.forEach(({ name, value, options }) => {
                                cookieStore.set(name, value, options);
                            });
                        } catch (error) {
                            console.error('Error setting cookies:', error);
                            // This can happen in middleware or server components
                        }
                    }
                }
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
                    company: userData.company,
                    organization_id: userData.organizationId
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
            // First check if we have a UUID or auth_user_id
            let query;
            
            if (userId.startsWith('auth_')) {
                // This is an auth user ID, remove the prefix
                const authUserId = userId.replace('auth_', '');
                query = this.client
                    .from('users')
                    .select('*')
                    .eq('auth_user_id', authUserId)
                    .eq('deleted_at', null)
                    .single();
            } else {
                // Regular UUID
                query = this.client
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .eq('deleted_at', null)
                    .single();
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting user:', error);
            throw error;
        }
    }

    async getUserByEmail(email) {
        try {
            const { data, error } = await this.client
                .from('users')
                .select('*')
                .eq('email', email)
                .eq('deleted_at', null)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting user by email:', error);
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
            // Get user's organization_id if not provided
            if (!projectData.organizationId) {
                const user = await this.getUser(projectData.userId);
                projectData.organizationId = user.organization_id;
            }
            
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
                    priority: projectData.priority || 'medium',
                    budget: projectData.budget || null,
                    compliance_framework: projectData.complianceFramework || null,
                    risk_level: projectData.riskLevel || 'medium',
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
            
            // Automatic RLS handles permissions, but add extra checks for safety
            const user = await this.getUser(userId);
            const canAccess = 
                data.created_by === userId || 
                data.assigned_to.includes(userId) ||
                (user.role === 'admin' && data.organization_id === user.organization_id);
            
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
            
            // RLS will automatically filter by user access
            // But we can add additional filters
            
            // Filter by status if provided
            if (status) {
                query = query.eq('status', status);
            }
            
            // Filter by search term if provided
            if (search) {
                // Sanitize search term to prevent injection
                const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&');
                query = query.or(`name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,client_name.ilike.%${sanitizedSearch}%`);
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