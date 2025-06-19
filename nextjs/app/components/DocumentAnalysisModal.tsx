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
  custom_fields?: any
  tags?: string[]
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
  const [editMode, setEditMode] = useState(false)
  const [customFields, setCustomFields] = useState<any>(document.custom_fields || {})
  const [tags, setTags] = useState<string[]>(document.tags || [])
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  
  // Tabs for different analysis views
  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'findings', label: 'Findings' },
    { id: 'recommendations', label: 'Recommendations' },
    { id: 'meta', label: 'Custom Fields & Tags' }
  ]

  async function handleSave() {
    setSaveLoading(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/documents/${document.id}/meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_fields: customFields, tags })
      })
      if (!res.ok) throw new Error('Failed to update meta')
      setEditMode(false)
    } catch (e) {
      setSaveError('Failed to update. Please try again.')
    } finally {
      setSaveLoading(false)
    }
  }

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
            activeTab === 'meta' ? (
              <div>
                {!editMode ? (
                  <>
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Custom Fields</h4>
                      <pre className="bg-gray-50 p-2 rounded text-xs text-gray-700">{JSON.stringify(customFields, null, 2)}</pre>
                    </div>
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {tags.length ? tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{tag}</span>
                        )) : <span className="text-gray-400 text-xs">No tags</span>}
                      </div>
                    </div>
                    <button
                      className="btn btn-primary text-xs px-3 py-1"
                      onClick={() => setEditMode(true)}
                    >Edit</button>
                  </>
                ) : (
                  <form onSubmit={e => { e.preventDefault(); handleSave() }} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">Custom Fields (JSON)</label>
                      <textarea
                        className="w-full p-2 border rounded text-xs"
                        rows={4}
                        value={JSON.stringify(customFields, null, 2)}
                        onChange={e => {
                          try {
                            setCustomFields(JSON.parse(e.target.value))
                            setSaveError(null)
                          } catch {
                            setSaveError('Invalid JSON')
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Tags (comma separated)</label>
                      <input
                        className="w-full p-2 border rounded text-xs"
                        value={tags.join(', ')}
                        onChange={e => setTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                      />
                    </div>
                    {saveError && <div className="text-red-500 text-xs">{saveError}</div>}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="btn btn-primary text-xs px-3 py-1"
                        disabled={saveLoading || !!saveError}
                      >{saveLoading ? 'Saving...' : 'Save'}</button>
                      <button
                        type="button"
                        className="btn btn-secondary text-xs px-3 py-1"
                        onClick={() => { setEditMode(false); setSaveError(null); }}
                      >Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <AnalysisResultsView
                results={document.analysis_results}
                activeTab={activeTab}
                documentId={document.id}
                projectId={projectId}
              />
            )
          )}
        </div>
      </div>
    </div>
  )
}