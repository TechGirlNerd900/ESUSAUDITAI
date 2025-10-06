'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '../components/ui/badge'
import { 
  Upload, 
  FileText, 
  Download, 
  Eye, 
  Search,
  MoreHorizontal,
  Trash2,
  AlertTriangle, // Added for error display
  RefreshCw // Added for retry button
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import UploadDocumentModal from '../components/UploadDocumentModal'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert' // Corrected import path for error display
import { 
  handleApiError, 
  handleApiSuccess, 
  showToast, // Renamed from showErrorToast
  shouldRetryError, 
  ErrorCategory,
  ApiErrorResult 
} from '@/lib/utils/errorHandler' // Added error handling utility

interface Document {
  id: string
  name: string
  file_type: string
  file_size: number
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  uploaded_at: string
  projects: { id: string; name: string }
  uploaded_by: { first_name: string; last_name: string }
  analysis_results?: any
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })
  const [error, setError] = useState<ApiErrorResult | null>(null) // Added error state
  const [retryCount, setRetryCount] = useState(0) // Added retry count state
  
  const authenticatedFetch = useAuthenticatedFetch()

  const defaultPagination = { page: 1, limit: 20, total: 0, pages: 0 }; // Define default pagination

  const fetchDocuments = async (page = 1) => {
    setLoading(true)
    setError(null) // Clear previous errors
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      })
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      
      const response = await authenticatedFetch(`/api/documents?${params}`)
      
      if (!response.ok) {
        const errorResult = await handleApiError(response, { 
          endpoint: 'documents', 
          showToast: true, 
          isListEndpoint: true,
          resourceType: 'documents'
        })
        if (errorResult.isEmptyState) {
          setDocuments([])
          setPagination(defaultPagination)
          setError(null) // No error for empty state
        } else {
          setError(errorResult)
          setDocuments([])
          setPagination(defaultPagination)
        }
      } else {
        const successResult = await handleApiSuccess<any>(response)
        setDocuments(successResult.data?.documents || [])
        setPagination(successResult.data?.pagination || defaultPagination)
        setError(null) // Clear error on success
      }
    } catch (e) {
      // Network errors or other unexpected fetch issues
      const errorResult = await handleApiError(null, { 
        endpoint: 'documents', 
        showToast: true,
        customMessage: 'Failed to connect to the server. Please check your internet connection.'
      })
      setError(errorResult)
      setDocuments([])
      setPagination(defaultPagination)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments(pagination.page)
  }, [statusFilter, retryCount, pagination.limit, pagination.page]) // Added retryCount to dependencies

  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
  }

  const handleDocumentUploaded = () => {
    fetchDocuments()
    setShowUploadModal(false)
  }

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading && documents.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Skeleton className="h-8 w-8" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Documents</h1>
        <Button onClick={() => setShowUploadModal(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error Display */}
      {error && !error.isEmptyState && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex justify-between items-center">
            {error.message}
            {error.shouldRetry && shouldRetryError(error.category, retryCount) && (
              <Button variant="ghost" onClick={handleRetry} className="ml-4">
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Documents List */}
      {filteredDocuments.length === 0 && !loading && !error?.isEmptyState ? ( // Show empty state only if no documents, not loading, and not an empty state error
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchTerm || statusFilter !== 'all' ? 'No documents match your filters' : 'No documents uploaded yet'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Upload your first document to get started with AI-powered analysis'
              }
            </p>
            {documents.length === 0 && ( // Only show upload button if truly no documents
              <Button onClick={() => setShowUploadModal(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredDocuments.map((document) => (
            <Card key={document.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-lg">{document.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>{document.projects?.name || 'No Project'}</span>
                        <span>•</span>
                        <span>{formatFileSize(document.file_size)}</span>
                        <span>•</span>
                        <span>
                          Uploaded by {document.uploaded_by?.first_name} {document.uploaded_by?.last_name}
                        </span>
                        <span>•</span>
                        <span>{new Date(document.uploaded_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge className={getStatusColor(document.processing_status)}>
                      {document.processing_status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => showToast('View Details functionality coming soon!', 'default')}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => showToast('Download functionality coming soon!', 'default')}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </DropdownMenuItem>
                        {document.processing_status === 'completed' && (
                          <DropdownMenuItem onClick={() => showToast('View Analysis functionality coming soon!', 'default')}>
                            <FileText className="mr-2 h-4 w-4" />
                            View Analysis
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="text-red-600" 
                          onClick={() => showToast('Delete functionality coming soon!', 'destructive')}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            onClick={() => fetchDocuments(pagination.page - 1)}
            disabled={pagination.page === 1 || loading}
          >
            Previous
          </Button>
          <span className="px-4 py-2 text-sm text-gray-600">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            onClick={() => fetchDocuments(pagination.page + 1)}
            disabled={pagination.page === pagination.pages || loading}
          >
            Next
          </Button>
        </div>
      )}

      {/* Upload Modal */}
      <UploadDocumentModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={handleDocumentUploaded}
      />
    </div>
  )
}
