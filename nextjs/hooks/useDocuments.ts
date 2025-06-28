'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { 
  Document, 
  DocumentFilters, 
  ApiResponse,
  PaginationInfo 
} from '@/types/components';

interface DocumentsState {
  documents: Document[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo;
}

interface DocumentsActions {
  createDocument: (data: Omit<Document, 'id' | 'created_at' | 'updated_at'>) => Promise<ApiResponse<Document>>;
  updateDocument: (id: string, data: Partial<Document>) => Promise<ApiResponse<Document>>;
  deleteDocument: (id: string) => Promise<ApiResponse<void>>;
  refreshDocuments: () => Promise<void>;
  setFilters: (filters: DocumentFilters) => void;
  setPage: (page: number) => void;
}

export function useDocuments(
  projectId?: string,
  initialFilters: DocumentFilters = {}
): DocumentsState & DocumentsActions {
  const [state, setState] = useState<DocumentsState>({
    documents: [],
    loading: true,
    error: null,
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0
    }
  });

  const [filters, setCurrentFilters] = useState<DocumentFilters>(initialFilters);
  const supabase = createClient();

  // Fetch documents with filters and pagination
  const fetchDocuments = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Build query
      let query = supabase
        .from('documents')
        .select('*, project:projects(name)', { count: 'exact' });

      // Add project filter if provided
      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      // Add filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      if (filters.searchTerm) {
        query = query.or(`name.ilike.%${filters.searchTerm}%,description.ilike.%${filters.searchTerm}%`);
      }

      if (filters.dateRange?.start) {
        query = query.gte('created_at', filters.dateRange.start);
      }

      if (filters.dateRange?.end) {
        query = query.lte('created_at', filters.dateRange.end);
      }

      // Add pagination
      const from = (state.pagination.page - 1) * state.pagination.limit;
      const to = from + state.pagination.limit - 1;
      query = query.range(from, to);

      // Add sorting
      query = query.order('updated_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        throw new Error(error.message);
      }

      const totalPages = Math.ceil((count || 0) / state.pagination.limit);

      setState(prev => ({
        ...prev,
        documents: data || [],
        loading: false,
        pagination: {
          ...prev.pagination,
          total: count || 0,
          totalPages
        }
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch documents'
      }));
    }
  }, [projectId, filters, state.pagination.page, state.pagination.limit, supabase]);

  // Create new document
  const createDocument = useCallback(async (
    data: Omit<Document, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ApiResponse<Document>> => {
    try {
      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      const tempDocument: Document = {
        ...data,
        id: tempId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setState(prev => ({
        ...prev,
        documents: [tempDocument, ...prev.documents]
      }));

      const { data: newDocument, error } = await supabase
        .from('documents')
        .insert([data])
        .select('*, project:projects(name)')
        .single();

      if (error) {
        // Revert optimistic update
        setState(prev => ({
          ...prev,
          documents: prev.documents.filter(d => d.id !== tempId)
        }));
        throw new Error(error.message);
      }

      // Replace temp document with real one
      setState(prev => ({
        ...prev,
        documents: prev.documents.map(d => 
          d.id === tempId ? newDocument : d
        ),
        pagination: {
          ...prev.pagination,
          total: prev.pagination.total + 1
        }
      }));

      return {
        success: true,
        data: newDocument,
        message: 'Document created successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create document'
      };
    }
  }, [supabase]);

  // Update document
  const updateDocument = useCallback(async (
    id: string, 
    updates: Partial<Document>
  ): Promise<ApiResponse<Document>> => {
    try {
      // Optimistic update
      setState(prev => ({
        ...prev,
        documents: prev.documents.map(doc =>
          doc.id === id 
            ? { ...doc, ...updates, updated_at: new Date().toISOString() }
            : doc
        )
      }));

      const { data: updatedDocument, error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', id)
        .select('*, project:projects(name)')
        .single();

      if (error) {
        // Revert optimistic update
        await fetchDocuments();
        throw new Error(error.message);
      }

      // Update with actual data
      setState(prev => ({
        ...prev,
        documents: prev.documents.map(doc =>
          doc.id === id ? updatedDocument : doc
        )
      }));

      return {
        success: true,
        data: updatedDocument,
        message: 'Document updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update document'
      };
    }
  }, [supabase, fetchDocuments]);

  // Delete document (soft delete with organization check)
  const deleteDocument = useCallback(async (id: string): Promise<ApiResponse<void>> => {
    try {
      // Optimistic update
      setState(prev => ({
        ...prev,
        documents: prev.documents.filter(doc => doc.id !== id)
      }));

      const { error } = await supabase
        .from('documents')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        // Revert optimistic update
        await fetchDocuments();
        throw new Error(error.message);
      }

      setState(prev => ({
        ...prev,
        pagination: {
          ...prev.pagination,
          total: Math.max(0, prev.pagination.total - 1)
        }
      }));

      return {
        success: true,
        message: 'Document deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete document'
      };
    }
  }, [supabase, fetchDocuments]);

  // Refresh documents
  const refreshDocuments = useCallback(async () => {
    await fetchDocuments();
  }, [fetchDocuments]);

  // Set filters
  const setFilters = useCallback((newFilters: DocumentFilters) => {
    setCurrentFilters(newFilters);
    setState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, page: 1 } // Reset to first page
    }));
  }, []);

  // Set page
  const setPage = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, page }
    }));
  }, []);

  // Initial fetch and refetch when dependencies change
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Real-time subscription for document changes
  useEffect(() => {
    const channel = supabase
      .channel('documents-changes')
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: projectId ? `project_id=eq.${projectId}` : undefined
        },
        (payload: any) => {
          console.log('Document change received:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newDoc = payload.new as Document;
            setState(prev => ({
              ...prev,
              documents: [newDoc, ...prev.documents],
              pagination: {
                ...prev.pagination,
                total: prev.pagination.total + 1
              }
            }));
          } else if (payload.eventType === 'UPDATE') {
            const updatedDoc = payload.new as Document;
            setState(prev => ({
              ...prev,
              documents: prev.documents.map(doc =>
                doc.id === updatedDoc.id ? updatedDoc : doc
              )
            }));
          } else if (payload.eventType === 'DELETE') {
            const deletedDoc = payload.old as Document;
            setState(prev => ({
              ...prev,
              documents: prev.documents.filter(doc => doc.id !== deletedDoc.id),
              pagination: {
                ...prev.pagination,
                total: Math.max(0, prev.pagination.total - 1)
              }
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, projectId]);

  return {
    ...state,
    createDocument,
    updateDocument,
    deleteDocument,
    refreshDocuments,
    setFilters,
    setPage
  };
}