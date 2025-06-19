import React, { useState, useEffect } from 'react'

export default function AuditReportsList({ projectId }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedReport, setSelectedReport] = useState(null)

  useEffect(() => {
    async function fetchReports() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/audit-reports?project_id=${projectId}`)
        const data = await res.json()
        setReports(data.reports || [])
      } catch (e) {
        setError('Failed to load audit reports')
      } finally {
        setLoading(false)
      }
    }
    if (projectId) fetchReports()
  }, [projectId])

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-bold mb-4">Audit Reports</h2>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : reports.length === 0 ? (
        <div className="text-gray-400 text-sm">No audit reports found.</div>
      ) : (
        <table className="min-w-full table-auto text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left">Name</th>
              <th className="px-2 py-1 text-left">Status</th>
              <th className="px-2 py-1 text-left">Created</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {reports.map(report => (
              <tr key={report.id} className="border-t">
                <td className="px-2 py-1 font-medium">{report.report_name}</td>
                <td className="px-2 py-1">{report.status}</td>
                <td className="px-2 py-1">{new Date(report.created_at).toLocaleDateString()}</td>
                <td className="px-2 py-1">
                  <button
                    className="btn btn-primary btn-xs"
                    onClick={() => setSelectedReport(report)}
                  >View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {selectedReport && (
        <AuditReportDetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </div>
  )
}

function AuditReportDetailModal({ report, onClose }) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState(null)

  const handleDownloadPDF = async () => {
    setDownloading(true)
    setError(null)
    try {
      const res = await fetch(`/api/audit-reports/${report.id}/pdf`)
      if (!res.ok) throw new Error('Failed to download PDF')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit_report_${report.id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setError('Failed to download PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg p-6 shadow-lg relative">
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          onClick={onClose}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h3 className="text-lg font-semibold mb-2">{report.report_name}</h3>
        <div className="mb-2 text-xs text-gray-500">Status: {report.status}</div>
        <div className="mb-2 text-xs text-gray-500">Created: {new Date(report.created_at).toLocaleString()}</div>
        <div className="mb-4 text-xs text-gray-500">ID: {report.id}</div>
        <pre className="bg-gray-50 p-2 rounded text-xs text-gray-700 max-h-48 overflow-auto mb-4">{JSON.stringify(report.report_data, null, 2)}</pre>
        <button
          className="btn btn-primary text-xs px-3 py-1"
          onClick={handleDownloadPDF}
          disabled={downloading}
        >
          {downloading ? 'Downloading...' : 'Download PDF'}
        </button>
        {error && <div className="text-red-500 text-xs mt-2">{error}</div>}
      </div>
    </div>
  )
} 