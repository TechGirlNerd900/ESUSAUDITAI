import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { withErrorHandling, withRetry } from '@/lib/errorHandler';
import { CircuitBreaker } from '@/lib/errorHandler';

// Define service types for health checks
type ServiceStatus = 'ok' | 'degraded' | 'error';

interface ServiceHealth {
  status: ServiceStatus;
  responseTime?: number;
  message?: string;
  lastChecked?: string;
}

interface HealthResponse {
  status: ServiceStatus;
  timestamp: string;
  version: string;
  environment: string;
  services: Record<string, ServiceHealth>;
}

// Create circuit breakers for external services
const azureCircuitBreaker = new CircuitBreaker(3, 60000, 2);
const openaiCircuitBreaker = new CircuitBreaker(3, 60000, 2);

/**
 * GET handler for health check
 * Checks the health of all system components
 */
export const GET = withErrorHandling(async (_request: NextRequest) => {
  const startTime = Date.now();

  // Initialize health response
  const healthResponse: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {},
  };

  // Initialize Supabase client
  const supabase = await createClient();

  // Check database health
  try {
    const dbStartTime = Date.now();

    const { data, error } = await withRetry(
      async () => {
        return await supabase.from('health_check').select('last_check, status').limit(1);
      },
      { maxRetries: 2, baseDelay: 500 }
    );

    const responseTime = Date.now() - dbStartTime;

    if (error) {
      healthResponse.services.database = {
        status: 'error',
        responseTime,
        message: error.message,
      };
      healthResponse.status = 'degraded';
    } else {
      healthResponse.services.database = {
        status: 'ok',
        responseTime,
        lastChecked: data ? data[0]?.last_check : undefined,
      };

      // Update health check timestamp
      await supabase
        .from('health_check')
        .upsert({
          id: '00000000-0000-0000-0000-000000000000',
          last_check: new Date().toISOString(),
          status: 'healthy',
          details: { checkedFrom: 'health-api' },
        })
        .select();
    }
  } catch (error) {
    healthResponse.services.database = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown database error',
    };
    healthResponse.status = 'degraded';
  }

  // Check Azure Document Intelligence health
  try {
    const azureStartTime = Date.now();

    await azureCircuitBreaker.execute(async () => {
      // Mock implementation - in a real app, you would call Azure Document Intelligence
      // with a simple ping or status check
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate success or failure based on environment variable
      if (process.env.MOCK_AZURE_FAILURE === 'true') {
        throw new Error('Simulated Azure failure');
      }

      return true;
    });

    const responseTime = Date.now() - azureStartTime;

    healthResponse.services.azureDocumentIntelligence = {
      status: 'ok',
      responseTime,
    };
  } catch (error) {
    healthResponse.services.azureDocumentIntelligence = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown Azure error',
    };
    healthResponse.status = 'degraded';
  }

  // Check OpenAI health
  try {
    const openaiStartTime = Date.now();

    await openaiCircuitBreaker.execute(async () => {
      // Mock implementation - in a real app, you would call OpenAI
      // with a simple ping or status check
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Simulate success or failure based on environment variable
      if (process.env.MOCK_OPENAI_FAILURE === 'true') {
        throw new Error('Simulated OpenAI failure');
      }

      return true;
    });

    const responseTime = Date.now() - openaiStartTime;

    healthResponse.services.openai = {
      status: 'ok',
      responseTime,
    };
  } catch (error) {
    healthResponse.services.openai = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown OpenAI error',
    };
    healthResponse.status = 'degraded';
  }

  // Check storage health
  try {
    const storageStartTime = Date.now();

    const { error } = await withRetry(
      async () => {
        return await supabase.storage.getBucket('documents');
      },
      { maxRetries: 2, baseDelay: 500 }
    );

    const responseTime = Date.now() - storageStartTime;

    if (error) {
      healthResponse.services.storage = {
        status: 'error',
        responseTime,
        message: error.message,
      };
      healthResponse.status = 'degraded';
    } else {
      healthResponse.services.storage = {
        status: 'ok',
        responseTime,
      };
    }
  } catch (error) {
    healthResponse.services.storage = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown storage error',
    };
    healthResponse.status = 'degraded';
  }

  // Check authentication health
  try {
    const authStartTime = Date.now();

    const { error } = await withRetry(
      async () => {
        return await supabase.auth.getSession();
      },
      { maxRetries: 2, baseDelay: 500 }
    );

    const responseTime = Date.now() - authStartTime;

    if (error) {
      healthResponse.services.authentication = {
        status: 'error',
        responseTime,
        message: error.message,
      };
      healthResponse.status = 'degraded';
    } else {
      healthResponse.services.authentication = {
        status: 'ok',
        responseTime,
      };
    }
  } catch (error) {
    healthResponse.services.authentication = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown authentication error',
    };
    healthResponse.status = 'degraded';
  }

  // Add overall response time
  const totalResponseTime = Date.now() - startTime;
  healthResponse.services.overall = {
    status: 'ok',
    responseTime: totalResponseTime,
  };

  // Set appropriate status code based on health
  const statusCode =
    healthResponse.status === 'ok' ? 200 : healthResponse.status === 'degraded' ? 200 : 500;

  return NextResponse.json(healthResponse, { status: statusCode });
});
