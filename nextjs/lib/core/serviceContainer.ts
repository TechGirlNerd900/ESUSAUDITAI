/**
 * Service Container for Dependency Injection
 *
 * This module provides a simple service container for dependency injection,
 * making it easier to manage and test services.
 */

import { createClient as createServerClient } from '@/utils/supabase/server';
import logger, { getLogger } from './logger';
import { CircuitBreaker } from './errorHandler';

// Service interfaces
export interface DatabaseService {
  getUser(userId: string): Promise<any>;
  getUserByEmail(email: string): Promise<any>;
  getProject(projectId: string, userId: string): Promise<any>;
  getProjects(userId: string, options?: any): Promise<any>;
  getDocument(documentId: string): Promise<any>;
  getDocuments(projectId: string, options?: any): Promise<any>;
  createProject(projectData: any): Promise<any>;
  createDocument(documentData: any): Promise<any>;
  updateProject(projectId: string, updates: any): Promise<any>;
  updateDocument(documentId: string, updates: any): Promise<any>;
  deleteProject(projectId: string): Promise<boolean>;
  deleteDocument(documentId: string): Promise<boolean>;
}

export interface DocumentService {
  analyzeDocument(documentId: string, userId: string): Promise<any>;
  getAnalysisResults(documentId: string): Promise<any>;
  uploadDocument(file: any, projectId: string, userId: string): Promise<any>;
  generateDocumentUrl(documentId: string, expiresIn?: number): Promise<string>;
}

export interface ChatService {
  getChatHistory(projectId: string, options?: any): Promise<any>;
  sendMessage(projectId: string, message: string, userId: string): Promise<any>;
}

export interface UserService {
  getCurrentUser(): Promise<any>;
  getUserProfile(userId: string): Promise<any>;
  updateUserProfile(userId: string, updates: any): Promise<any>;
  isUserAdmin(userId: string): Promise<boolean>;
}

export interface AuditService {
  logAction(
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details?: any
  ): Promise<void>;
  getAuditLogs(options?: any): Promise<any>;
}

// Service container interface
export interface ServiceContainer {
  databaseService: DatabaseService;
  documentService: DocumentService;
  chatService: ChatService;
  userService: UserService;
  auditService: AuditService;
  supabase: any;
  logger: typeof logger;
}

