'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, Search, Archive, RotateCw, FileText, Filter, AlertTriangle, RefreshCw } from 'lucide-react'; // Added AlertTriangle, RefreshCw
import AuditLogViewer from '../components/AuditLogViewer';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'; // Added useAuthenticatedFetch
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'; // Added AlertTitle
import { Button } from '@/components/ui/button'; // Added Button for retry
import { Skeleton } from '@/components/ui/skeleton'; // Added Skeleton for loading state
import CreateProjectModal from '../components/CreateProjectModal'; // Added CreateProjectModal

import { 
  handleApiError, 
  handleApiSuccess, 
  showToast, // Renamed from showErrorToast
  shouldRetryError, 
  ErrorCategory,
  ApiErrorResult 
} from '@/lib/utils/errorHandler'; // Added error handling utility

interface Project {
  id: string;
  name: string;
  client_name: string;
  organization_id: string;
  created_at: string;
  deleted_at: string | null;
  tags?: string[];
  custom_fields?: Record<string, any>;
  document_count?: number;
  due_date?: string;
  audit_type?: string;
}

const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => (
  <div className="relative group">
    {children}
    <div className="absolute bottom-full mb-2 w-max bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
      {text}
    </div>
  </div>
);

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResult | null>(null); // Changed error type
  const [auditProject, setAuditProject] = useState<Project | null>(null);
  const [retryCount, setRetryCount] = useState(0); // Added retry count state
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false); // Added state for create project modal
  const [archivingProjectId, setArchivingProjectId] = useState<string | null>(null); // Added state for archiving/restoring

  const authenticatedFetch = useAuthenticatedFetch(); // Initialize authenticatedFetch

  const fetchProjects = async () => {
    setLoading(true);
    setError(null); // Clear previous errors
    try {
      const response = await authenticatedFetch('/api/projects');
      if (!response.ok) {
        const errorResult = await handleApiError(response, { 
          endpoint: 'projects', 
          showToast: false, // Don't show toast for initial load errors, display inline
          resourceType: 'projects',
          isListEndpoint: true // Treat 404 as empty state for list endpoints
        });
        if (errorResult.isEmptyState) {
          setProjects([]); // Set projects to empty array for empty state
          setError(null); // Clear error to show empty state UI
        } else {
          setError(errorResult);
        }
      } else {
        const successResult = await handleApiSuccess<{ projects: Project[] }>(response); // Specify expected type
        setProjects(successResult.data?.projects || []);
        setError(null); // Clear error on success
      }
    } catch (e) {
      // Network errors or other unexpected fetch issues
      const errorResult = await handleApiError(null, { 
        endpoint: 'projects', 
        showToast: true,
        customMessage: 'Failed to connect to the server. Please check your internet connection.'
      });
      setError(errorResult);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [retryCount]); // Added retryCount to dependencies

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const handleArchiveRestore = async (project: Project) => {
    setArchivingProjectId(project.id); // Set archiving project ID
    try {
      const endpoint = `/api/projects/${project.id}/archive`;
      const method = project.deleted_at ? 'DELETE' : 'POST'; // DELETE to restore, POST to archive
      
      const response = await authenticatedFetch(endpoint, { method });

      if (!response.ok) {
        await handleApiError(response, { 
          endpoint: 'archive/restore project', 
          showToast: true 
        });
      } else {
        await handleApiSuccess(response);
        setProjects(prevProjects => 
          prevProjects.map(p => 
            p.id === project.id ? { ...p, deleted_at: project.deleted_at ? null : new Date().toISOString() } : p
          )
        );
        showToast(
          project.deleted_at ? 'Project restored successfully!' : 'Project archived successfully!', 
          'default'
        );
      }
    } catch (e) {
      await handleApiError(null, { 
        endpoint: 'archive/restore project', 
        showToast: true,
        customMessage: 'Failed to connect to the server. Please check your internet connection.'
      });
    } finally {
      setArchivingProjectId(null); // Clear archiving project ID
    }
  };

  const handleProjectCreated = (newProject: Project) => {
    setProjects(prev => [...prev, newProject]);
    setShowCreateProjectModal(false);
    // Success toast is now handled within CreateProjectModal as per Comment 3
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.client_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 sm:p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-lg text-gray-600">Manage your audit projects</p>
        </div>
        <Tooltip text="Create a new project">
          <Button onClick={() => setShowCreateProjectModal(true)} className="btn-primary flex items-center">
            <PlusCircle className="h-5 w-5 mr-2" />
            New Project
          </Button>
        </Tooltip>
      </header>

      <div className="mb-6 flex items-center justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        <Tooltip text="Filter projects">
          <button className="btn-outline flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filter
          </button>
        </Tooltip>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full bg-gray-200 rounded-lg shadow-md" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex justify-between items-center">
            {error.message}
            {error.shouldRetry && shouldRetryError(error.category, retryCount) && (
              <Button variant="ghost" onClick={handleRetry} className="ml-4">
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-4">No projects found.</p>
          <Button onClick={() => setShowCreateProjectModal(true)} className="btn-primary">
            <PlusCircle className="h-5 w-5 mr-2" /> Create Your First Project
          </Button>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredProjects.map((project) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`card p-6 flex flex-col justify-between ${project.deleted_at ? 'opacity-60 bg-gray-50' : 'bg-white'}`}
              >
                <div>
                  <h3 className="font-bold text-lg mb-2">{project.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">Client: {project.client_name}</p>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex space-x-2">
                    <Tooltip text={project.deleted_at ? 'Restore Project' : 'Archive Project'}>
                      <Button
                        onClick={() => handleArchiveRestore(project)}
                        variant="ghost"
                        size="icon"
                        disabled={archivingProjectId === project.id}
                      >
                        {archivingProjectId === project.id ? (
                          <RotateCw className="h-4 w-4 animate-spin" />
                        ) : project.deleted_at ? (
                          <RotateCw className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </Button>
                    </Tooltip>
                    <Tooltip text="View Audit Trail">
                      <Button
                        onClick={() => setAuditProject(project)}
                        variant="ghost"
                        size="icon"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                  </div>
                  <span className="text-xs">
                    Created: {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {auditProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg w-full max-w-2xl p-4 shadow-lg relative"
            >
              <button
                onClick={() => setAuditProject(null)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
              <AuditLogViewer
                organizationId={auditProject.organization_id}
                resourceType="projects"
                resourceId={auditProject.id}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CreateProjectModal
        isOpen={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
}
