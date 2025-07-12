import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  withErrorHandling,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
} from '@/lib/errorHandler';
import configManager, { ConfigCategory } from '@/lib/configManager';
import { z } from 'zod';

// Validation schema for environment variable
const envVarSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Z0-9_]+$/, 'Key must be uppercase with underscores'),
  value: z.string(),
  description: z.string().optional(),
  category: z.enum(['database', 'azure', 'auth', 'security', 'monitoring', 'custom']),
  sensitive: z.boolean().default(false),
});

/**
 * GET handler for environment variables
 * Returns all environment variables or a specific one
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
    throw new AuthenticationError('Authentication required to access environment variables');
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
    throw new AuthorizationError('Admin privileges required to access environment variables');
  }

  // Get query parameters
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const category = url.searchParams.get('category') as ConfigCategory | null;

  // Get specific environment variable
  if (key) {
    const value = await configManager.getConfig(key);

    if (!value) {
      throw new NotFoundError(`Environment variable "${key}"`);
    }

    // Get the full config item to check if it's sensitive
    const envVars = await configManager.getAllConfig();
    const configItem = envVars.find((item) => item.key === key);
    const maskedValue = configItem?.sensitive ? '********' : value;

    return NextResponse.json({ key, value: maskedValue });
  }

  // Get all environment variables, optionally filtered by category
  const envVars = await configManager.getAllConfig(category || undefined);

  return NextResponse.json(envVars);
});

/**
 * PUT handler for environment variables
 * Creates or updates an environment variable
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
    throw new AuthenticationError('Authentication required to manage environment variables');
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
    throw new AuthorizationError('Admin privileges required to manage environment variables');
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Invalid JSON in request body');
  }

  // Validate environment variable
  try {
    body = envVarSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Invalid environment variable',
        error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
      );
    }
    throw error;
  }

  // Set environment variable
  const options: {
    category: ConfigCategory;
    sensitive: boolean;
    userId: string;
    organizationId: string;
    description?: string;
  } = {
    category: body.category as ConfigCategory,
    sensitive: body.sensitive,
    userId: user.id,
    organizationId: userProfile.organization_id,
  };

  // Only add description if it's defined
  if (body.description !== undefined) {
    options.description = body.description;
  }

  const result = await configManager.setConfig(body.key, body.value, options);

  return NextResponse.json(result);
});

/**
 * DELETE handler for environment variables
 * Deletes an environment variable
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
    throw new AuthenticationError('Authentication required to delete environment variables');
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
    throw new AuthorizationError('Admin privileges required to delete environment variables');
  }

  // Get query parameters
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    throw new ValidationError('Key parameter is required');
  }

  // Delete environment variable
  const success = await configManager.deleteConfig(key);

  if (!success) {
    throw new NotFoundError(`Environment variable '${key}'`);
  }

  return NextResponse.json({ message: `Environment variable ${key} deleted successfully` });
});
