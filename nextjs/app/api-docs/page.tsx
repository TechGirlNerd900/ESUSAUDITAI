'use client';

import { useEffect, useState } from 'react';

interface ApiEndpoint {
  path: string;
  method: string;
  summary: string;
  description?: string;
  parameters?: any[];
  responses?: any;
}

export default function ApiDocs() {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch OpenAPI spec and parse it
    fetch('/api-docs/openapi.yaml')
      .then((response) => response.text())
      .then((yamlText) => {
        // For now, show a static list of known endpoints
        // In a full implementation, you'd parse the YAML
        const staticEndpoints: ApiEndpoint[] = [
          {
            path: '/api/auth/login',
            method: 'POST',
            summary: 'User Authentication',
            description: 'Authenticate user with email and password',
          },
          {
            path: '/api/auth/signup',
            method: 'POST',
            summary: 'User Registration',
            description: 'Register a new user account',
          },
          {
            path: '/api/documents/upload',
            method: 'POST',
            summary: 'Document Upload',
            description: 'Upload documents for AI analysis',
          },
          {
            path: '/api/documents/{id}',
            method: 'GET',
            summary: 'Get Document',
            description: 'Retrieve document information',
          },
          {
            path: '/api/analysis/document/{id}',
            method: 'POST',
            summary: 'Document Analysis',
            description: 'Analyze document using AI services',
          },
          {
            path: '/api/projects',
            method: 'GET',
            summary: 'List Projects',
            description: 'Get all projects for the authenticated user',
          },
          {
            path: '/api/projects',
            method: 'POST',
            summary: 'Create Project',
            description: 'Create a new audit project',
          },
          {
            path: '/api/audit-logs',
            method: 'GET',
            summary: 'Audit Logs',
            description: 'Retrieve audit logs (admin only)',
          },
        ];
        setEndpoints(staticEndpoints);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load API documentation:', error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">ESUS Audit AI API Documentation</h1>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Overview</h2>
        <p className="text-gray-600 mb-4">
          The ESUS Audit AI API provides endpoints for document analysis, project management, and
          audit automation. All endpoints require authentication unless otherwise specified.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <p className="text-sm text-blue-800">
            <strong>Base URL:</strong>{' '}
            {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {endpoints.map((endpoint, index) => (
          <div key={index} className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-3">
              <span
                className={`px-3 py-1 rounded text-sm font-medium mr-3 ${
                  endpoint.method === 'GET'
                    ? 'bg-green-100 text-green-800'
                    : endpoint.method === 'POST'
                      ? 'bg-blue-100 text-blue-800'
                      : endpoint.method === 'PUT'
                        ? 'bg-yellow-100 text-yellow-800'
                        : endpoint.method === 'DELETE'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                }`}
              >
                {endpoint.method}
              </span>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{endpoint.path}</code>
            </div>
            <h3 className="text-lg font-semibold mb-2">{endpoint.summary}</h3>
            {endpoint.description && <p className="text-gray-600 mb-3">{endpoint.description}</p>}
            <div className="text-sm text-gray-500">
              Authentication: Required (except for login/signup endpoints)
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Authentication</h2>
        <p className="text-gray-600 mb-4">
          Most API endpoints require authentication using JWT tokens. Include the token in the
          Authorization header:
        </p>
        <div className="bg-gray-100 p-4 rounded">
          <code>Authorization: Bearer &lt;your-jwt-token&gt;</code>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Error Responses</h2>
        <p className="text-gray-600 mb-4">
          The API returns standard HTTP status codes and JSON error responses:
        </p>
        <div className="space-y-2">
          <div>
            <strong>400:</strong> Bad Request - Invalid input data
          </div>
          <div>
            <strong>401:</strong> Unauthorized - Authentication required
          </div>
          <div>
            <strong>403:</strong> Forbidden - Insufficient permissions
          </div>
          <div>
            <strong>404:</strong> Not Found - Resource not found
          </div>
          <div>
            <strong>429:</strong> Too Many Requests - Rate limit exceeded
          </div>
          <div>
            <strong>500:</strong> Internal Server Error - Server error
          </div>
        </div>
      </div>
    </div>
  );
}
