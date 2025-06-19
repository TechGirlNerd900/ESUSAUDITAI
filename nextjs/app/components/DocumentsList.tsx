'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import DocumentAnalysisModal from '@/app/components/DocumentAnalysisModal'
import LoadingSpinner from '@/app/components/LoadingSpinner'
import AuditLogViewer from './AuditLogViewer'

interface Document {
  id: string
  name: string
  status: string
  created_at: string
  analyzed_at?: string
  file_path: string
  deleted_at?: string
}

export default function DocumentsList({ 
  documents,
  projectId 
}: { 
  documents: Document[]
  projectId: string
}) {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [auditDoc, setAuditDoc] = useState<any | null>(null)
  const supabase = createClient()

  const handleAnalyze = async (doc: Document) => {
    setLoading(doc.id)
    try {
      const response = await fetch(`/api/analysis/document/${doc.id}`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('Analysis failed')
      }

      const result = await response.json()
      setSelectedDoc(result.document)
    } catch (error) {
      console.error('Error analyzing document:', error)
      alert('Failed to analyze document. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const handleArchiveRestore = async (doc: Document) => {
    setLoadingId(doc.id)
    setError(null)
    try {
      const endpoint = doc.deleted_at
        ? `/api/documents/${doc.id}/restore`
        : `/api/documents/${doc.id}/archive`
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to update document')
      // Optimistically update UI
      // If deleted_at is not present, add it; if present, remove it
      // (In real app, refetch or update state from backend)
      // Here, just reload for demo
      window.location.reload()
    } catch (e) {
      setError('Failed to update document. Please try again.')
    } finally {
      setLoadingId(null)
    }
  }

  const closeModal = () => {
    setSelectedDoc(null)
  }

  if (!documents.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        No documents uploaded yet
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className={`flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors relative ${doc.deleted_at ? 'opacity-60' : ''}`}
          >
            <div>
              <h3 className="font-medium flex items-center gap-2">
                {doc.name}
                {doc.deleted_at && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">Archived</span>
                )}
              </h3>
              <p className="text-sm text-gray-500">
                Uploaded {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`text-sm ${
                doc.status === 'analyzed' ? 'text-green-600' : 'text-gray-500'
              }`}>
                {doc.status === 'analyzed' ? 'Analyzed' : 'Pending'}
              </span>
              <button
                onClick={() => doc.status === 'analyzed' ? setSelectedDoc(doc) : handleAnalyze(doc)}
                className="btn-secondary text-sm"
                disabled={loading === doc.id}
              >
                {loading === doc.id ? (
                  <LoadingSpinner size="sm" />
                ) : doc.status === 'analyzed' ? (
                  'View Analysis'
                ) : (
                  'Analyze'
                )}
              </button>
              <button
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shadow transition-colors
                  ${doc.deleted_at
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'}
                  ${loadingId === doc.id ? 'opacity-50 cursor-wait' : ''}`}
                onClick={() => handleArchiveRestore(doc)}
                disabled={loadingId === doc.id}
                title={doc.deleted_at ? 'Restore Document' : 'Archive Document'}
              >
                {loadingId === doc.id ? (
                  <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                ) : doc.deleted_at ? (
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
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shadow bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700"
                onClick={() => setAuditDoc(doc)}
                title="View Audit Trail"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h6" /></svg>
                Audit Trail
              </button>
            </div>
            {error && <div className="absolute left-0 bottom-0 text-xs text-red-500 mt-1">{error}</div>}
          </div>
        ))}
      </div>

      {selectedDoc && (
        <DocumentAnalysisModal
          document={selectedDoc}
          onClose={closeModal}
          projectId={projectId}
        />
      )}

      {auditDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl p-4 shadow-lg relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              onClick={() => setAuditDoc(null)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <AuditLogViewer
              organizationId={auditDoc.organization_id}
              resourceType="documents"
              resourceId={auditDoc.id}
            />
          </div>
        </div>
      )}
    </div>
  )
}