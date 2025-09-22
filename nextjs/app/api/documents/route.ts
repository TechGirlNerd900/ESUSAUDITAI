import { NextRequest } from 'next/server';
import { Database } from '@/lib/db/database';
import { cookies } from 'next/headers';
import { authenticateApiRequest } from '@/lib/auth/apiAuth';
import { withErrorHandling } from '@/lib/errorHandler';
import { successResponse, errorResponse } from '@/lib/api/apiResponse';
import {
  parsePaginationParams,
  createPaginatedResponse,
  validatePaginationParams,
} from '@/lib/api/pagination';

/**
 * GET handler for documents
 * Retrieves documents with pagination and filtering
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Authenticate request
  const auth = await authenticateApiRequest(request);
  if (!auth.success) {
    return (auth as import('@/lib/auth/apiAuth').AuthFailure).response;
  }

  // Initialize database
  const cookieStore = await cookies();
  const db = new Database(cookieStore);

  // Get documents
  const { data: documents } = await db.getDocuments(auth.user.id);

  return successResponse({ documents: documents || [] });
});
