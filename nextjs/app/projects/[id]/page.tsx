'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AuditReportsList from '../../components/AuditReportsList'

export default function ProjectDetailsPage({ params }) {
  const router = useRouter()
  const [archiving, setArchiving] = useState(false)

  async function handleArchive() {
    if (!confirm('Are you sure you want to archive this project?')) return
    setArchiving(true)
    const res = await fetch(`/api/projects/${params.id}/archive`, { method: 'POST' })
    if (res.ok) {
      router.push('/projects')
    } else {
      alert('Failed to archive project')
    }
    setArchiving(false)
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
        <AuditReportsList projectId={params.id} />
      </div>
    </div>
  )
}