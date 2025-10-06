import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/auth/apiAuth';
import { withErrorHandling, NotFoundError, AuthorizationError } from '@/lib/errorHandler';
import { createClient } from '@/utils/supabase/server';
import { successResponse } from '@/lib/api/apiResponse';

export const GET = withErrorHandling(
  async (request: NextRequest, context: { params: { id: string } }) => {
    const { id } = context.params;

    // Authenticate request
    const auth = await authenticateApiRequest(request);

    if (!auth.success) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get target user
    const { data: targetUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('deleted_at', null)
      .single();

    if (error || !targetUser) {
      throw new NotFoundError('User');
    }

    // Check organization access for non-self requests
    if (auth.user!.id !== targetUser.auth_user_id) {
      if (auth.profile.organization_id !== targetUser.organization_id || auth.profile.role !== 'admin') {
        throw new AuthorizationError('You do not have permission to access this user');
      }
    }

    return successResponse({ user: targetUser });
  }
);

export const PUT = withErrorHandling(
  async (request: NextRequest, context: { params: { id: string } }) => {
    const { id } = context.params;

    // Authenticate request
    const auth = await authenticateApiRequest(request);

    if (!auth.success) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const { first_name, last_name, company, custom_fields } = body;

    // Get target user to check organization access
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('organization_id, auth_user_id')
      .eq('id', id)
      .eq('deleted_at', null)
      .single();

    if (targetError || !targetUser) {
      throw new NotFoundError('User');
    }

    // Check organization access for non-self requests
    if (auth.user!.id !== targetUser.auth_user_id) {
      if (auth.profile.organization_id !== targetUser.organization_id || auth.profile.role !== 'admin') {
        throw new AuthorizationError('You do not have permission to update this user');
      }
    }

    // Update user
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        first_name,
        last_name,
        company,
        custom_fields: custom_fields || {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('deleted_at', null)
      .select()
      .single();

    if (error || !updatedUser) {
      throw new Error(`Failed to update user: ${error?.message}`);
    }

    return successResponse({ user: updatedUser }, 'User updated successfully');
  }
);

export const DELETE = withErrorHandling(
  async (request: NextRequest, context: { params: { id: string } }) => {
    const { id } = context.params;

    // Authenticate request with admin role requirement
    const auth = await authenticateApiRequest(request, ['admin']);

    if (!auth.success) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get target user
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', id)
      .single();

    if (targetError || !targetUser) {
      throw new NotFoundError('User');
    }

    // Check organization access
    if (auth.profile.organization_id !== targetUser.organization_id) {
      throw new AuthorizationError('You do not have permission to delete this user');
    }

    try {
      // Try soft delete RPC function
      const { error: softDeleteError } = await supabase.rpc('soft_delete', {
        table_name: 'users',
        row_id: id,
        org_id: targetUser.organization_id,
        user_id: auth.user!.id,
      });

      if (softDeleteError) {
        // Fall back to manual soft delete
        const { error: updateError } = await supabase
          .from('users')
          .update({
            deleted_at: new Date().toISOString(),
            is_active: false,
            status: 'deleted',
          })
          .eq('id', id);

        if (updateError) {
          throw new Error(`Failed to delete user: ${updateError.message}`);
        }
      }

      // Create audit log entry
      await supabase.from('audit_logs').insert([
        {
          user_id: auth.user!.id,
          action: 'user_deleted',
          resource_type: 'user',
          resource_id: id,
          details: {
            deleted_at: new Date().toISOString(),
          },
        },
      ]);

      return successResponse({ message: 'User deleted successfully' });
    } catch (error) {
      throw new Error(
        `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);
