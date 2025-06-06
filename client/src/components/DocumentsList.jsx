import React, { useState } from 'react';
import { useMutation } from 'react-query';
import toast from 'react-hot-toast';
import { 
  DocumentTextIcon,
  EyeIcon,
  PlayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { documentsService } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import DocumentAnalysisModal from './DocumentAnalysisModal';

const DocumentsList = ({ documents, analysisResults, projectId }) => {
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  const analyzeDocumentMutation = useMutation(documentsService.analyzeDocument, {
    onSuccess: (data) => {
      toast.success('Document analysis started successfully!');
      // Optionally refetch project data here
    },
    onError: (error) => {
      toast.error(error.error || 'Failed to start document analysis');
    }
  });

  const getDocumentAnalysis = (documentId) => {
    return analysisResults.find(result => result.documentId === documentId);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'analyzed':
        return <CheckCircleIcon className="h-5 w-5 text-success-500" />;
      case 'processing':
        return <ClockIcon className="h-5 w-5 text-warning-500" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-danger-500" />;
      default:
        return <DocumentTextIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'analyzed':
        return 'Analyzed';
      case 'processing':
        return 'Processing';
      case 'error':
        return 'Error';
      default:
        return 'Uploaded';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleAnalyzeDocument = (documentId) => {
    analyzeDocumentMutation.mutate(documentId);
  };

  const handleViewAnalysis = (document) => {
    setSelectedDocument(document);
    setShowAnalysisModal(true);
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
        <p className="mt-1 text-sm text-gray-500">
          Upload documents to get started with AI analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {documents.map((document) => {
        const analysis = getDocumentAnalysis(document.id);
        
        return (
          <div key={document.id} className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(document.status)}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      {document.originalName}
                    </h3>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>{formatFileSize(document.fileSize)}</span>
                      <span>•</span>
                      <span>Uploaded {new Date(document.uploadedAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className={`badge ${
                        document.status === 'analyzed' ? 'badge-success' :
                        document.status === 'processing' ? 'badge-warning' :
                        document.status === 'error' ? 'badge-danger' :
                        'badge-gray'
                      }`}>
                        {getStatusText(document.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {document.status === 'uploaded' && (
                    <button
                      onClick={() => handleAnalyzeDocument(document.id)}
                      disabled={analyzeDocumentMutation.isLoading}
                      className="btn-primary btn-sm"
                    >
                      {analyzeDocumentMutation.isLoading ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <>
                          <PlayIcon className="h-4 w-4 mr-1" />
                          Analyze
                        </>
                      )}
                    </button>
                  )}

                  {document.status === 'analyzed' && analysis && (
                    <button
                      onClick={() => handleViewAnalysis(document)}
                      className="btn-outline btn-sm"
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View Analysis
                    </button>
                  )}
                </div>
              </div>

              {/* Analysis Summary */}
              {analysis && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Analysis Summary</h4>
                  <p className="text-sm text-gray-700 mb-3">{analysis.summary}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.redFlags && analysis.redFlags.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-danger-700 mb-1">
                          Red Flags ({analysis.redFlags.length})
                        </h5>
                        <ul className="text-xs text-danger-600 space-y-1">
                          {analysis.redFlags.slice(0, 2).map((flag, index) => (
                            <li key={index}>• {flag}</li>
                          ))}
                          {analysis.redFlags.length > 2 && (
                            <li className="text-gray-500">
                              +{analysis.redFlags.length - 2} more...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {analysis.highlights && analysis.highlights.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-success-700 mb-1">
                          Highlights ({analysis.highlights.length})
                        </h5>
                        <ul className="text-xs text-success-600 space-y-1">
                          {analysis.highlights.slice(0, 2).map((highlight, index) => (
                            <li key={index}>• {highlight}</li>
                          ))}
                          {analysis.highlights.length > 2 && (
                            <li className="text-gray-500">
                              +{analysis.highlights.length - 2} more...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Confidence: {(analysis.confidenceScore * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs text-gray-500">
                      Analyzed {new Date(analysis.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Document Analysis Modal */}
      <DocumentAnalysisModal
        open={showAnalysisModal}
        setOpen={setShowAnalysisModal}
        document={selectedDocument}
        analysis={selectedDocument ? getDocumentAnalysis(selectedDocument.id) : null}
      />
    </div>
  );
};

export default DocumentsList;
