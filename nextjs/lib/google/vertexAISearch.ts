/**
 * Google Cloud Vertex AI Search Service
 *
 * This service handles search operations using Google Cloud Vertex AI Search
 * to replace Azure Search functionality.
 */

import { SearchServiceClient } from '@google-cloud/discoveryengine';
import { env } from '../env';

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  url?: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface SearchRequest {
  query: string;
  pageSize?: number;
  pageToken?: string;
  filter?: string;
  orderBy?: string;
  userInfo?: {
    userId: string;
    userAgent?: string;
  };
  contentSearchSpec?: {
    summarySpec?: {
      summaryResultCount?: number;
      includeCitations?: boolean;
    };
  };
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  nextPageToken?: string;
  summary?: {
    summaryText: string;
  };
  facets?: Array<{
    key: string;
    values: Array<{
      value: string;
      count: number;
    }>;
  }>;
}

export interface DocumentToIndex {
  id: string;
  title: string;
  content: string;
  url?: string;
  metadata?: Record<string, any>;
  mimeType?: string;
}

export class VertexAISearchService {
  private client: SearchServiceClient;
  private projectId: string;
  private location: string;
  private dataStoreId: string;
  private servingConfig: string;

  constructor() {
    this.projectId = env.GOOGLE_PROJECT_ID || '';
    this.location = env.VERTEX_AI_SEARCH_LOCATION || 'global';
    this.dataStoreId = env.VERTEX_AI_SEARCH_DATA_STORE_ID || '';

    if (!this.projectId || !this.dataStoreId) {
      throw new Error(
        'Google Cloud Vertex AI Search configuration is missing. Please set GOOGLE_PROJECT_ID and VERTEX_AI_SEARCH_DATA_STORE_ID environment variables.'
      );
    }

    // Initialize Search Service client
    const clientOptions: {
      projectId: string;
      keyFilename?: string;
    } = {
      projectId: this.projectId,
    };
    if (env.GOOGLE_APPLICATION_CREDENTIALS) {
      clientOptions.keyFilename = env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    this.client = new SearchServiceClient(clientOptions);

    // Construct serving config path
    this.servingConfig = `projects/${this.projectId}/locations/${this.location}/dataStores/${this.dataStoreId}/servingConfigs/default_config`;
  }

  /**
   * Search for documents using Vertex AI Search
   * @param request - Search request parameters
   * @returns Search response with results
   */
  async search(request: SearchRequest): Promise<SearchResponse> {
    try {
      const searchRequest = {
        servingConfig: this.servingConfig,
        query: request.query,
        pageSize: request.pageSize || 10,
        pageToken: request.pageToken ?? null,
        filter: request.filter ?? null,
        orderBy: request.orderBy ?? null,
        contentSearchSpec: request.contentSearchSpec,
        userInfo: request.userInfo
          ? {
              userId: request.userInfo.userId,
              userAgent: request.userInfo.userAgent,
            }
          : undefined,
      };

      const apiResponse = await this.client.search(searchRequest as any);
      const searchResults = apiResponse[0];
      const fullResponse = apiResponse[2] as any; // Using any as ISearchResponse is not imported

      const results: SearchResult[] = (searchResults || []).map((result: any, index: number) => {
        const searchResult: SearchResult = {
          id: result.document?.id || `result-${index}`,
          title: this.extractTitle(result.document),
          content: this.extractContent(result.document),
          score: result.score || 0,
          metadata: this.extractMetadata(result.document),
        };
        const url = this.extractUrl(result.document);
        if (url) {
          searchResult.url = url;
        }
        return searchResult;
      });

      const response: SearchResponse = {
        results,
        totalCount: fullResponse.totalSize || results.length,
        nextPageToken: fullResponse.nextPageToken,
        facets: this.extractFacets(fullResponse.facets),
      };

      if (fullResponse.summary) {
        response.summary = { summaryText: fullResponse.summary.summaryText as string };
      }

      return response;
    } catch (error) {
      console.error('Vertex AI Search error:', error);
      throw new Error(
        `Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Search for similar documents based on a reference document
   * @param documentId - ID of the reference document
   * @param pageSize - Number of results to return
   * @returns Search response with similar documents
   */
  async searchSimilar(documentId: string, pageSize: number = 10): Promise<SearchResponse> {
    try {
      const searchRequest = {
        servingConfig: this.servingConfig,
        query: `similar_to:${documentId}`,
        pageSize,
      };

      const apiResponse = await this.client.search(searchRequest);
      const searchResults = apiResponse[0];
      const fullResponse = apiResponse[2] as any;

      const results: SearchResult[] = (searchResults || []).map((result: any, index: number) => {
        const searchResult: SearchResult = {
          id: result.document?.id || `similar-${index}`,
          title: this.extractTitle(result.document),
          content: this.extractContent(result.document),
          score: result.score || 0,
          metadata: this.extractMetadata(result.document),
        };
        const url = this.extractUrl(result.document);
        if (url) {
          searchResult.url = url;
        }
        return searchResult;
      });

      return {
        results,
        totalCount: fullResponse.totalSize || results.length,
        nextPageToken: fullResponse.nextPageToken,
      };
    } catch (error) {
      console.error('Vertex AI Search similar error:', error);
      throw new Error(
        `Failed to find similar documents: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get document by ID
   * @param documentId - Document ID
   * @returns Document details
   */
  async getDocument(documentId: string): Promise<SearchResult | null> {
    try {
      const searchRequest = {
        servingConfig: this.servingConfig,
        query: `id:${documentId}`,
        pageSize: 1,
      };

      const apiResponse = await this.client.search(searchRequest);
      const searchResults = apiResponse[0];
      const result = searchResults?.[0];

      if (!result) {
        return null;
      }

      const doc: SearchResult = {
        id: result.document?.id || documentId,
        title: this.extractTitle(result.document),
        content: this.extractContent(result.document),
        score: (result as any).score || 0,
        metadata: this.extractMetadata(result.document),
      };
      const url = this.extractUrl(result.document);
      if (url) {
        doc.url = url;
      }
      return doc;
    } catch (error) {
      console.error('Vertex AI Search get document error:', error);
      throw new Error(
        `Failed to get document: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Search with filters for specific document types or metadata
   * @param query - Search query
   * @param filters - Filter conditions
   * @param pageSize - Number of results to return
   * @returns Filtered search results
   */
  async searchWithFilters(
    query: string,
    filters: Record<string, string | string[]>,
    pageSize: number = 10
  ): Promise<SearchResponse> {
    try {
      // Build filter string
      const filterParts = Object.entries(filters).map(([key, value]) => {
        if (Array.isArray(value)) {
          return value.map((v) => `${key}:"${v}"`).join(' OR ');
        }
        return `${key}:"${value}"`;
      });

      const filterString = filterParts.join(' AND ');

      return await this.search({
        query,
        filter: filterString,
        pageSize,
      });
    } catch (error) {
      console.error('Vertex AI Search with filters error:', error);
      throw new Error(
        `Failed to search with filters: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract title from document
   */
  private extractTitle(document: any): string {
    if (!document) return 'Untitled';

    // Try different title fields
    return (
      document.title || document.name || document.heading || document.metadata?.title || 'Untitled'
    );
  }

  /**
   * Extract content from document
   */
  private extractContent(document: any): string {
    if (!document) return '';

    // Try different content fields
    return document.content || document.text || document.summary || document.description || '';
  }

  /**
   * Extract URL from document
   */
  private extractUrl(document: any): string | undefined {
    if (!document) return undefined;

    return document.uri || document.url || document.link || document.metadata?.url;
  }

  /**
   * Extract metadata from document
   */
  private extractMetadata(document: any): Record<string, any> {
    if (!document) return {};

    return {
      ...document.metadata,
      mimeType: document.mimeType,
      createTime: document.createTime,
      updateTime: document.updateTime,
    };
  }

  /**
   * Extract facets from search response
   */
  private extractFacets(facets: any[]): Array<{
    key: string;
    values: Array<{
      value: string;
      count: number;
    }>;
  }> {
    if (!facets) return [];

    return facets.map((facet) => ({
      key: facet.key || 'unknown',
      values: (facet.values || []).map((value: any) => ({
        value: value.value || '',
        count: value.count || 0,
      })),
    }));
  }
}

// Export a singleton instance
export const vertexAISearchService = new VertexAISearchService();