// Service implementations
class SupabaseDatabaseService implements DatabaseService {
  private supabase: any;
  private logger: any;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.logger = getLogger('DatabaseService');
  }

  async getUser(userId: string): Promise<any> {
    this.logger.debug(`Getting user: ${userId}`);

    const { data, error } = await this.supabase.from('users').select('*').eq('id', userId).single();

    if (error) {
      this.logger.error(`Error getting user: ${userId}`, error);
      throw error;
    }

    return data;
  }

  async getUserByEmail(email: string): Promise<any> {
    this.logger.debug(`Getting user by email: ${email}`);

    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      this.logger.error(`Error getting user by email: ${email}`, error);
      throw error;
    }

    return data;
  }

  async getProject(projectId: string, userId: string): Promise<any> {
    this.logger.debug(`Getting project: ${projectId} for user: ${userId}`);

    const { data, error } = await this.supabase
      .from('projects')
      .select(
        `
        *,
        documents (id, name, status, created_at),
        analysis_results (id, created_at)
      `
      )
      .eq('id', projectId)
      .single();

    if (error) {
      this.logger.error(`Error getting project: ${projectId}`, error);
      throw error;
    }

    return data;
  }

  async getProjects(userId: string, options: any = {}): Promise<any> {
    this.logger.debug(`Getting projects for user: ${userId}`);

    const {
      page = 1,
      pageSize = 10,
      status,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = options;

    // Calculate pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Start building query
    let query = this.supabase.from('projects').select(
      `
        *,
        documents (id),
        analysis_results (id)
      `,
      { count: 'exact' }
    );

    // Add filters
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%,client_name.ilike.%${search}%`
      );
    }

    // Add sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Add pagination
    query = query.range(from, to);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`Error getting projects for user: ${userId}`, error);
      throw error;
    }

    return {
      data,
      pagination: {
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  }

  async getDocument(documentId: string): Promise<any> {
    this.logger.debug(`Getting document: ${documentId}`);

    const { data, error } = await this.supabase
      .from('documents')
      .select(
        `
        *,
        projects (id, name, organization_id)
      `
      )
      .eq('id', documentId)
      .single();

    if (error) {
      this.logger.error(`Error getting document: ${documentId}`, error);
      throw error;
    }

    return data;
  }

  async getDocuments(projectId: string, options: any = {}): Promise<any> {
    this.logger.debug(`Getting documents for project: ${projectId}`);

    const {
      page = 1,
      pageSize = 10,
      status,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = options;

    // Calculate pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Start building query
    let query = this.supabase
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('project_id', projectId);

    // Add filters
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Add sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Add pagination
    query = query.range(from, to);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`Error getting documents for project: ${projectId}`, error);
      throw error;
    }

    return {
      data,
      pagination: {
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  }

  async createProject(projectData: any): Promise<any> {
    this.logger.debug(`Creating project: ${projectData.name}`);

    const { data, error } = await this.supabase
      .from('projects')
      .insert([projectData])
      .select()
      .single();

    if (error) {
      this.logger.error(`Error creating project: ${projectData.name}`, error);
      throw error;
    }

    return data;
  }

  async createDocument(documentData: any): Promise<any> {
    this.logger.debug(`Creating document: ${documentData.name}`);

    const { data, error } = await this.supabase
      .from('documents')
      .insert([documentData])
      .select()
      .single();

    if (error) {
      this.logger.error(`Error creating document: ${documentData.name}`, error);
      throw error;
    }

    return data;
  }

  async updateProject(projectId: string, updates: any): Promise<any> {
    this.logger.debug(`Updating project: ${projectId}`);

    const { data, error } = await this.supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error updating project: ${projectId}`, error);
      throw error;
    }

    return data;
  }

  async updateDocument(documentId: string, updates: any): Promise<any> {
    this.logger.debug(`Updating document: ${documentId}`);

    const { data, error } = await this.supabase
      .from('documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error updating document: ${documentId}`, error);
      throw error;
    }

    return data;
  }

  async deleteProject(projectId: string): Promise<boolean> {
    this.logger.debug(`Deleting project: ${projectId}`);

    // Soft delete by setting deleted_at
    const { error } = await this.supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', projectId);

    if (error) {
      this.logger.error(`Error deleting project: ${projectId}`, error);
      throw error;
    }

    return true;
  }

  async deleteDocument(documentId: string): Promise<boolean> {
    this.logger.debug(`Deleting document: ${documentId}`);

    // Soft delete by setting deleted_at
    const { error } = await this.supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', documentId);

    if (error) {
      this.logger.error(`Error deleting document: ${documentId}`, error);
      throw error;
    }

    return true;
  }
}

