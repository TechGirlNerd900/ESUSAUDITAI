'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import AnalysisResultsView from '@/app/components/AnalysisResultsView'
import LoadingSpinner from '@/app/components/LoadingSpinner'

interface Document {
  id: string
  name: string
  status: string
  analysis_results?: any
  created_at: string
  analyzed_at?: string
}

interface Props {
  document: Document
  onClose: () => void
  projectId: string
}

export default function DocumentAnalysisModal({ document, onClose, projectId }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')
  const supabase = createClient()
  
  // Tabs for different analysis views
  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'findings', label: 'Findings' },
    { id: 'recommendations', label: 'Recommendations' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{document.name}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex space-x-4 mt-4 border-b">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2 px-1 ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <LoadingSpinner />
            </div>
          ) : (
            <AnalysisResultsView
              results={document.analysis_results}
              activeTab={activeTab}
              documentId={document.id}
              projectId={projectId}
            />
          )}
        </div>
      </div>
    </div>
  )
}