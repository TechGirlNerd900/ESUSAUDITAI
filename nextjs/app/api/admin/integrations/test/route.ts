import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  withErrorHandling,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
} from '@/lib/errorHandler';
import configManager from '@/lib/core/configManager';

/**
 * POST handler for testing API integrations
 * Tests an API integration and returns the result
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Initialize Supabase client
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new AuthenticationError('Authentication required to test API integrations');
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
    throw new AuthorizationError('Admin privileges required to test API integrations');
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Invalid JSON in request body');
  }

  // Validate request body
  if (!body.id) {
    throw new ValidationError('Integration ID is required');
  }

  // Check if integration exists
  const integration = await configManager.getIntegration(body.id);
  if (!integration) {
    throw new NotFoundError(`API integration "${body.id}"`);
  }

  // Test integration
  const testResult = await configManager.testIntegration(body.id);

  // Log test result
  try {
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'test',
      resource_type: 'api_integration',
      resource_id: body.id,
      details: {
        success: testResult.success,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Failed to log audit event', error);
  }

  return NextResponse.json({
    id: body.id,
    name: integration.name,
    type: integration.type,
    testResult,
  });
});
