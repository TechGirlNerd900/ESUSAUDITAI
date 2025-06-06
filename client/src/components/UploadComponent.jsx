import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import {
  CloudArrowUpIcon,
  DocumentIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { documentsService } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

const UploadComponent = ({ projectId }) => {
  const [uploadProgress, setUploadProgress] = useState({});
  const queryClient = useQueryClient();

  const uploadMutation = useMutation(
    ({ file, projectId }) => documentsService.uploadDocument(
      projectId,
      file,
      (progress) => {
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: progress
        }));
      }
    ),
    {
      onSuccess: (data, variables) => {
        toast.success(`${variables.file.name} uploaded successfully!`);
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[variables.file.name];
          return newProgress;
        });
        // Refetch project data to show new document
        queryClient.invalidateQueries(['project', projectId]);
      },
      onError: (error, variables) => {
        toast.error(`Failed to upload ${variables.file.name}: ${error.error || error.message}`);
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[variables.file.name];
          return newProgress;
        });
      }
    }
  );

  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach(file => {
      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Maximum file size is 50MB.`);
        return;
      }

      // Check file type
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/csv'
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name} is not a supported file type. Please upload PDF, Excel, Word, or CSV files.`);
        return;
      }

      uploadMutation.mutate({ file, projectId });
    });
  }, [projectId, uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/csv': ['.csv']
    },
    multiple: true
  });

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`file-upload-area cursor-pointer ${
          isDragActive ? 'dragover' : ''
        }`}
      >
        <input {...getInputProps()} />
        <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            {isDragActive ? (
              'Drop the files here...'
            ) : (
              <>
                <span className="font-medium text-primary-600">Click to upload</span> or drag and drop
              </>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            PDF, Excel, Word, CSV files up to 50MB
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Uploading files...</h4>
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <DocumentIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-900 truncate">{fileName}</span>
                </div>
                <span className="text-xs text-gray-500">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UploadComponent;