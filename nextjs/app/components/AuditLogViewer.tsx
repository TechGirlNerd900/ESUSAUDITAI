'use client'

import { useState, useEffect } from 'react'

export default function AuditLogViewer({ organizationId, resourceType, resourceId }: { organizationId: string, resourceType?: string, resourceId?: string }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ event_type: '', severity: '', tag: '' })

  useEffect(() => {
    fetchLogs()
    // eslint-disable-next-line
  }, [organizationId, filters])

  async function fetchLogs() {
    setLoading(true)
    const params = new URLSearchParams({
      organization_id: organizationId,
      ...(filters.event_type && { event_type: filters.event_type }),
      ...(filters.severity && { severity: filters.severity }),
      ...(filters.tag && { tag: filters.tag }),
      ...(resourceType && { resource_type: resourceType }),
      ...(resourceId && { resource_id: resourceId }),
      limit: '100'
    })
    const res = await fetch(`/api/audit-logs?${params.toString()}`)
    const data = await res.json()
    setLogs(data.logs || [])
    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setFilters({ ...filters, [e.target.name]: e.target.value })
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Audit Log Viewer</h2>
      {!(resourceType && resourceId) && (
        <form className="flex flex-wrap gap-4 mb-4">
          <input
            type="text"
            name="event_type"
            value={filters.event_type}
            onChange={handleChange}
            placeholder="Event Type"
            className="input input-modern"
          />
          <select name="severity" value={filters.severity} onChange={handleChange} className="input input-modern">
            <option value="">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <input
            type="text"
            name="tag"
            value={filters.tag}
            onChange={handleChange}
            placeholder="Tag"
            className="input input-modern"
          />
          <button type="button" onClick={fetchLogs} className="btn btn-primary">Search</button>
        </form>
      )}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-modern">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Event Type</th>
                <th>Severity</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i}>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                  <td>{log.user_id || '-'}</td>
                  <td>{log.action}</td>
                  <td>{log.resource_type}</td>
                  <td>{log.event_type}</td>
                  <td>{log.severity}</td>
                  <td>{(log.tags || []).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
} 