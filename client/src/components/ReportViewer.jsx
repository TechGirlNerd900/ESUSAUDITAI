import React, { useState } from 'react';
import {
  DocumentArrowDownIcon,
  EyeIcon,
  ShareIcon,
  PrinterIcon,
  CalendarIcon,
  UserIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import ErrorBoundary from './ErrorBoundary';
import LoadingSpinner from './LoadingSpinner';

const ReportViewer = ({ report, isLoading, error, onDownload, onShare }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
          <h3 className="text-sm font-medium text-red-800">Report Error</h3>
        </div>
        <p className="mt-2 text-sm text-red-700">
          {error.message || 'Failed to load report. Please try again.'}
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-gray-600">Loading report...</p>
      </div>
    );
  }

  // No report data
  if (!report) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <DocumentTextIcon className="mx-auto h-8 w-8 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Report Available</h3>
        <p className="mt-1 text-sm text-gray-500">
          This report hasn't been generated yet.
        </p>
      </div>
    );
  }

  const handleDownload = async () => {
    if (!onDownload) return;

    setIsDownloading(true);
    try {
      await onDownload(report);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'final':
        return 'bg-success-100 text-success-800';
      case 'draft':
        return 'bg-warning-100 text-warning-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-primary-100 text-primary-800';
    }
  };

  // Parse report data if it's a JSON string
  const reportData = typeof report.reportData === 'string'
    ? JSON.parse(report.reportData)
    : report.reportData;

  return (
    <ErrorBoundary>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-semibold text-gray-900">
                  {report.reportName}
                </h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                  {report.status?.charAt(0).toUpperCase() + report.status?.slice(1)}
                </span>
              </div>

              <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  Generated {formatDate(report.createdAt)}
                </div>
                {report.generatedBy && (
                  <div className="flex items-center">
                    <UserIcon className="h-4 w-4 mr-1" />
                    {report.generatedBy.firstName} {report.generatedBy.lastName}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePrint}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <PrinterIcon className="h-4 w-4 mr-2" />
                Print
              </button>

              {onShare && (
                <button
                  onClick={() => onShare(report)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <ShareIcon className="h-4 w-4 mr-2" />
                  Share
                </button>
              )}

              <button
                onClick={handleDownload}
                disabled={isDownloading || !onDownload}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                )}
                {isDownloading ? 'Downloading...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="p-6 space-y-8">
          {/* Executive Summary */}
          {reportData?.executiveSummary && (
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <DocumentTextIcon className="h-5 w-5 mr-2" />
                Executive Summary
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 leading-relaxed">
                  {reportData.executiveSummary}
                </p>
              </div>
            </section>
          )}

          {/* Key Statistics */}
          {reportData?.statistics && (
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <ChartBarIcon className="h-5 w-5 mr-2" />
                Key Statistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(reportData.statistics).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                    <div className="text-sm text-gray-600 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Red Flags */}
          {reportData?.redFlags && reportData.redFlags.length > 0 && (
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 mr-2 text-danger-500" />
                Critical Issues ({reportData.redFlags.length})
              </h3>
              <div className="space-y-3">
                {reportData.redFlags.map((flag, index) => (
                  <div key={index} className="flex items-start p-4 bg-danger-50 border border-danger-200 rounded-lg">
                    <ExclamationTriangleIcon className="h-5 w-5 text-danger-500 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-danger-800">{flag.description || flag}</p>
                      {flag.severity && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${
                          flag.severity === 'high' ? 'bg-danger-100 text-danger-800' :
                          flag.severity === 'medium' ? 'bg-warning-100 text-warning-800' :
                          'bg-primary-100 text-primary-800'
                        }`}>
                          {flag.severity} priority
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recommendations */}
          {reportData?.recommendations && reportData.recommendations.length > 0 && (
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <CheckCircleIcon className="h-5 w-5 mr-2 text-success-500" />
                Recommendations
              </h3>
              <div className="space-y-3">
                {reportData.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start p-4 bg-success-50 border border-success-200 rounded-lg">
                    <CheckCircleIcon className="h-5 w-5 text-success-500 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-success-800">{recommendation.description || recommendation}</p>
                      {recommendation.priority && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${
                          recommendation.priority === 'high' ? 'bg-success-100 text-success-800' :
                          recommendation.priority === 'medium' ? 'bg-warning-100 text-warning-800' :
                          'bg-primary-100 text-primary-800'
                        }`}>
                          {recommendation.priority} priority
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Document Analysis Summary */}
          {reportData?.documentsSummary && (
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Documents Analyzed
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {reportData.documentsSummary.totalDocuments || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Documents</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {reportData.documentsSummary.analyzedDocuments || 0}
                    </div>
                    <div className="text-sm text-gray-600">Analyzed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {reportData.documentsSummary.flaggedDocuments || 0}
                    </div>
                    <div className="text-sm text-gray-600">With Issues</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 pt-6 mt-8">
            <div className="text-center text-sm text-gray-500">
              <p>
                This report was generated by Esus Audit AI on {formatDate(report.createdAt)}
              </p>
              <p className="mt-1">
                For questions about this report, contact{' '}
                <a href="mailto:support@esusaudit.ai" className="text-primary-600 hover:text-primary-500">
                  support@esusaudit.ai
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default ReportViewer;
