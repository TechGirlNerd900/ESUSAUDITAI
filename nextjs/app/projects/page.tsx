import React, { useState, useEffect } from 'react'

export default function ProjectsPage({ projects: initialProjects }) {
  const [projects, setProjects] = useState(initialProjects || [])
  const [tagFilter, setTagFilter] = useState('')
  const [customFieldFilter, setCustomFieldFilter] = useState('')

  // If projects are fetched client-side, add useEffect here
  // useEffect(() => { ...fetch projects... }, [])

  const filteredProjects = projects.filter(project => {
    const tagMatch = tagFilter ? (project.tags || []).includes(tagFilter) : true
    const customFieldMatch = customFieldFilter
      ? Object.values(project.custom_fields || {}).some(val =>
          String(val).toLowerCase().includes(customFieldFilter.toLowerCase())
        )
      : true
    return tagMatch && customFieldMatch
  })

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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((project, index) => (
          <div key={project.id} className="card-gradient p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold">{project.name}</h3>
            <p className="text-sm text-gray-600">Client: {project.client_name}</p>
            <p className="text-xs text-gray-400">Tags: {(project.tags || []).join(', ')}</p>
            <p className="text-xs text-gray-400">Custom Fields: {JSON.stringify(project.custom_fields)}</p>
          </div>
        ))}
      </div>
    </div>
  )
} 