class DocumentProcessingService implements DocumentService {
  private supabase: any;
  private logger: any;
  private googleCircuitBreaker: CircuitBreaker;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.logger = getLogger('DocumentService');
    this.googleCircuitBreaker = new CircuitBreaker(3, 60000, 2);
  }

  async analyzeDocument(documentId: string, userId: string): Promise<any> {
    this.logger.debug(`Analyzing document: ${documentId} for user: ${userId}`);

    // Get document details
    const { data: document, error: docError } = await this.supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) {
      this.logger.error(`Error getting document: ${documentId}`, docError);
      throw docError;
    }

    // Update document status to processing
    const { error: updateError } = await this.supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    if (updateError) {
      this.logger.error(`Error updating document status: ${documentId}`, updateError);
      throw updateError;
    }

    try {
      // Mock document analysis
      const analysisResult = {
        document_id: documentId,
        organization_id: document.organization_id,
        extracted_data: {
          content: `Sample content for document ${documentId}`,
          tables: [
            {
              rowCount: 3,
              columnCount: 4,
              cells: [],
            },
          ],
          keyValuePairs: {
            'Invoice Number': 'INV-12345',
            Date: '2023-05-15',
            'Total Amount': '$1,234.56',
          },
        },
        ai_summary: `This document appears to be an invoice with the number INV-12345 dated May 15, 2023.
          The total amount is $1,234.56.
          
          Key insights:
          1. This is a standard invoice format
          2. All required fields are present
          3. The amount matches the line items
          
          No red flags or inconsistencies were detected in this document.`,
        red_flags: [],
        highlights: [
          'This is a standard invoice format',
          'All required fields are present',
          'The amount matches the line items',
        ],
        confidence_score: 0.85,
        processing_time_ms: 1500,
      };

      // Save analysis results
      const { data: result, error: resultError } = await this.supabase
        .from('analysis_results')
        .insert([analysisResult])
        .select()
        .single();

      if (resultError) {
        this.logger.error(`Error saving analysis results: ${documentId}`, resultError);
        throw resultError;
      }

      // Update document status to analyzed
      const { error: finalUpdateError } = await this.supabase
        .from('documents')
        .update({ status: 'analyzed' })
        .eq('id', documentId);

      if (finalUpdateError) {
        this.logger.error(`Error updating document status: ${documentId}`, finalUpdateError);
        throw finalUpdateError;
      }

      return result;
    } catch (error) {
      // Update document status to error
      await this.supabase.from('documents').update({ status: 'error' }).eq('id', documentId);

      this.logger.error(`Error analyzing document: ${documentId}`, error);
      throw error;
    }
  }

  async getAnalysisResults(documentId: string): Promise<any> {
    this.logger.debug(`Getting analysis results for document: ${documentId}`);

    const { data, error } = await this.supabase
      .from('analysis_results')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      this.logger.error(`Error getting analysis results: ${documentId}`, error);
      throw error;
    }

    return data;
  }

  async uploadDocument(file: any, projectId: string, userId: string): Promise<any> {
    this.logger.debug(`Uploading document for project: ${projectId} by user: ${userId}`);

    // Generate a unique file name
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const filePath = `${projectId}/${fileName}`;

    // Upload file to storage
    const { data: _uploadData, error: uploadError } = await this.supabase.storage
      .from('documents')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
      });

    if (uploadError) {
      this.logger.error(`Error uploading document: ${fileName}`, uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage.from('documents').getPublicUrl(filePath);

    // Create document record
    const { data: document, error: docError } = await this.supabase
      .from('documents')
      .insert([
        {
          project_id: projectId,
          name: file.originalname || fileName,
          description: file.description || '',
          file_type: file.mimetype,
          file_size: file.size,
          blob_url: urlData.publicUrl,
          status: 'pending',
          uploaded_by: userId,
          organization_id: file.organization_id,
        },
      ])
      .select()
      .single();

    if (docError) {
      this.logger.error(`Error creating document record: ${fileName}`, docError);
      throw docError;
    }

    return document;
  }

  async generateDocumentUrl(documentId: string, expiresIn: number = 3600): Promise<string> {
    this.logger.debug(`Generating URL for document: ${documentId}`);

    // Get document details
    const { data: document, error: docError } = await this.supabase
      .from('documents')
      .select('blob_url')
      .eq('id', documentId)
      .single();

    if (docError) {
      this.logger.error(`Error getting document: ${documentId}`, docError);
      throw docError;
    }

    // Extract file path from blob URL
    const url = new URL(document.blob_url);
    const filePath = url.pathname.split('/').slice(-2).join('/');

    // Generate signed URL
    const { data: signedUrl, error: signedUrlError } = await this.supabase.storage
      .from('documents')
      .createSignedUrl(filePath, expiresIn);

    if (signedUrlError) {
      this.logger.error(`Error generating signed URL: ${documentId}`, signedUrlError);
      throw signedUrlError;
    }

    return signedUrl.signedUrl;
  }
}

class ChatServiceImpl implements ChatService {
  private supabase: any;
  private logger: any;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.logger = getLogger('ChatService');
  }

  async getChatHistory(projectId: string, options: any = {}): Promise<any> {
    this.logger.debug(`Getting chat history for project: ${projectId}`);

    const { page = 1, pageSize = 50 } = options;

    // Calculate pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Get total count
    const { count, error: countError } = await this.supabase
      .from('chat_history')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (countError) {
      this.logger.error(`Error counting chat history: ${projectId}`, countError);
      throw countError;
    }

    // Get paginated chat history
    const { data, error } = await this.supabase
      .from('chat_history')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      this.logger.error(`Error getting chat history: ${projectId}`, error);
      throw error;
    }

    return {
      messages: data || [],
      pagination: {
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  }

  async sendMessage(projectId: string, message: string, userId: string): Promise<any> {
    this.logger.debug(`Sending message to project: ${projectId} from user: ${userId}`);

    // Get user's organization ID
    const { data: user, error: userError } = await this.supabase
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (userError) {
      this.logger.error(`Error getting user: ${userId}`, userError);
      throw userError;
    }

    // Store user message
    const { error: chatError } = await this.supabase.from('chat_history').insert({
      project_id: projectId,
      organization_id: user.organization_id,
      user_id: userId,
      question: message,
      answer: '',
      context_documents: [],
    });

    if (chatError) {
      this.logger.error(`Error storing user message: ${projectId}`, chatError);
      throw chatError;
    }

    // Mock AI response
    const aiResponse = {
      answer: `This is a mock response to: "${message}"`,
      citations: [],
    };

    // Store AI response
    const { data: aiMessage, error: aiError } = await this.supabase
      .from('chat_history')
      .insert({
        project_id: projectId,
        organization_id: user.organization_id,
        user_id: userId,
        question: '',
        answer: aiResponse.answer,
        context_documents: aiResponse.citations,
      })
      .select()
      .single();

    if (aiError) {
      this.logger.error(`Error storing AI response: ${projectId}`, aiError);
      throw aiError;
    }

    return {
      message: aiMessage,
      citations: aiResponse.citations,
    };
  }
}

