'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import LoadingSpinner from './LoadingSpinner'

interface Props {
  projectId: string
}

export default function UploadComponent({ projectId }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    await handleFiles(files)
  }, [])

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    await handleFiles(files)
  }

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return

    setIsUploading(true)
    try {
      // Upload each file to Supabase storage
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('projectId', projectId)

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }
      }

      // Refresh the page to show new documents
      router.refresh()
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload documents. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      {isUploading ? (
        <div className="flex flex-col items-center space-y-4">
          <LoadingSpinner />
          <p className="text-gray-600">Uploading documents...</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center space-y-4">
            <svg
              className="h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m0 0v4a4 4 0 004 4h24a4 4 0 004-4v-4m-28 0l7.515-7.515a4 4 0 015.656 0L28 32m-16 0h24"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <p className="text-gray-600">
                Drag and drop your documents here, or{' '}
                <label className="text-blue-500 hover:text-blue-600 cursor-pointer">
                  browse
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleFileInput}
                    accept=".pdf,.doc,.docx,.txt"
                  />
                </label>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Supports PDF, Word, and text files
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}