/**
 * Projects Hook - Phase 2.2 (Multi-tenant SaaS)
 * Purpose-driven hook for project management with Supabase + multi-tenancy
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Project, CreateProjectData, ProjectFilters, ApiResponse } from '@/types/components';

interface ProjectsState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;
}

interface ProjectsActions {
  createProject: (data: CreateProjectData) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  setFilters: (filters: ProjectFilters) => void;
}

export function useProjects(initialFilters?: ProjectFilters): ProjectsState & ProjectsActions {
  const [state, setState] = useState<ProjectsState>({
    projects: [],
    isLoading: true,
    error: null,
    totalCount: 0,
  });
  
  const [filters, setFilters] = useState<ProjectFilters>(initialFilters || {});
  const supabase = createClient();

  // Memoized query based on filters
  const query = useMemo(() => {
    let query = supabase
      .from('projects')
      .select(`
        *,
        created_by_user:users!created_by(first_name, last_name),
        assigned_to_user:users!assigned_to(first_name, last_name),
        documents(count)
      `, { count: 'exact' });

    // Apply filters with multi-tenant safety (organization_id is handled by RLS)
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,client_name.ilike.%${filters.search}%`);
    }
    
    if (filters.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }
    
    if (filters.dateRange) {
      query = query
        .gte('created_at', filters.dateRange.start)
        .lte('created_at', filters.dateRange.end);
    }

    return query.order('created_at', { ascending: false });
  }, [filters, supabase]);

  // Load projects
  const loadProjects = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { data, error, count } = await query;

      if (error) throw error;

      setState(prev => ({
        ...prev,
        projects: data || [],
        totalCount: count || 0,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load projects',
        isLoading: false,
      }));
    }
  }, [query]);

  // Load projects on mount and filter changes
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = useCallback(async (data: CreateProjectData): Promise<Project> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create project');
      }

      const newProject = await response.json();
      
      // Optimistically update local state
      setState(prev => ({
        ...prev,
        projects: [newProject, ...prev.projects],
        totalCount: prev.totalCount + 1,
        isLoading: false,
      }));

      return newProject;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create project',
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  const updateProject = useCallback(async (id: string, data: Partial<Project>): Promise<Project> => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update project');
      }

      const updatedProject = await response.json();

      // Optimistically update local state
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === id ? updatedProject : p),
      }));

      return updatedProject;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update project',
      }));
      throw error;
    }
  }, []);

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete project');
      }

      // Optimistically update local state
      setState(prev => ({
        ...prev,
        projects: prev.projects.filter(p => p.id !== id),
        totalCount: Math.max(0, prev.totalCount - 1),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to delete project',
      }));
      throw error;
    }
  }, []);

  const archiveProject = useCallback(async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/projects/${id}/archive`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to archive project');
      }

      // Refresh projects to reflect archive status
      await loadProjects();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to archive project',
      }));
      throw error;
    }
  }, [loadProjects]);

  const restoreProject = useCallback(async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/projects/${id}/restore`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to restore project');
      }

      // Refresh projects to reflect restore status
      await loadProjects();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to restore project',
      }));
      throw error;
    }
  }, [loadProjects]);

  const refreshProjects = useCallback(async () => {
    await loadProjects();
  }, [loadProjects]);

  return {
    ...state,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    restoreProject,
    refreshProjects,
    setFilters,
  };
}

// Specialized hook for a single project
export function useProject(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const loadProject = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          created_by_user:users!created_by(first_name, last_name, email),
          assigned_to_user:users!assigned_to(first_name, last_name, email),
          documents(id, name, file_type, created_at, is_analyzed),
          audit_logs(id, action, created_at, user:users(first_name, last_name))
        `)
        .eq('id', projectId)
        .single();

      if (error) throw error;

      setProject(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load project');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId, loadProject]);

  return {
    project,
    isLoading,
    error,
    refreshProject: loadProject,
  };
}