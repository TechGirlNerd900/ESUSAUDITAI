'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, Search, Archive, RotateCw, FileText, Filter } from 'lucide-react';
import AuditLogViewer from '../components/AuditLogViewer';

// ... (interface definitions remain the same)
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
  const [error, setError] = useState<string | null>(null);
  const [auditProject, setAuditProject] = useState<Project | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error('Failed to fetch projects');
        const data = await response.json();
        setProjects(data.projects || []);
      } catch (err) {
        setError('Failed to load projects. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const handleArchiveRestore = async (project: Project) => {
    // ... (implementation remains the same)
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
          <button className="btn-primary flex items-center">
            <PlusCircle className="h-5 w-5 mr-2" />
            New Project
          </button>
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
            <div key={i} className="bg-white p-6 rounded-lg shadow-md animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
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
                className={`card p-6 flex flex-col justify-between ${project.deleted_at ? 'opacity-60' : ''}`}
              >
                <div>
                  <h3 className="font-bold text-lg mb-2">{project.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">Client: {project.client_name}</p>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex space-x-2">
                    <Tooltip text={project.deleted_at ? 'Restore' : 'Archive'}>
                      <button
                        onClick={() => handleArchiveRestore(project)}
                        className="p-2 hover:bg-gray-100 rounded-full"
                      >
                        {project.deleted_at ? (
                          <RotateCw className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </button>
                    </Tooltip>
                    <Tooltip text="View Audit Trail">
                      <button
                        onClick={() => setAuditProject(project)}
                        className="p-2 hover:bg-gray-100 rounded-full"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </div>
                  <span className="text-xs">
                    {new Date(project.created_at).toLocaleDateString()}
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
    </div>
  );
}
