import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  withErrorHandling,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  AuthorizationError,
  DatabaseError,
} from '@/lib/errorHandler';
import { queueDocumentAnalysis, JobPriority } from '@/lib/jobQueue';

/**
 * POST handler for document processing
 * Queues a document for background processing
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch (error) {
    throw new ValidationError('Invalid JSON in request body');
  }

  // Validate document ID
  const { documentId } = body;
  if (!documentId) {
    throw new ValidationError('Document ID is required');
  }

  // Initialize Supabase client
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new AuthenticationError('Authentication required to process documents');
  }

  // Get user profile
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (userError || !userProfile) {
    throw new AuthorizationError('User profile not found');
  }

  // Get document details
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select(
      `
      *,
      projects!inner(id, organization_id, created_by, assigned_to, deleted_at)
    `
    )
    .eq('id', documentId)
    .eq('deleted_at', null)
    .single();

  if (docError) {
    if (docError.code === 'PGRST116') {
      throw new NotFoundError(`Document ${documentId}`);
    }
    throw new DatabaseError('select', docError.message, { table: 'documents' });
  }

  if (!document) {
    throw new NotFoundError(`Document ${documentId}`);
  }

  // Verify organization access for multi-tenant security
  if (document.organization_id !== userProfile.organization_id) {
    throw new AuthorizationError('Cross-organization access denied');
  }

  // Verify user has access to this document's project
  const project = document.projects;
  const hasAccess =
    userProfile.role === 'admin' ||
    project.created_by === user.id ||
    (project.assigned_to && project.assigned_to.includes(user.id));

  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this document');
  }

  // Check if document is already being processed
  if (document.status === 'processing' || document.status === 'queued') {
    return NextResponse.json({
      message: `Document is already ${document.status}`,
      status: document.status,
      documentId,
    });
  }

  // Update document status to queued
  const { error: updateError } = await supabase
    .from('documents')
    .update({ status: 'queued', updated_at: new Date().toISOString() })
    .eq('id', documentId);

  if (updateError) {
    throw new DatabaseError('update', updateError.message, { table: 'documents' });
  }

  // Determine job priority based on user role
  const priority = userProfile.role === 'admin' ? JobPriority.HIGH : JobPriority.NORMAL;

  // Queue document for processing
  const job = await queueDocumentAnalysis(documentId, user.id, priority);

  // Return job information
  return NextResponse.json({
    message: 'Document queued for processing',
    status: 'queued',
    documentId,
    jobId: job.id,
    priority: JobPriority[job.priority],
    estimatedProcessingTime: '30-60 seconds',
  });
});

/**
 * GET handler for document processing status
 * Retrieves the status of a document processing job
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Get document ID from query parameters
  const url = new URL(request.url);
  const documentId = url.searchParams.get('documentId');

  if (!documentId) {
    throw new ValidationError('Document ID is required');
  }

  // Initialize Supabase client
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new AuthenticationError('Authentication required to check document status');
  }

  // Get user profile
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (userError || !userProfile) {
    throw new AuthorizationError('User profile not found');
  }

  // Get document details
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select(
      `
      *,
      projects!inner(id, organization_id, created_by, assigned_to, deleted_at)
    `
    )
    .eq('id', documentId)
    .single();

  if (docError) {
    if (docError.code === 'PGRST116') {
      throw new NotFoundError(`Document ${documentId}`);
    }
    throw new DatabaseError('select', docError.message, { table: 'documents' });
  }

  if (!document) {
    throw new NotFoundError(`Document ${documentId}`);
  }

  // Verify organization access for multi-tenant security
  if (document.organization_id !== userProfile.organization_id) {
    throw new AuthorizationError('Cross-organization access denied');
  }

  // Check if analysis results exist
  const { data: analysisResults, error: analysisError } = await supabase
    .from('analysis_results')
    .select('id, created_at, confidence_score')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (analysisError) {
    throw new DatabaseError('select', analysisError.message, { table: 'analysis_results' });
  }

  // Return document status and analysis results if available
  return NextResponse.json({
    documentId,
    status: document.status,
    lastUpdated: document.updated_at,
    analysisResults:
      analysisResults && analysisResults.length > 0
        ? {
            id: analysisResults[0]!.id,
            createdAt: analysisResults[0]!.created_at,
            confidenceScore: analysisResults[0]!.confidence_score,
          }
        : null,
  });
});
