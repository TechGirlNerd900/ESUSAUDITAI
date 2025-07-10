'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import SkeletonLoader from '@/app/components/SkeletonLoader';
import ErrorBoundary from '@/app/components/ErrorBoundary';
import clsx from 'clsx';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  timestamp: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10); // Number of logs per page
  const [totalPages, setTotalPages] = useState(1);
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false);
  const supabase = createClient();

  const fetchAuditLogs = useCallback(
    async (currentPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch audit logs from your API
        const response = await fetch(`/api/audit-logs?page=${currentPage}&pageSize=${pageSize}`);
        if (!response.ok) {
          throw new Error('Failed to fetch audit logs');
        }
        const data = await response.json();
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    fetchAuditLogs(page);
  }, [page, fetchAuditLogs]);

  // Set up Supabase Realtime subscription for audit logs
  useEffect(() => {
    const channel = supabase
      .channel('audit-logs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_logs',
        },
        (payload) => {
          console.log('New audit log received:', payload);
          // Add new log to the beginning of the list if we're on the first page
          if (page === 1) {
            setLogs((prevLogs) => [payload.new as AuditLog, ...prevLogs].slice(0, pageSize));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealTimeConnected(true);
          console.log('Connected to audit logs realtime updates');
        } else if (status === 'CLOSED') {
          setIsRealTimeConnected(false);
          console.log('Disconnected from audit logs realtime updates');
        }
      });

    return () => {
      channel.unsubscribe();
      setIsRealTimeConnected(false);
    };
  }, [page, pageSize, supabase]);

  const handleNextPage = () => {
    setPage((prevPage) => Math.min(prevPage + 1, totalPages));
  };

  const handlePrevPage = () => {
    setPage((prevPage) => Math.max(prevPage - 1, 1));
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ErrorBoundary fallback={() => <p>Error loading audit logs: {error.message}</p>}>
          {/* Render fallback component or simple error message */}
          <div className="text-red-600">Error: {error.message}</div>
          <button
            onClick={() => fetchAuditLogs(page)}
            className={clsx('btn-primary mt-4', isLoading && 'opacity-50 cursor-wait')}
          >
            {isLoading ? 'Loading...' : 'Retry'}
          </button>
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Audit Logs</h1>
      <p className="text-gray-600 mb-8">View system activities and user actions in real-time.</p>

      {!isRealTimeConnected && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.166 2.364-1.166 3.037 0L13.939 5.86c.582 1.007-.163 2.364-1.396 2.364H7.457c-1.233 0-1.978-1.357-1.396-2.364L8.485 2.495zM10 10a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 10zm0 5.25a.75.75 0 100 1.5.75.75 0 000-1.5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Real-time updates are not available. Please refresh the page to see new logs.
              </p>
            </div>
          </div>
        </div>
      )}

      {isRealTimeConnected && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">
                Real-time updates are active. New audit logs will appear automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto bg-white shadow-lg rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Timestamp
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                User ID
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Action
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Details
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                IP Address
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <SkeletonLoader lines={1} lineHeight="h-4" width="w-32" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <SkeletonLoader lines={1} lineHeight="h-4" width="w-24" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <SkeletonLoader lines={1} lineHeight="h-4" width="w-40" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <SkeletonLoader lines={1} lineHeight="h-4" width="w-full" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <SkeletonLoader lines={1} lineHeight="h-4" width="w-20" />
                  </td>
                </tr>
              ))
            ) : logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.user_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.action}
                  </td>
                  <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 max-w-xs overflow-hidden text-ellipsis">
                    {log.details ? JSON.stringify(log.details) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.ip_address || 'N/A'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500"
                >
                  No audit logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-between items-center">
        <button
          onClick={handlePrevPage}
          disabled={page === 1 || isLoading}
          className={clsx(
            'btn-secondary',
            (page === 1 || isLoading) && 'opacity-50 cursor-not-allowed'
          )}
        >
          Previous
        </button>
        <span className="text-sm text-gray-700">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={page === totalPages || isLoading}
          className={clsx(
            'btn-secondary',
            (page === totalPages || isLoading) && 'opacity-50 cursor-not-allowed'
          )}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AuditLogViewer;
