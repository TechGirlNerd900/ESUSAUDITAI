import NodeCache from 'node-cache';
import { withRetry } from '../errorHandler';

// Cache configuration
const DEFAULT_CACHE_TTL = 60; // 60 seconds default TTL
const LONG_CACHE_TTL = 300; // 5 minutes for less frequently changing data

// Initialize cache
const queryCache = new NodeCache({
  stdTTL: DEFAULT_CACHE_TTL,
  checkperiod: 30, // Check for expired entries every 30 seconds
  useClones: false, // For better performance
});

// Import pagination interfaces from consolidated module
import { PaginationParams } from '@/lib/db/pagination';

// Interface for filter parameters
export interface FilterParams {
  [key: string]: any;
}

// Interface for query options
export interface QueryOptions extends PaginationParams {
  filters?: FilterParams;
  search?: string;
  searchFields?: string[];
  select?: string | string[];
  count?: boolean;
  cache?: boolean;
  cacheTTL?: number;
  retries?: number;
}

// Interface for paginated response (queryOptimizer style)
export interface QueryOptimizerResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * Optimized query builder for Supabase
 * Provides caching, pagination, filtering, and retry capabilities
 */
export class QueryOptimizer {
  private supabase: any;
  private defaultOptions: Partial<QueryOptions> = {
    page: 1,
    pageSize: 20,
    sortBy: 'created_at',
    sortOrder: 'desc',
    cache: true,
    cacheTTL: DEFAULT_CACHE_TTL,
    retries: 2,
  };

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  /**
   * Execute an optimized query with caching and pagination
   * @param table The table to query
   * @param options Query options including pagination, filtering, etc.
   * @returns Paginated response with data and pagination metadata
   */
  async query<T>(table: string, options: QueryOptions = {}): Promise<QueryOptimizerResponse<T>> {
    // Merge default options
    const opts = { ...this.defaultOptions, ...options };

    // Generate cache key if caching is enabled
    const cacheKey = opts.cache ? this.generateCacheKey(table, opts) : null;

    // Check cache first if enabled
    if (cacheKey && queryCache.has(cacheKey)) {
      return queryCache.get(cacheKey) as QueryOptimizerResponse<T>;
    }

    // Execute query with retry logic
    const result = await withRetry(() => this.executeQuery<T>(table, opts), {
      maxRetries: opts.retries || 2,
      shouldRetry: (error) => {
        // Only retry on network or timeout errors, not on validation errors
        return (
          error?.message?.includes('network') ||
          error?.message?.includes('timeout') ||
          error?.code === 'PGRST116'
        );
      },
    });

    // Cache the result if caching is enabled
    if (cacheKey) {
      // Ensure cacheTTL is a number before passing it
      const ttl = typeof opts.cacheTTL === 'number' ? opts.cacheTTL : DEFAULT_CACHE_TTL;
      queryCache.set(cacheKey, result, ttl);
    }

    return result;
  }

  /**
   * Execute a single query without pagination
   * @param table The table to query
   * @param options Query options
   * @returns Single record or null
   */
  async queryOne<T>(
    table: string,
    id: string,
    options: Omit<QueryOptions, 'page' | 'pageSize'> = {}
  ): Promise<T | null> {
    // Merge default options
    const opts = {
      ...this.defaultOptions,
      ...options,
      page: undefined,
      pageSize: undefined,
    };

    // Generate cache key if caching is enabled
    const cacheKey = opts.cache ? `${table}:${id}:${JSON.stringify(opts)}` : null;

    // Check cache first if enabled
    if (cacheKey && queryCache.has(cacheKey)) {
      return queryCache.get(cacheKey) as T;
    }

    // Execute query with retry logic
    const result = await withRetry(
      async () => {
        let query = this.supabase.from(table).select(this.buildSelectString(opts.select));

        // Add ID filter
        query = query.eq('id', id).single();

        const { data, error } = await query;

        if (error) throw error;
        return data;
      },
      { maxRetries: opts.retries || 2 }
    );

    // Cache the result if caching is enabled
    if (cacheKey && result) {
      // Ensure cacheTTL is a number before passing it
      const ttl = typeof opts.cacheTTL === 'number' ? opts.cacheTTL : DEFAULT_CACHE_TTL;
      queryCache.set(cacheKey, result, ttl);
    }

    return result;
  }

