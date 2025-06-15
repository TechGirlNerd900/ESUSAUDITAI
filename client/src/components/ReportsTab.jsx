import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { 
  DocumentArrowDownIcon,
  PlusIcon,
  EyeIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { reportsService } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import GenerateReportModal from './GenerateReportModal';

const ReportsTab = ({ projectId }) => {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: reportsData, isLoading } = useQuery(
    ['reports', projectId],
    () => reportsService.getReports(projectId),
    {
      enabled: !!projectId
    }
  );

  const generateReportMutation = useMutation(
    ({ projectId, reportName, includeCharts }) => 
      reportsService.generateReport(projectId, reportName, includeCharts),
    {
      onSuccess: () => {
        toast.success('Report generated successfully!');
        queryClient.invalidateQueries(['reports', projectId]);
        setShowGenerateModal(false);
      },
      onError: (error) => {
        toast.error(error.error || 'Failed to generate report');
      }
    }
  );

  const reports = reportsData?.reports || [];

  const handleDownloadReport = (reportUrl) => {
    window.open(reportUrl, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Audit Reports</h3>
          <p className="mt-1 text-sm text-gray-500">
            Generate and download comprehensive audit reports with AI insights.
          </p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="btn-primary"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Generate Report
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12">
          <DocumentArrowDownIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No reports generated</h3>
          <p className="mt-1 text-sm text-gray-500">
            Generate your first audit report to get started.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowGenerateModal(true)}
              className="btn-primary"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Generate Report
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <div key={report.id} className="card hover:shadow-md transition-shadow duration-200">
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {report.name}
                    </h4>
                    <div className="mt-2 flex items-center text-xs text-gray-500">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {new Date(report.generatedAt).toLocaleDateString()}
                    </div>
                    <div className="mt-2">
                      <span className={`badge ${
                        report.status === 'final' ? 'badge-success' :
                        report.status === 'draft' ? 'badge-warning' :
                        'badge-gray'
                      }`}>
                        {report.status}
                      </span>
                    </div>
                  </div>
                  <DocumentArrowDownIcon className="h-8 w-8 text-gray-400" />
                </div>

                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => handleDownloadReport(report.pdfUrl)}
                    className="flex-1 btn-outline btn-sm"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                    Download
                  </button>
                  <button
                    onClick={() => handleDownloadReport(report.pdfUrl)}
                    className="btn-outline btn-sm px-2"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <GenerateReportModal
        open={showGenerateModal}
        setOpen={setShowGenerateModal}
        projectId={projectId}
        onGenerate={(reportName, includeCharts) => {
          generateReportMutation.mutate({ projectId, reportName, includeCharts });
        }}
        isLoading={generateReportMutation.isLoading}
      />
    </div>
  );
};

export default ReportsTab;
