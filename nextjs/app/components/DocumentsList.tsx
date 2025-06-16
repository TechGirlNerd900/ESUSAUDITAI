'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import DocumentAnalysisModal from '@/app/components/DocumentAnalysisModal'
import LoadingSpinner from '@/app/components/LoadingSpinner'

interface Document {
  id: string
  name: string
  status: string
  created_at: string
  analyzed_at?: string
  file_path: string
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
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div>
              <h3 className="font-medium">{doc.name}</h3>
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
            </div>
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
    </div>
  )
}