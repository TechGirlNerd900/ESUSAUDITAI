'use client'

import React, { useState, useEffect } from 'react'
import AuditLogViewer from '../components/AuditLogViewer'



// Define Project type based on the API response
interface Project {
  id: string
  name: string
  client_name: string
  organization_id: string
  deleted_at: string | null
  tags?: string[]
  custom_fields?: Record<string, any>
  document_count?: number
  due_date?: string
  audit_type?: string
  // Add other fields as needed
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tagFilter, setTagFilter] = useState('')
  const [customFieldFilter, setCustomFieldFilter] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [auditProject, setAuditProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch projects client-side
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects')
        if (!response.ok) {
          throw new Error('Failed to fetch projects')
        }
        const data = await response.json()
        // The API returns { projects: [...] }, so we need to extract the projects array
        setProjects(data.projects || [])
      } catch (err) {
        setError('Failed to load projects. Please refresh the page.')
        console.error('Error fetching projects:', err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchProjects()
  }, [])

  const filteredProjects = projects.filter(project => {
    const tagMatch = tagFilter ? (project.tags || []).includes(tagFilter) : true
    const customFieldMatch = customFieldFilter
      ? Object.values(project.custom_fields || {}).some(val =>
          String(val).toLowerCase().includes(customFieldFilter.toLowerCase())
        )
      : true
    return tagMatch && customFieldMatch
  })

  const handleArchiveRestore = async (project: Project) => {
    setLoadingId(project.id)
    setError(null)
    try {
      const endpoint = project.deleted_at
        ? `/api/projects/${project.id}/restore` // You may need to implement this endpoint
        : `/api/projects/${project.id}/archive`
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to update project')
      // Optimistically update UI
      setProjects(projects =>
        projects.map(p =>
          p.id === project.id
            ? { ...p, deleted_at: project.deleted_at ? null : new Date().toISOString() }
            : p
        )
      )
    } catch (e) {
      setError('Failed to update project. Please try again.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Filter by tag"
          value={tagFilter}
          onChange={e => setTagFilter(e.target.value)}
          className="input input-modern"
        />
        <input
          type="text"
          placeholder="Filter by custom field value"
          value={customFieldFilter}
          onChange={e => setCustomFieldFilter(e.target.value)}
          className="input input-modern"
        />
      </div>
      {error && <div className="text-red-500 mb-2 text-sm">{error}</div>}
      
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project, index) => (
          <div key={project.id} className={`card-gradient p-4 rounded-lg shadow relative ${project.deleted_at ? 'opacity-60' : ''}`}>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {project.name}
              {project.deleted_at && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">Archived</span>
              )}
            </h3>
            <p className="text-sm text-gray-600">Client: {project.client_name}</p>
            <p className="text-xs text-gray-400">Tags: {(project.tags || []).join(', ')}</p>
            <p className="text-xs text-gray-400">Custom Fields: {JSON.stringify(project.custom_fields)}</p>
            <button
              className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shadow transition-colors
                ${project.deleted_at
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'}
                ${loadingId === project.id ? 'opacity-50 cursor-wait' : ''}`}
              onClick={() => handleArchiveRestore(project)}
              disabled={loadingId === project.id}
              title={project.deleted_at ? 'Restore Project' : 'Archive Project'}
            >
              {loadingId === project.id ? (
                <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              ) : project.deleted_at ? (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h6" /></svg>
                  Restore
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Archive
                </>
              )}
            </button>
            <button
              className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shadow bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700"
              onClick={() => setAuditProject(project)}
              title="View Audit Trail"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h6" /></svg>
              Audit Trail
            </button>
          </div>
        ))}
        </div>
      )}
      {auditProject && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl p-4 shadow-lg relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              onClick={() => setAuditProject(null)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <AuditLogViewer
              organizationId={auditProject.organization_id}
              resourceType="projects"
              resourceId={auditProject.id}
            />
          </div>
        </div>
      )}
    </div>
  )
}