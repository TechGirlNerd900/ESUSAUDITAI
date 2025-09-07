import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  withErrorHandling,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
} from '@/lib/errorHandler';
import configManager, { IntegrationType } from '@/lib/core/configManager';
import { z } from 'zod';

// Validation schema for API integration
const integrationSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  type: z.nativeEnum(IntegrationType),
  endpoint: z.string().url(),
  api_key: z.string().min(1),
  config: z.record(z.any()).default({}),
  enabled: z.boolean().default(true),
});

/**
 * GET handler for API integrations
 * Returns all API integrations or a specific one
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Initialize Supabase client
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new AuthenticationError('Authentication required to access API integrations');
  }

  // Get user profile
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('auth_user_id', user.id)
    .single();

  if (userError || !userProfile) {
    throw new AuthorizationError('User profile not found');
  }

  // Check if user is admin
  if (userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
    throw new AuthorizationError('Admin privileges required to access API integrations');
  }

  // Get query parameters
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const type = url.searchParams.get('type') as IntegrationType | null;

  // Get specific API integration
  if (id) {
    const integration = await configManager.getIntegration(id);

    if (!integration) {
      throw new NotFoundError(`API integration "${id}"`);
    }

    return NextResponse.json(integration);
  }

  // Get API integrations by type
  if (type) {
    const integrations = await configManager.getIntegrationsByType(
      type as IntegrationType,
      userProfile.organization_id
    );

    return NextResponse.json(integrations);
  }

  // Get all API integrations
  const integrations = [];

  for (const integrationType of Object.values(IntegrationType)) {
    const typeIntegrations = await configManager.getIntegrationsByType(
      integrationType as IntegrationType,
      userProfile.organization_id
    );

    integrations.push(...typeIntegrations);
  }

  return NextResponse.json(integrations);
});

/**
 * PUT handler for API integrations
 * Creates or updates an API integration
 */
export const PUT = withErrorHandling(async (request: NextRequest) => {
  // Initialize Supabase client
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new AuthenticationError('Authentication required to manage API integrations');
  }

  // Get user profile
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('auth_user_id', user.id)
    .single();

  if (userError || !userProfile) {
    throw new AuthorizationError('User profile not found');
  }

  // Check if user is admin
  if (userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
    throw new AuthorizationError('Admin privileges required to manage API integrations');
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Invalid JSON in request body');
  }

  // Validate API integration
  try {
    body = integrationSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Invalid API integration',
        error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
      );
    }
    throw error;
  }

  // Set API integration
  const result = await configManager.setIntegration(
    {
      ...body,
      organization_id: userProfile.organization_id,
    },
    user.id
  );

  return NextResponse.json(result);
});

/**
 * DELETE handler for API integrations
 * Deletes an API integration
 */
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  // Initialize Supabase client
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new AuthenticationError('Authentication required to delete API integrations');
  }

  // Get user profile
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  if (userError || !userProfile) {
    throw new AuthorizationError('User profile not found');
  }

  // Check if user is admin
  if (userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
    throw new AuthorizationError('Admin privileges required to delete API integrations');
  }

  // Get query parameters
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    throw new ValidationError('ID parameter is required');
  }

  // Delete API integration
  const success = await configManager.deleteIntegration(id, user.id);

  if (!success) {
    throw new NotFoundError(`API integration "${id}"`);
  }

  return NextResponse.json({ message: `API integration ${id} deleted successfully` });
});