  /**
   * Invalidate cache for a specific table or record
   * @param table The table name
   * @param id Optional record ID to invalidate specific record
   */
  invalidateCache(table: string, id?: string): void {
    if (id) {
      // Invalidate specific record
      const keys = queryCache.keys();
      const pattern = new RegExp(`^${table}:${id}:`);

      keys.forEach((key) => {
        if (pattern.test(key)) {
          queryCache.del(key);
        }
      });
    } else {
      // Invalidate all entries for this table
      const keys = queryCache.keys();
      const pattern = new RegExp(`^${table}:`);

      keys.forEach((key) => {
        if (pattern.test(key)) {
          queryCache.del(key);
        }
      });
    }
  }

  /**
   * Clear the entire cache
   */
  clearCache(): void {
    queryCache.flushAll();
  }

  /**
   * Execute the actual query with all options applied
   * @param table The table to query
   * @param options Query options
   * @returns Paginated response
   */
  private async executeQuery<T>(
    table: string,
    options: QueryOptions
  ): Promise<QueryOptimizerResponse<T>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
      filters = {},
      search,
      searchFields = [],
      select,
      count = true,
    } = options;

    // Calculate pagination range
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Build select string
    const selectString = this.buildSelectString(select);

    // Start building the query
    let query = this.supabase
      .from(table)
      .select(selectString, { count: count ? 'exact' : undefined });

    // Apply filters
    query = this.applyFilters(query, filters);

    // Apply search if provided
    if (search && searchFields.length > 0) {
      query = this.applySearch(query, search, searchFields);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(from, to);

    // Execute the query
    const { data, error, count: totalCount } = await query;

    if (error) throw error;

    // Calculate pagination metadata
    const totalPages = Math.ceil((totalCount || 0) / pageSize);

    return {
      data: data || [],
      pagination: {
        total: totalCount || 0,
        page,
        pageSize,
        totalPages,
      },
    };
  }

  /**
   * Apply filters to the query
   * @param query The Supabase query builder
   * @param filters Object containing filter key-value pairs
   * @returns Updated query with filters applied
   */
  private applyFilters(query: any, filters: FilterParams): any {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // Handle array values (IN operator)
          query = query.in(key, value);
        } else if (typeof value === 'object') {
          // Handle range filters with gt, lt, gte, lte
          Object.entries(value).forEach(([operator, operand]) => {
            if (operand !== undefined && operand !== null) {
              switch (operator) {
                case 'gt':
                  query = query.gt(key, operand);
                  break;
                case 'gte':
                  query = query.gte(key, operand);
                  break;
                case 'lt':
                  query = query.lt(key, operand);
                  break;
                case 'lte':
                  query = query.lte(key, operand);
                  break;
                case 'not':
                  query = query.neq(key, operand);
                  break;
              }
            }
          });
        } else {
          // Simple equality filter
          query = query.eq(key, value);
        }
      }
    });

    return query;
  }

  /**
   * Apply search to the query
   * @param query The Supabase query builder
   * @param search Search term
   * @param searchFields Fields to search in
   * @returns Updated query with search applied
   */
  private applySearch(query: any, search: string, searchFields: string[]): any {
    if (!search || searchFields.length === 0) return query;

    // Build OR conditions for each search field
    const searchConditions = searchFields.map((field) => `${field}.ilike.%${search}%`);
    const searchQuery = searchConditions.join(',');

    return query.or(searchQuery);
  }

  /**
   * Build the select string for the query
   * @param select Fields to select
   * @returns Select string
   */
  private buildSelectString(select?: string | string[]): string {
    if (!select) return '*';

    if (Array.isArray(select)) {
      return select.join(',');
    }

    return select;
  }

  /**
   * Generate a cache key for the query
   * @param table Table name
   * @param options Query options
   * @returns Cache key string
   */
  private generateCacheKey(table: string, options: QueryOptions): string {
    const { page, pageSize, sortBy, sortOrder, filters, search, searchFields, select } = options;

    // Create a simplified options object for the cache key
    const keyOptions = {
      page,
      pageSize,
      sortBy,
      sortOrder,
      filters,
      search,
      searchFields,
      select,
    };

    return `${table}:query:${JSON.stringify(keyOptions)}`;
  }
}

/**
 * Create a query optimizer instance with the provided Supabase client
 * @param supabaseClient Supabase client instance
 * @returns QueryOptimizer instance
 */
export function createQueryOptimizer(supabaseClient: any): QueryOptimizer {
  return new QueryOptimizer(supabaseClient);
}
