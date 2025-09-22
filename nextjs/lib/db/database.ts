import { createServerClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import { withRetry, DatabaseError, NotFoundError } from '@/lib/errorHandler';
import { addSearchFilters } from '@/lib/api/pagination';

interface UserData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  company?: string;
  organizationId?: string;
}

interface CookieStore {
  getAll: () => any[];
  set: (name: string, value: string, options?: any) => void;
}

interface ProjectData {
  name: string;
  description?: string;
  clientName: string;
  clientEmail?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  projectType?: string;
  priority?: string;
  budget?: number;
  complianceFramework?: string;
  riskLevel?: string;
  userId: string;
  assignedTo?: string[];
  organizationId?: string;
}

export class Database {
  private client: any; // Use any type to avoid strict typing issues
  constructor(cookieStore: CookieStore) {
    // Initialize Supabase client with SSR support
    this.client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: any) {
            try {
              // Set all cookies with their proper options
              cookiesToSet.forEach(({ name, value, options }: any) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              console.error('Error setting cookies:', error);
              // This can happen in middleware or server components
            }
          },
        },
      }
    );
  }

  // User operations
  async createUser(userData: UserData) {
    return await withRetry(
      async () => {
        const { data, error } = await this.client
          .from('users')
          .insert([
            {
              email: userData.email,
              first_name: userData.firstName,
              last_name: userData.lastName,
              role: userData.role,
              company: userData.company,
              organization_id: userData.organizationId,
            },
          ])
          .select()
          .single();

        if (error) {
          throw new DatabaseError('insert', error.message, {
            table: 'users',
            email: userData.email,
          });
        }
        return data;
      },
      {
        maxRetries: 3,
        shouldRetry: (error) => {
          // Don't retry on constraint violations or validation errors
          return !error.message?.includes('duplicate') && !error.message?.includes('constraint');
        },
      }
    );
  }

  async getUser(userId: string) {
    return await withRetry(async () => {
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

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError(`User "${userId}"`);
        }
        throw new DatabaseError('select', error.message, { table: 'users', userId });
      }
      return data;
    });
  }

  async getUserByEmail(email: string) {
    return await withRetry(async () => {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError(`User with email "${email}"`);
        }
        throw new DatabaseError('select', error.message, { table: 'users', email });
      }
      return data;
    });
  }

  async updateUser(userId: string, updates: Partial<UserData>) {
    return await withRetry(
      async () => {
        const { data, error } = await this.client
          .from('users')
          .update(updates)
          .eq('id', userId)
          .select()
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            throw new NotFoundError(`User "${userId}"`);
          }
          throw new DatabaseError('update', error.message, { table: 'users', userId });
        }
        return data;
      },
      {
        maxRetries: 3,
        shouldRetry: (error) => {
          // Don't retry on not found or constraint violations
          return !(error instanceof NotFoundError) && !error.message?.includes('constraint');
        },
      }
    );
  }

  // Project operations
  async createProject(projectData: ProjectData) {
    return await withRetry(
      async () => {
        // Get user's organization_id if not provided
        if (!projectData.organizationId) {
          const user = await this.getUser(projectData.userId);
          projectData.organizationId = user.organization_id;
        }

        const { data, error } = await this.client
          .from('projects')
          .insert([
            {
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
              organization_id: projectData.organizationId,
            },
          ])
          .select()
          .single();

        if (error) {
          throw new DatabaseError('insert', error.message, {
            table: 'projects',
            name: projectData.name,
          });
        }
        return data;
      },
      {
        maxRetries: 3,
        shouldRetry: (error) => {
          // Don't retry on constraint violations or validation errors
          return !error.message?.includes('duplicate') && !error.message?.includes('constraint');
        },
      }
    );
  }

  async getProject(projectId: string, userId: string) {
    return await withRetry(
      async () => {
        const { data, error } = await this.client
          .from('projects')
          .select(
            `
                      *,
                      documents (*),
                      document_analysis_results (*)
                  `
          )
          .eq('id', projectId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            throw new NotFoundError(`Project "${projectId}"`);
          }
          throw new DatabaseError('select', error.message, { table: 'projects', projectId });
        }

        // Automatic RLS handles permissions, but add extra checks for safety
        const user = await this.getUser(userId);
        const canAccess =
          data.created_by === userId ||
          data.assigned_to.includes(userId) ||
          (user.role === 'admin' && data.organization_id === user.organization_id);

        if (!canAccess) {
          throw new NotFoundError(`Project "${projectId}" (access denied)`);
        }

        return data;
      },
      {
        maxRetries: 2,
        shouldRetry: (error) => {
          // Don't retry on not found or access denied errors
          return !(error instanceof NotFoundError);
        },
      }
    );
  }

  async getProjects(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
      status?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
    } = {}
  ) {
    return await withRetry(async () => {
      const {
        page = 1,
        pageSize = 10,
        status = undefined,
        search = undefined,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = options;

      // Calculate offset for pagination
      const offset = (page - 1) * pageSize;

      // Start building the query
      let query = this.client.from('projects').select(
        `
                    *,
                    documents (id,
                      document_analysis_results (id)
                    )
                `,
        { count: 'exact' }
      );

      // RLS will automatically filter by user access
      // But we can add additional filters

      // Define searchable fields for projects
      const projectSearchableFields = {
        projects: ['name', 'description', 'client_name'],
      };

      // Create URLSearchParams object for unified search filtering
      const searchParams = new URLSearchParams();
      if (search) searchParams.set('search', search);
      if (status && status !== 'all') searchParams.set('status', status);

      // Apply unified search and filter logic
      query = addSearchFilters(query, searchParams, projectSearchableFields);

      // Add sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Add pagination
      query = query.range(offset, offset + pageSize - 1);

      // Execute the query
      const { data, error, count } = await query;

      if (error) throw new DatabaseError('select', error.message, { table: 'projects' });

      // Calculate total pages
      const totalPages = Math.ceil((count as number) / pageSize);

      return {
        data,
        pagination: {
          total: count,
          page,
          pageSize,
          totalPages,
        },
      };
    });
  }

  async getDocuments(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
    } = {}
  ) {
    return await withRetry(async () => {
      const {
        page = 1,
        pageSize = 10,
        search = undefined,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = options;

      const offset = (page - 1) * pageSize;

      let query = this.client.from('documents').select('*', { count: 'exact' });

      // RLS should handle security, but we can add an explicit filter for clarity
      // This assumes documents are linked to users directly or through projects.
      // As there's no direct user_id on documents, we'll rely on RLS.

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new DatabaseError('select', error.message, { table: 'documents' });
      }

      const totalPages = Math.ceil((count as number) / pageSize);

      return {
        data,
        pagination: {
          total: count,
          page,
          pageSize,
          totalPages,
        },
      };
    });
  }

  // Storage operations
  async getStorageUrl(bucket: string, path: string) {
    return await withRetry(async () => {
      const { data, error } = this.client.storage.from(bucket).getPublicUrl(path);
      if (error) throw new DatabaseError('select', error.message, { table: 'storage' });
      return data.publicUrl;
    });
  }

  async uploadFile(bucket: string, path: string, file: { buffer: ArrayBuffer; mimetype: string }) {
    return await withRetry(async () => {
      const { data, error } = await this.client.storage.from(bucket).upload(path, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

      if (error) throw new DatabaseError('upload', error.message, { table: 'storage' });
      return data;
    });
  }

  async deleteFile(bucket: string, path: string) {
    return await withRetry(async () => {
      const { error } = await this.client.storage.from(bucket).remove([path]);

      if (error) throw new DatabaseError('delete', error.message, { table: 'storage' });
      return true;
    });
  }
}
