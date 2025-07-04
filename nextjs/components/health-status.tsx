'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, AlertCircle, CheckCircle, Activity } from 'lucide-react';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  environment: string;
  services: Record<
    string,
    {
      status: 'ok' | 'degraded' | 'error';
      responseTime?: number;
      message?: string;
    }
  >;
}

export default function HealthStatus() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/health');

      if (!response.ok) {
        throw new Error('Failed to fetch health status');
      }

      const data = await response.json();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching health status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();

    // Refresh health status every 5 minutes
    const interval = setInterval(fetchHealth, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-4 w-4 mr-1" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4 mr-1" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 mr-1" />;
      default:
        return <Activity className="h-4 w-4 mr-1" />;
    }
  };

  if (loading && !health) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin mr-1" />
        Loading...
      </Button>
    );
  }

  if (error && !health) {
    return (
      <Button variant="ghost" size="sm" className="text-red-500" onClick={fetchHealth}>
        <AlertCircle className="h-4 w-4 mr-1" />
        Error
      </Button>
    );
  }

  if (!health) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={getStatusColor(health.status)}>
          {getStatusIcon(health.status)}
          System: {health.status.toUpperCase()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">System Health</h4>
            <Badge className={getStatusColor(health.status)}>{health.status.toUpperCase()}</Badge>
          </div>

          <div className="text-xs text-gray-500">
            <p>Version: {health.version}</p>
            <p>Environment: {health.environment}</p>
            <p>Last checked: {new Date(health.timestamp).toLocaleString()}</p>
          </div>

          <div className="space-y-2">
            <h5 className="text-sm font-medium">Services</h5>
            {Object.entries(health.services).map(([name, service]) => (
              <div key={name} className="flex justify-between items-center text-sm">
                <span>{name}</span>
                <div className="flex items-center">
                  {service.responseTime && (
                    <span className="text-xs text-gray-500 mr-2">{service.responseTime}ms</span>
                  )}
                  <Badge className={getStatusColor(service.status)}>
                    {service.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <Button size="sm" variant="outline" className="w-full" onClick={fetchHealth}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Refreshing...
              </>
            ) : (
              'Refresh'
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
