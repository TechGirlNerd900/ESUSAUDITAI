import { ChatMessage } from '@/types/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponse } from '@/lib/geminiClient';
import {
  withErrorHandling,
  withRetry,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  DatabaseError,
} from '@/lib/errorHandler';
import { createQueryOptimizer } from '@/lib/db/queryOptimizer';
import { parsePaginationParams, validatePaginationParams } from '@/lib/api/pagination';
import { authenticateApiRequest, AuthenticatedUser } from '@/lib/auth/apiAuth';

/**
 * POST handler for chat messages
 * Sends a message to the AI assistant and returns the response
 */
export const POST = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) => {
    // Await params since they're now a Promise in newer Next.js versions
    const { projectId } = await params;

    const authResult = await authenticateApiRequest(request);
    if (!authResult.success || !authResult.user) {
      // Only access authResult.error if authResult.success is false
      throw new AuthenticationError(authResult.success === false ? authResult.error : 'Authentication required');
    }
    const { user, supabase } = authResult;
    const queryOptimizer = createQueryOptimizer(supabase);

    // userProfile is now directly available from authResult.user
    const userProfile = user;

    // Fetch project with retry
    const project = await withRetry(
      async () => {
        const { data, error } = await supabase
          .from('projects')
          .select('organization_id, assigned_to, created_by, deleted_at')
          .eq('id', projectId)
          .eq('deleted_at', null)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            throw new NotFoundError(`Project "${projectId}"`);
          }
          throw new DatabaseError('select', error.message, { table: 'projects' });
        }
        if (!data) throw new NotFoundError(`Project "${projectId}"`);
        return data;
      },
      { maxRetries: 2 }
    );

    // Verify organization access for multi-tenant security
    if (project.organization_id !== user.organizationId) {
      throw new AuthorizationError('Cross-organization access denied');
    }

    // Verify user has access to this project
    const hasAccess =
      user.role === 'admin' ||
      project.created_by === user.id ||
      (project.assigned_to && project.assigned_to.includes(user.id));

    if (!hasAccess) {
      throw new AuthorizationError('You do not have access to this project');
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON in request body');
    }

    const { message, query } = requestBody;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new ValidationError('Message is required and must be a non-empty string');
    }

    // Store user message with transaction to ensure consistency
    await withRetry(
      async () => {
        const { error } = await supabase.from('chat_history').insert({
          project_id: projectId,
          organization_id: user.organizationId,
          user_id: user.id,
          question: message.trim(),
          answer: '',
          context_documents: [],
        });

        if (error) throw new DatabaseError('insert', error.message, { table: 'chat_history' });
        return true;
      },
      { maxRetries: 3 }
    );

    // Get chat history with optimized query
    const chatHistory = await withRetry(
      async () => {
        const { data, error } = await supabase
          .from('chat_history')
          .select('*')
          .eq('project_id', projectId)
          .eq('organization_id', user.organizationId)
          .order('created_at', { ascending: true })
          .limit(50);

        if (error) throw new DatabaseError('select', error.message, { table: 'chat_history' });
        return data || [];
      },
      { maxRetries: 2 }
    );

    // Generate AI response with circuit breaker pattern for external service resilience
    let aiResponse;
    try {
      aiResponse = await withRetry(
        () =>
          generateChatResponse(chatHistory as ChatMessage[], project, query || message, projectId),
        {
          maxRetries: 2,
          shouldRetry: (error) => {
            // Only retry on network or timeout errors, not on validation errors
            return (
              error?.message?.includes('network') ||
              error?.message?.includes('timeout') ||
              error?.message?.includes('rate limit')
            );
          },
        }
      );
    } catch (aiError) {
      console.error('AI response generation error:', aiError);
      // Provide fallback response instead of failing completely
      aiResponse = {
        answer: "I'm sorry, I'm having trouble generating a response right now. Please try again.",
        citations: [],
      };
    }

    // Store AI response
    const aiMessage = await withRetry(
      async () => {
        const { data, error } = await supabase
          .from('chat_history')
          .insert({
            project_id: projectId,
            organization_id: user.organizationId,
            user_id: user.id,
            question: '',
            answer: aiResponse.answer,
            context_documents: aiResponse.citations || [],
          })
          .select()
          .single();

        if (error) throw new DatabaseError('insert', error.message, { table: 'chat_history' });
        return data;
      },
      { maxRetries: 3 }
    );

    // Invalidate chat history cache for this project
    queryOptimizer.invalidateCache('chat_history');

    return NextResponse.json({
      message: aiMessage,
      citations: aiResponse.citations,
      timestamp: new Date().toISOString(),
    });
  }
);

/**
 * GET handler for chat history
 * Retrieves paginated chat history for a project
 */
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) => {
    // Await params since they're now a Promise in newer Next.js versions
    const { projectId } = await params;

    const authResult = await authenticateApiRequest(request);
    if (!authResult.success) {
      throw new AuthenticationError(authResult.error || 'Authentication required');
    }
    const { user, supabase } = authResult;
    const queryOptimizer = createQueryOptimizer(supabase);

    // userProfile is now directly available from authResult.user
    const userProfile = user;

    // Fetch project
    const project = await withRetry(
      async () => {
        const { data, error } = await supabase
          .from('projects')
          .select('organization_id, assigned_to, created_by, deleted_at')
          .eq('id', projectId)
          .eq('deleted_at', null)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            throw new NotFoundError(`Project "${projectId}"`);
          }
          throw new DatabaseError('select', error.message, { table: 'projects' });
        }
        if (!data) throw new NotFoundError(`Project "${projectId}"`);
        return data;
      },
      { maxRetries: 2 }
    );

    // Verify organization access for multi-tenant security
    if (project.organization_id !== user.organizationId) {
      throw new AuthorizationError('Cross-organization access denied');
    }

    // Verify user has access to this project
    const hasAccess =
      user.role === 'admin' ||
      project.created_by === user.id ||
      (project.assigned_to && project.assigned_to.includes(user.id));

    if (!hasAccess) {
      throw new AuthorizationError('You do not have access to this project');
    }

    // Parse and validate pagination parameters
    const url = new URL(request.url);
    const paginationParams = parsePaginationParams(url.searchParams);
    const validation = validatePaginationParams(paginationParams);

    if (!validation.isValid) {
      throw new ValidationError(
        'Invalid pagination parameters',
        validation.errors.map((error) => ({ field: 'pagination', message: error }))
      );
    }

    // Use query optimizer to get paginated chat history with caching
    const result = await queryOptimizer.query('chat_history', {
      page: paginationParams.page ?? 1,
      pageSize: paginationParams.pageSize ?? 20,
      sortBy: 'created_at',
      sortOrder: paginationParams.sortOrder || 'asc',
      filters: {
        project_id: projectId,
        organization_id: user.organizationId,
      },
      cache: true,
      cacheTTL: 60, // Cache for 60 seconds
    });

    return NextResponse.json({
      messages: result.data,
      pagination: result.pagination,
    });
  }
);