class UserServiceImpl implements UserService {
  private supabase: any;
  private logger: any;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.logger = getLogger('UserService');
  }

  async getCurrentUser(): Promise<any> {
    this.logger.debug('Getting current user');

    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser();

    if (authError) {
      this.logger.error('Error getting current user', authError);
      throw authError;
    }

    if (!user) {
      return null;
    }

    // Get user profile
    const { data: profile, error: profileError } = await this.supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError) {
      this.logger.error(`Error getting user profile: ${user.id}`, profileError);
      throw profileError;
    }

    return {
      ...user,
      profile,
    };
  }

  async getUserProfile(userId: string): Promise<any> {
    this.logger.debug(`Getting user profile: ${userId}`);

    const { data, error } = await this.supabase.from('users').select('*').eq('id', userId).single();

    if (error) {
      this.logger.error(`Error getting user profile: ${userId}`, error);
      throw error;
    }

    return data;
  }

  async updateUserProfile(userId: string, updates: any): Promise<any> {
    this.logger.debug(`Updating user profile: ${userId}`);

    const { data, error } = await this.supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error updating user profile: ${userId}`, error);
      throw error;
    }

    return data;
  }

  async isUserAdmin(userId: string): Promise<boolean> {
    this.logger.debug(`Checking if user is admin: ${userId}`);

    const { data, error } = await this.supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      this.logger.error(`Error checking if user is admin: ${userId}`, error);
      throw error;
    }

    return data.role === 'admin' || data.role === 'super_admin';
  }
}

class AuditServiceImpl implements AuditService {
  private supabase: any;
  private logger: any;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.logger = getLogger('AuditService');
  }

  async logAction(
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details: any = {}
  ): Promise<void> {
    this.logger.debug(
      `Logging action: ${action} on ${resourceType}:${resourceId} by user: ${userId}`
    );

    // Get user's organization ID
    const { data: user, error: userError } = await this.supabase
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (userError) {
      this.logger.error(`Error getting user: ${userId}`, userError);
      throw userError;
    }

    // Log the action
    const { error } = await this.supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      organization_id: user.organization_id,
    });

    if (error) {
      this.logger.error(`Error logging action: ${action}`, error);
      throw error;
    }
  }

  async getAuditLogs(options: any = {}): Promise<any> {
    this.logger.debug('Getting audit logs');

    const {
      page = 1,
      pageSize = 20,
      userId,
      resourceType,
      resourceId,
      action,
      startDate,
      endDate,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = options;

    // Calculate pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Start building query
    let query = this.supabase.from('audit_logs').select('*', { count: 'exact' });

    // Add filters
    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (resourceType) {
      query = query.eq('resource_type', resourceType);
    }

    if (resourceId) {
      query = query.eq('resource_id', resourceId);
    }

    if (action) {
      query = query.eq('action', action);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Add sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Add pagination
    query = query.range(from, to);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      this.logger.error('Error getting audit logs', error);
      throw error;
    }

    return {
      logs: data || [],
      pagination: {
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  }
}

// Create a service container
export function createServiceContainer(supabaseClient?: any): ServiceContainer {
  // Use provided Supabase client or create a new one
  const supabase = supabaseClient || createServerClient();

  // Create services
  const databaseService = new SupabaseDatabaseService(supabase);
  const documentService = new DocumentProcessingService(supabase);
  const chatService = new ChatServiceImpl(supabase);
  const userService = new UserServiceImpl(supabase);
  const auditService = new AuditServiceImpl(supabase);

  // Return service container
  return {
    databaseService,
    documentService,
    chatService,
    userService,
    auditService,
    supabase,
    logger,
  };
}

// Export a default service container
export default createServiceContainer();
