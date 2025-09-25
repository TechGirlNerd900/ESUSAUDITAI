'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onUploadComplete?: () => void;
  projectId?: string;
}

export default function UploadDocumentModal({ isOpen, onClose, onSuccess, onUploadComplete, projectId }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prevFiles => [...prevFiles, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        if (projectId) {
          formData.append('projectId', projectId);
        }

        const response = await authenticatedFetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }
      }

      // Call success callbacks
      onSuccess?.();
      onUploadComplete?.();
      
      // Reset state and close
      setFiles([]);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload. Please try again.');
    } finally {
      setUploading(false);
    }
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
            <input {...getInputProps()} accept=".pdf,.docx,.doc,.xlsx,.xls,.csv" />
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
                <div key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg mb-2">
                  <div className="flex items-center flex-1 min-w-0">
                    <FileIcon className="h-5 w-5 text-gray-500 mr-2 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-900 truncate block">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFiles(files.filter((_, index) => index !== i))}
                    className="ml-2 p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
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
