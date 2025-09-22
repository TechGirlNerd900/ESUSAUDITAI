'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Download, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

interface Report {
  id: string;
  name: string;
  type: 'audit' | 'compliance' | 'financial';
  status: 'generating' | 'ready' | 'failed';
  createdAt: string;
  downloadedAt?: string;
}

const mockReports: Report[] = [
  {
    id: '1',
    name: 'Q3 Financial Review - Final Report',
    type: 'financial',
    status: 'ready',
    createdAt: '2024-10-15T10:00:00Z',
    downloadedAt: '2024-10-16T14:30:00Z',
  },
  {
    id: '2',
    name: 'SOX Compliance Check',
    type: 'compliance',
    status: 'ready',
    createdAt: '2024-10-10T09:00:00Z',
    downloadedAt: '2024-10-15T11:00:00Z',
  },
  {
    id: '3',
    name: 'Q3 Financial Review - Draft',
    type: 'financial',
    status: 'ready',
    createdAt: '2024-10-05T08:00:00Z',
  },
];

export default function AuditReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const authenticatedFetch = useAuthenticatedFetch();

  useEffect(() => {
    // In a real app, you would fetch reports from an API
    // const response = await authenticatedFetch('/api/audit-reports');
    // setReports(response.data);
    // For now, we'll use mock data
    setTimeout(() => {
      setReports(mockReports);
      setLoading(false);
    }, 1000);
  }, [authenticatedFetch]);

  const handleDownload = async (reportId: string) => {
    // In a real app, you would call an API to download the report
    // const response = await authenticatedFetch(`/api/audit-reports/${reportId}/pdf`, {
    //   method: 'GET',
    // });
    // const blob = await response.blob();
    // const url = window.URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = `report-${reportId}.pdf`;
    // document.body.appendChild(a);
    // a.click();
    // window.URL.revokeObjectURL(url);
    // document.body.removeChild(a);

    // For now, we'll just show a success message
    alert('Report download started. This is a mock implementation.');
  };

  const handleGenerateReport = async (type: string) => {
    // In a real app, you would call an API to generate the report
    // const response = await authenticatedFetch('/api/audit-reports/generate', {
    //   method: 'POST',
    //   body: JSON.stringify({ type }),
    // });
    // setShowGenerateModal(false);
    // setReports([...reports, response.data]);

    // For now, we'll just show a success message and add a mock report
    alert(`Generating ${type} report... This is a mock implementation.`);
    const newReport: Report = {
      id: `${reports.length + 1}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Report - ${new Date().toLocaleDateString()}`,
      type: type as 'audit' | 'compliance' | 'financial',
      status: 'generating',
      createdAt: new Date().toISOString(),
    };
    setReports([newReport, ...reports]);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <header className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Audit Reports</h1>
            <p className="text-lg text-gray-600">Manage and generate your audit reports</p>
          </div>
          <Button onClick={() => setShowGenerateModal(true)} className="flex items-center">
            <BarChart3 className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </motion.div>
      </header>

      <AnimatePresence>
        {reports.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reports generated yet</h3>
            <p className="text-gray-500 mb-4">Create your first audit report to get started.</p>
            <Button onClick={() => setShowGenerateModal(true)} className="flex items-center mx-auto">
              <BarChart3 className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
          >
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{report.name}</CardTitle>
                    <CardDescription>
                      {report.type.charAt(0).toUpperCase() + report.type.slice(1)} Report
                    </CardDescription>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      report.status === 'ready'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {report.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    Created: {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                  {report.status === 'ready' && (
                    <Button
                      size="sm"
                      onClick={() => handleDownload(report.id)}
                      className="flex items-center"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Generate New Report</h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleGenerateReport('audit')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Audit Report
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleGenerateReport('compliance')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Compliance Report
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleGenerateReport('financial')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Financial Report
              </Button>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowGenerateModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
