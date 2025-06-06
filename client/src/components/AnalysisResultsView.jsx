import React, { useState } from 'react';
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  EyeIcon,
  ClipboardDocumentIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import {
  ExclamationTriangleIcon as ExclamationTriangleSolid,
  CheckCircleIcon as CheckCircleSolid
} from '@heroicons/react/24/solid';
import ErrorBoundary from './ErrorBoundary';
import LoadingSpinner from './LoadingSpinner';

const AnalysisResultsView = ({ document, analysis, isLoading, error }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [showRawData, setShowRawData] = useState(false);

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-danger-50 border border-danger-200 rounded-lg">
        <div className="flex items-center">
          <ExclamationTriangleSolid className="h-5 w-5 text-danger-500 mr-2" />
          <h3 className="text-sm font-medium text-danger-800">Analysis Error</h3>
        </div>
        <p className="mt-2 text-sm text-danger-700">
          {error.message || 'Failed to load analysis results. Please try again.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-sm text-danger-600 hover:text-danger-500 underline"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-gray-600">Analyzing document...</p>
        <p className="mt-1 text-xs text-gray-500">This may take a few moments</p>
      </div>
    );
  }

  // No analysis data
  if (!analysis) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <DocumentTextIcon className="mx-auto h-8 w-8 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Analysis Available</h3>
        <p className="mt-1 text-sm text-gray-500">
          This document hasn't been analyzed yet.
        </p>
      </div>
    );
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here
      console.log('Copied to clipboard');
    });
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.8) return 'text-success-600 bg-success-100';
    if (score >= 0.6) return 'text-warning-600 bg-warning-100';
    return 'text-danger-600 bg-danger-100';
  };

  const getConfidenceBarColor = (score) => {
    if (score >= 0.8) return 'bg-success-500';
    if (score >= 0.6) return 'bg-warning-500';
    return 'bg-danger-500';
  };

  const tabs = [
    { id: 'summary', name: 'Summary', icon: ChartBarIcon },
    { id: 'redflags', name: `Red Flags (${analysis.redFlags?.length || 0})`, icon: ExclamationTriangleIcon },
    { id: 'highlights', name: `Highlights (${analysis.highlights?.length || 0})`, icon: CheckCircleIcon },
    { id: 'data', name: 'Extracted Data', icon: DocumentTextIcon }
  ];

  return (
    <ErrorBoundary>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Analysis Results
              </h3>
              {document && (
                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                  <span>{document.originalName}</span>
                  <span>•</span>
                  <span>{formatFileSize(document.fileSize)}</span>
                  <span>•</span>
                  <span>Analyzed {new Date(analysis.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {/* Confidence Score */}
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">Confidence</div>
                <div className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(analysis.confidenceScore)}`}>
                  {(analysis.confidenceScore * 100).toFixed(0)}%
                </div>
              </div>
              <div className="w-16 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getConfidenceBarColor(analysis.confidenceScore)}`}
                  style={{ width: `${analysis.confidenceScore * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 flex items-center mb-2">
                  <InformationCircleIcon className="h-4 w-4 mr-2" />
                  AI Summary
                </h4>
                <p className="text-sm text-blue-800 leading-relaxed">
                  {analysis.aiSummary || analysis.summary || 'No summary available.'}
                </p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {analysis.extractedData?.pages || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Pages Analyzed</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {analysis.redFlags?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Red Flags</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {analysis.highlights?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Highlights</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'redflags' && (
            <div className="space-y-3">
              {analysis.redFlags && analysis.redFlags.length > 0 ? (
                analysis.redFlags.map((flag, index) => (
                  <div key={index} className="flex items-start p-4 bg-red-50 border border-red-200 rounded-lg">
                    <ExclamationTriangleSolid className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-red-800">{flag}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(flag)}
                      className="ml-2 p-1 text-red-400 hover:text-red-600"
                      title="Copy to clipboard"
                    >
                      <ClipboardDocumentIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <CheckCircleSolid className="mx-auto h-12 w-12 text-green-500" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Red Flags Found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    This document appears to be compliant with no major issues detected.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'highlights' && (
            <div className="space-y-3">
              {analysis.highlights && analysis.highlights.length > 0 ? (
                analysis.highlights.map((highlight, index) => (
                  <div key={index} className="flex items-start p-4 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircleSolid className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-green-800">{highlight}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(highlight)}
                      className="ml-2 p-1 text-green-400 hover:text-green-600"
                      title="Copy to clipboard"
                    >
                      <ClipboardDocumentIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Highlights Available</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No specific highlights were identified in this document.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">Extracted Data</h4>
                <button
                  onClick={() => setShowRawData(!showRawData)}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                >
                  <EyeIcon className="h-3 w-3 mr-1" />
                  {showRawData ? 'Hide' : 'Show'} Raw Data
                </button>
              </div>

              {analysis.extractedData ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  {showRawData ? (
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {JSON.stringify(analysis.extractedData, null, 2)}
                    </pre>
                  ) : (
                    <div className="space-y-3">
                      {/* Key-Value Pairs */}
                      {analysis.extractedData.keyValuePairs && Object.keys(analysis.extractedData.keyValuePairs).length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-gray-700 mb-2">Key Information</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {Object.entries(analysis.extractedData.keyValuePairs).map(([key, value]) => (
                              <div key={key} className="bg-white p-2 rounded border">
                                <div className="text-xs font-medium text-gray-600">{key}</div>
                                <div className="text-sm text-gray-900">{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tables */}
                      {analysis.extractedData.tables && analysis.extractedData.tables.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-gray-700 mb-2">
                            Tables ({analysis.extractedData.tables.length})
                          </h5>
                          <div className="text-sm text-gray-600">
                            {analysis.extractedData.tables.map((table, index) => (
                              <div key={index} className="mb-2">
                                Table {index + 1}: {table.rowCount} rows × {table.columnCount} columns
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Data Extracted</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No structured data could be extracted from this document.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AnalysisResultsView;
