import { useState, useCallback } from 'react';
import { toast } from '@/app/components/ui/use-toast';

// API integration interface - organization-scoped
export interface ApiIntegration {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  api_key: string;
  config: Record<string, any>;
  enabled: boolean;
  last_test_result?: Record<string, any>;
  organization_id: string; // Required for multi-tenant isolation
  created_at?: string;
  updated_at?: string;
}

// Test result interface
export interface TestResult {
  success: boolean;
  responseTime?: number;
  error?: string;
  [key: string]: any;
}

export const useIntegrations = () => {
  const [integrations, setIntegrations] = useState<ApiIntegration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  // Load API integrations for current organization
  const loadIntegrations = useCallback(async (type?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/integrations${type ? `?type=${type}` : ''}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load API integrations');
      }

      const data = await response.json();
      setIntegrations(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred while loading integrations';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Save API integration (organization_id is automatically set server-side)
  const saveIntegration = useCallback(
    async (integration: Partial<ApiIntegration>) => {
      try {
        if (!integration.id || !integration.name || !integration.endpoint || !integration.api_key) {
          toast({
            title: 'Validation Error',
            description: 'ID, name, endpoint, and API key are required',
            variant: 'destructive',
          });
          return false;
        }

        const response = await fetch('/api/admin/integrations', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...integration,
            // organization_id is set server-side from user profile
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save API integration');
        }

        toast({
          title: 'Success',
          description: `API integration ${integration.name} saved successfully`,
          variant: 'default',
        });

        // Reload integrations for current organization
        await loadIntegrations();
        return true;
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'An error occurred while saving',
          variant: 'destructive',
        });
        return false;
      }
    },
    [loadIntegrations]
  );

  // Delete API integration (organization isolation handled server-side)
  const deleteIntegration = useCallback(
    async (id: string) => {
      if (!confirm(`Are you sure you want to delete this integration?`)) {
        return false;
      }

      try {
        const response = await fetch(`/api/admin/integrations?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete API integration');
        }

        toast({
          title: 'Success',
          description: 'API integration deleted successfully',
          variant: 'default',
        });

        // Reload integrations for current organization
        await loadIntegrations();
        return true;
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'An error occurred while deleting',
          variant: 'destructive',
        });
        return false;
      }
    },
    [loadIntegrations]
  );

  // Test API integration (organization-scoped)
  const testIntegration = useCallback(async (id: string) => {
    setTestingIntegration(id);

    try {
      const response = await fetch('/api/admin/integrations/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to test API integration');
      }

      const data = await response.json();

      setTestResults((prev) => ({
        ...prev,
        [id]: data.testResult,
      }));

      toast({
        title: data.testResult.success ? 'Test Successful' : 'Test Failed',
        description: data.testResult.success
          ? `Successfully connected to ${data.name}`
          : `Failed to connect to ${data.name}: ${data.testResult.error}`,
        variant: data.testResult.success ? 'default' : 'destructive',
      });

      return data.testResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while testing';

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });

      const failedResult: TestResult = {
        success: false,
        error: errorMessage,
      };

      setTestResults((prev) => ({
        ...prev,
        [id]: failedResult,
      }));

      return failedResult;
    } finally {
      setTestingIntegration(null);
    }
  }, []);

  return {
    integrations,
    loading,
    error,
    testingIntegration,
    testResults,
    loadIntegrations,
    saveIntegration,
    deleteIntegration,
    testIntegration,
  };
};
