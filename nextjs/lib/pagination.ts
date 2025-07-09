/**
 * Pagination utilities for API endpoints
 * Implements cursor-based pagination for better performance
 */

export interface PaginationParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  cursor?: string | undefined;
  sortBy?: string | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

// Unified interface supporting both cursor and offset pagination
export interface UnifiedPaginationParams extends PaginationParams {
  // For offset-based pagination (queryOptimizer style)
  total?: number | undefined;
  // For cursor-based pagination (pagination.ts style)
  hasNextPage?: boolean | undefined;
  hasPreviousPage?: boolean | undefined;
  nextCursor?: string | undefined;
  previousCursor?: string | undefined;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount?: number;
    totalPages?: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
}

// Unified response interface supporting both pagination styles
export interface UnifiedPaginatedResponse<T> {
  data: T[];
  pagination: {
    // Common fields
    page: number;
    pageSize: number;
    // queryOptimizer style
    total?: number;
    totalPages?: number;
    // pagination.ts style
    totalCount?: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
}

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/**
 * Parse pagination parameters from request
 */
export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get('pageSize') || DEFAULT_PAGE_SIZE.toString()))
  );
  const cursor = searchParams.get('cursor') || undefined;
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

  return { page, pageSize, cursor, sortBy, sortOrder };
}

/**
 * Create pagination response
 */
export function createPaginatedResponse<T>(
  data: T[],
  params: PaginationParams,
  totalCount?: number
): PaginatedResponse<T> {
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE } = params;
  const hasNextPage = data.length === pageSize;
  const hasPreviousPage = page > 1;

  let totalPages: number | undefined;
  if (totalCount !== undefined) {
    totalPages = Math.ceil(totalCount / pageSize);
  }

  // For cursor-based pagination
  let nextCursor: string | undefined;
  let previousCursor: string | undefined;

  if (data.length > 0) {
    const lastItem = data[data.length - 1] as any;
    const firstItem = data[0] as any;

    if (hasNextPage && lastItem.id) {
      nextCursor = btoa(lastItem.id);
    }

    if (hasPreviousPage && firstItem.id) {
      previousCursor = btoa(firstItem.id);
    }
  }

  const paginationData: PaginatedResponse<T>['pagination'] = {
    page,
    pageSize,
    hasNextPage,
    hasPreviousPage,
  };

  if (totalCount !== undefined) {
    paginationData.totalCount = totalCount;
  }

  if (totalPages !== undefined) {
    paginationData.totalPages = totalPages;
  }

  if (nextCursor !== undefined) {
    paginationData.nextCursor = nextCursor;
  }

  if (previousCursor !== undefined) {
    paginationData.previousCursor = previousCursor;
  }

  return {
    data,
    pagination: paginationData,
  };
}

/**
 * Build optimized query with pagination
 */
export function buildPaginatedQuery(
  baseQuery: any,
  params: PaginationParams,
  allowedSortFields: string[] = ['created_at', 'updated_at', 'name']
) {
  const { pageSize, cursor, sortBy = 'created_at', sortOrder = 'desc' } = params;

  // Validate sort field
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

  let query = baseQuery.order(safeSortBy, { ascending: sortOrder === 'asc' }).limit(pageSize);

  // Apply cursor-based pagination if cursor provided
  if (cursor) {
    try {
      const decodedCursor = atob(cursor);
      if (sortOrder === 'desc') {
        query = query.lt(safeSortBy, decodedCursor);
      } else {
        query = query.gt(safeSortBy, decodedCursor);
      }
    } catch {
      console.warn('Invalid cursor provided:', cursor);
    }
  }

  return query;
}

/**
 * Add search filters to query
 */
export function addSearchFilters(
  query: any,
  searchParams: URLSearchParams,
  searchableFields: { [key: string]: string[] }
) {
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  // Text search across multiple fields
  if (search && search.trim()) {
    const searchTerm = search.trim();
    // Sanitize search term to prevent injection
    const sanitizedSearch = searchTerm.replace(/[%_\\]/g, '\\$&');

    // Build OR conditions for searchable fields
    const searchConditions = Object.entries(searchableFields).flatMap(([, fields]) =>
      fields.map((field) => `${field}.ilike.%${sanitizedSearch}%`)
    );

    if (searchConditions.length > 0) {
      query = query.or(searchConditions.join(','));
    }
  }

  // Status filter
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  // Date range filters
  if (dateFrom) {
    query = query.gte('created_at', new Date(dateFrom).toISOString());
  }

  if (dateTo) {
    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59, 999); // End of day
    query = query.lte('created_at', endDate.toISOString());
  }

  return query;
}

/**
 * Performance optimization for count queries
 * Uses approximate count for large datasets
 */
export async function getOptimizedCount(
  supabase: any,
  tableName: string,
  filters?: any
): Promise<number | undefined> {
  try {
    // For small datasets, use exact count
    let query = supabase.from(tableName).select('id', { count: 'exact', head: true });

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    const { count, error } = await query;

    if (error) {
      console.warn('Count query failed:', error);
      return undefined;
    }

    // For very large datasets (>10k), consider using approximate count
    if (count && count > 10000) {
      console.log(`Large dataset detected (${count} records), using approximate count`);
      return Math.round(count / 100) * 100; // Round to nearest 100
    }

    return count;
  } catch (error) {
    console.warn('Failed to get count:', error);
    return undefined;
  }
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(params: PaginationParams): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (params.page && (params.page < 1 || params.page > 10000)) {
    errors.push('Page must be between 1 and 10000');
  }

  if (params.pageSize && (params.pageSize < 1 || params.pageSize > MAX_PAGE_SIZE)) {
    errors.push(`Page size must be between 1 and ${MAX_PAGE_SIZE}`);
  }

  if (params.sortOrder && !['asc', 'desc'].includes(params.sortOrder)) {
    errors.push('Sort order must be either "asc" or "desc"');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
