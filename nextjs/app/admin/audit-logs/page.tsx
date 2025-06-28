'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/app/components/WebSocketProvider';
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
  const { isConnected, sendMessage } = useWebSocket();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10); // Number of logs per page
  const [totalPages, setTotalPages] = useState(1);

  const fetchAuditLogs = async (currentPage: number) => {
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
  };

  useEffect(() => {
    fetchAuditLogs(page);
  }, [page]);

  // Example of receiving real-time updates (if implemented on server)
  useEffect(() => {
    if (!isConnected) return;

    // You might want to send an auth message to the websocket server here
    // sendMessage({ type: 'auth', payload: { userId: 'some-user-id', role: 'admin' } });

    // Listen for 'audit_log_created' events from the WebSocket
    // This is a placeholder for how you might handle incoming messages
    if (useWebSocket().ws) {
      useWebSocket().ws?.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'audit_log_created') {
            setLogs(prevLogs => [message.payload, ...prevLogs].slice(0, pageSize)); // Add new log and maintain page size
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      });
    }
  }, [isConnected, pageSize, sendMessage]);

  const handleNextPage = () => {
    setPage(prevPage => Math.min(prevPage + 1, totalPages));
  };

  const handlePrevPage = () => {
    setPage(prevPage => Math.max(prevPage - 1, 1));
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ErrorBoundary fallback={() => <p>Error loading audit logs: {error.message}</p>}>
          {/* Render fallback component or simple error message */}
          <div className="text-red-600">Error: {error.message}</div>
          <button onClick={() => fetchAuditLogs(page)} className="btn-primary mt-4">Retry</button>
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Audit Logs</h1>
      <p className="text-gray-600 mb-8">View system activities and user actions in real-time.</p>

      {!isConnected && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.166 2.364-1.166 3.037 0L13.939 5.86c.582 1.007-.163 2.364-1.396 2.364H7.457c-1.233 0-1.978-1.357-1.396-2.364L8.485 2.495zM10 10a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 10zm0 5.25a.75.75 0 100 1.5.75.75 0 000-1.5z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                WebSocket is not connected. Real-time updates may not be available.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto bg-white shadow-lg rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User ID
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
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
          className="btn-secondary"
        >
          Previous
        </button>
        <span className="text-sm text-gray-700">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={page === totalPages || isLoading}
          className="btn-secondary"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AuditLogViewer;