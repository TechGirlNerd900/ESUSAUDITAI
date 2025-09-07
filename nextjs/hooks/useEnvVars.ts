import { useState, useCallback } from 'react';
import { toast } from '@/app/components/ui/use-toast';

// Environment variable interface
export interface EnvVar {
  id: string;
  key: string;
  value: string;
  description?: string;
  category: string;
  sensitive: boolean;
  organization_id?: string;
  created_at?: string;
  updated_at?: string;
}

export const useEnvVars = () => {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load environment variables
  const loadEnvVars = useCallback(async (category?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/env${category ? `?category=${category}` : ''}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load environment variables');
      }

      const data = await response.json();
      setEnvVars(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'An error occurred while loading environment variables';
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

  // Save environment variable
  const saveEnvVar = useCallback(
    async (envVar: Partial<EnvVar>) => {
      try {
        if (!envVar.key || !envVar.value) {
          toast({
            title: 'Validation Error',
            description: 'Key and value are required',
            variant: 'destructive',
          });
          return false;
        }

        const response = await fetch('/api/admin/env', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(envVar),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save environment variable');
        }

        toast({
          title: 'Success',
          description: `Environment variable ${envVar.key} saved successfully`,
          variant: 'default',
        });

        // Reload environment variables
        await loadEnvVars();
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
    [loadEnvVars]
  );

  // Delete environment variable
  const deleteEnvVar = useCallback(
    async (key: string) => {
      if (!confirm(`Are you sure you want to delete ${key}?`)) {
        return false;
      }

      try {
        const response = await fetch(`/api/admin/env?key=${encodeURIComponent(key)}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete environment variable');
        }

        toast({
          title: 'Success',
          description: `Environment variable ${key} deleted successfully`,
          variant: 'default',
        });

        // Reload environment variables
        await loadEnvVars();
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
    [loadEnvVars]
  );

  return {
    envVars,
    loading,
    error,
    loadEnvVars,
    saveEnvVar,
    deleteEnvVar,
  };
};
