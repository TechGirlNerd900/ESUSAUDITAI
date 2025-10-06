'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, X, AlertTriangle, RefreshCw } from 'lucide-react'; // Added AlertTriangle, RefreshCw
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'; // Corrected Alert components import path
import { Button } from '@/components/ui/button'; // Ensure Button is imported

import { 
  handleApiError, 
  handleApiSuccess, 
  showToast, // Renamed from showErrorToast
  shouldRetryError, 
  ErrorCategory,
  ApiErrorResult 
} from '@/lib/utils/errorHandler'; // Added error handling utility

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onUploadComplete?: () => void;
  projectId?: string;
}

interface UploadFile extends File {
  id: string; // Unique ID for tracking
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  errorMessage?: string;
}

export default function UploadDocumentModal({ isOpen, onClose, onSuccess, onUploadComplete, projectId }: Props) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<ApiErrorResult | null>(null); // Changed error type
  const [retryCount, setRetryCount] = useState(0); // Added retry count state
  const [uploadingFileId, setUploadingFileId] = useState<string | null>(null); // Track current file being uploaded

  const authenticatedFetch = useAuthenticatedFetch();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => {
      if (file.size > MAX_FILE_SIZE) {
        showToast(`File ${file.name} exceeds the maximum size of 50MB.`, 'destructive');
        return null;
      }
      if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
        showToast(`File ${file.name} has an unsupported file type.`, 'destructive');
        return null;
      }
      return {
        ...file,
        id: `${file.name}-${file.size}-${Date.now()}`, // Unique ID
        progress: 0,
        status: 'pending',
      };
    }).filter(Boolean) as UploadFile[]; // Filter out nulls from invalid files
    setFiles(prevFiles => [...prevFiles, ...newFiles]);
    setError(null); // Clear previous errors on new file drop
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: SUPPORTED_FILE_TYPES.join(',') as any // Specify accepted file types
  });

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null); // Clear previous error
    // Reset status of failed files to pending for retry
    setFiles(prevFiles => prevFiles.map(file => 
      file.status === 'failed' ? { ...file, status: 'pending', errorMessage: '', progress: 0 } : file // Changed undefined to ''
    ));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError({
        message: 'No files selected for upload.',
        category: ErrorCategory.VALIDATION_ERROR,
        statusCode: 400,
        shouldRetry: false,
        error: new Error('No files selected'),
        isEmptyState: false,
        retryAfter: null
      });
      return;
    }

    setUploading(true);
    setError(null); // Clear any previous errors
    let allUploadsSuccessful = true;

    for (const file of files) {
      if (file.status === 'completed' || file.status === 'uploading') continue; // Skip already completed or ongoing uploads

      setUploadingFileId(file.id);
      setFiles(prevFiles => prevFiles.map(f => 
        f.id === file.id ? { ...f, status: 'uploading', progress: 0 } : f
      ));

      try {
        const formData = new FormData();
        formData.append('file', file);
        if (projectId) {
          formData.append('projectId', projectId);
        }

        // Simulate progress for now, actual progress would require a different API setup
        // For now, we'll update progress to 100% on success
        setFiles(prevFiles => prevFiles.map(f => 
          f.id === file.id ? { ...f, progress: 50 } : f
        ));

        const response = await authenticatedFetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorResult = await handleApiError(response, { 
            endpoint: `upload ${file.name}`, 
            showToast: false, // Show inline
            resourceType: 'document' 
          });
          setError(errorResult);
          setFiles(prevFiles => prevFiles.map(f => 
            f.id === file.id ? { ...f, status: 'failed', errorMessage: errorResult.message } : f
          ));
          allUploadsSuccessful = false;
          break; // Stop on first error as per Comment 4
        } else {
          await handleApiSuccess(response);
          setFiles(prevFiles => prevFiles.map(f => 
            f.id === file.id ? { ...f, status: 'completed', progress: 100 } : f
          ));
        }
      } catch (e) {
        const errorResult = await handleApiError(null, { 
          endpoint: `upload ${file.name}`, 
          showToast: true,
          customMessage: `Failed to connect to the server for ${file.name}. Please check your internet connection.`
        });
        setError(errorResult);
        setFiles(prevFiles => prevFiles.map(f => 
          f.id === file.id ? { ...f, status: 'failed', errorMessage: errorResult.message } : f
        ));
        allUploadsSuccessful = false;
      } finally {
        setUploadingFileId(null);
      }
    }

    if (allUploadsSuccessful) {
      onSuccess?.();
      onUploadComplete?.();
      showToast('All documents uploaded successfully!', 'default');
      setFiles([]); // Clear files on successful upload
      onClose();
    } else {
      showToast('Some documents failed to upload. Please check the errors.', 'destructive');
    }
    setUploading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">Upload Documents</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className={`mx-auto h-12 w-12 transition-colors ${
              isDragActive ? 'text-blue-500' : 'text-gray-400'
            }`} />
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive ? 'Drop the files here ...' : "Drag 'n' drop documents here, or click to select"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Supported: PDF, Word, Excel, CSV (max 50MB)
            </p>
          </div>
          {files.length > 0 && (
            <div className="mt-4 max-h-32 overflow-y-auto">
              {files.map((file, i) => (
                <div key={file.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg mb-2">
                  <div className="flex items-center flex-1 min-w-0">
                    <FileIcon className="h-5 w-5 text-gray-500 mr-2 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-900 truncate block">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB - Status: {file.status}
                        {file.errorMessage && <span className="text-red-500 ml-2">{file.errorMessage}</span>}
                      </span>
                      {file.status === 'uploading' && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full" 
                            style={{ width: `${file.progress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => setFiles(files.filter(f => f.id !== file.id))}
                    className="ml-2 p-1 hover:bg-gray-200 rounded"
                    disabled={uploading}
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {error && (
            <Alert variant="destructive" className="mt-4">
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
        </div>
        <div className="p-6 border-t flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {files.length === 0 ? 'No files selected' : `${files.length} file(s) selected`}
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={onClose} 
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </div>
              ) : (
                `Upload ${files.length > 0 ? `(${files.length})` : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
