'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import AuditReportsList from '../../components/AuditReportsList'

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [archiving, setArchiving] = useState(false)
  const [projectId, setProjectId] = useState<string>('')

  useEffect(() => {
    params.then(({ id }) => setProjectId(id))
  }, [params])

  async function handleArchive() {
    if (!confirm('Are you sure you want to archive this project?')) return
    setArchiving(true)
    const res = await fetch(`/api/projects/${projectId}/archive`, { method: 'POST' })
    if (res.ok) {
      router.push('/projects')
    } else {
      alert('Failed to archive project')
    }
    setArchiving(false)
  }

  if (!projectId) {
    return <div>Loading...</div>
  }

  return (
    <div>
      {/* ... existing project details ... */}
      <button
        onClick={handleArchive}
        disabled={archiving}
        className="btn btn-danger mt-4"
      >
        {archiving ? 'Archiving...' : 'Archive Project'}
      </button>
      <div className="mt-8">
        <AuditReportsList projectId={projectId} />
      </div>
    </div>
  )
}