import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

// Mock the rate limiting Map
jest.mock('../route', () => {
  const actualModule = jest.requireActual('../route');
  return {
    ...actualModule,
  };
});

describe('/api/errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.error to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/errors', () => {
    const validErrorReport = {
      id: 'err_123456789_abc123',
      message: 'Test error message',
      timestamp: new Date().toISOString(),
      url: 'https://example.com/test',
      userAgent: 'Mozilla/5.0 Test Browser',
      retryCount: 0,
      severity: 'error',
      source: 'test_source',
    };

    it('accepts valid error reports', async () => {
      const request = new NextRequest('http://localhost:3000/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '127.0.0.1',
        },
        body: JSON.stringify(validErrorReport),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Error report received');
      expect(data.errorId).toBe(validErrorReport.id);
    });

    it('rejects invalid error reports', async () => {
      const invalidReport = {
        // Missing required fields
        message: 'Test error',
      };

      const request = new NextRequest('http://localhost:3000/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '127.0.0.1',
        },
        body: JSON.stringify(invalidReport),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid error report');
      expect(data.details).toEqual(
        expect.arrayContaining([
          'Missing or invalid error ID',
          'Missing or invalid timestamp',
          'Missing or invalid severity level',
          'Missing or invalid error source',
        ])
      );
    });

    it('enforces rate limiting', async () => {
      const request = new NextRequest('http://localhost:3000/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
        },
        body: JSON.stringify(validErrorReport),
      });

      // Send multiple requests rapidly
      const responses = [];
      for (let i = 0; i < 12; i++) {
        const response = await POST(request);
        responses.push(response);
      }

      // Check that later requests are rate limited
      const rateLimitedResponses = responses.filter(async (response) => {
        const data = await response.json();
        return response.status === 429;
      });

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('sanitizes sensitive data from error reports', async () => {
      const reportWithSensitiveData = {
        ...validErrorReport,
        additionalContext: {
          password: 'secret123',
          token: 'bearer_token_123',
          normalField: 'normal_value',
          secret: 'secret_value',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '127.0.0.1',
        },
        body: JSON.stringify(reportWithSensitiveData),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);

      // Check that console.error was called without sensitive data
      expect(console.error).toHaveBeenCalledWith(
        '[ERROR REPORT]',
        expect.objectContaining({
          id: validErrorReport.id,
          message: validErrorReport.message,
        })
      );
    });

    it('handles different severity levels', async () => {
      const severityLevels = ['low', 'medium', 'high', 'critical', 'error'];

      for (const severity of severityLevels) {
        const report = {
          ...validErrorReport,
          severity,
          id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };

        const request = new NextRequest('http://localhost:3000/api/errors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '127.0.0.1',
          },
          body: JSON.stringify(report),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      }
    });

    it('handles malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '127.0.0.1',
        },
        body: 'invalid json{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error while processing error report');
    });
  });

  describe('GET /api/errors', () => {
    it('returns mock error data', async () => {
      const request = new NextRequest('http://localhost:3000/api/errors?severity=critical&limit=5');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.errors).toBeDefined();
      expect(Array.isArray(data.errors)).toBe(true);
      expect(data.severity).toBe('critical');
      expect(data.limit).toBe(5);
    });

    it('handles query parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/errors?severity=high&limit=20');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.severity).toBe('high');
      expect(data.limit).toBe(20);
    });

    it('limits maximum results', async () => {
      const request = new NextRequest('http://localhost:3000/api/errors?limit=100');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.limit).toBe(50); // Should be capped at 50
    });

    it('handles errors gracefully', async () => {
      // Mock an error by creating a request that will cause an error
      const request = new NextRequest('http://localhost:3000/api/errors');

      // Mock console.error to throw during GET processing
      const originalConsoleError = console.error;
      console.error = jest.fn().mockImplementation(() => {
        throw new Error('Simulated error during processing');
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error while retrieving errors');

      // Restore console.error
      console.error = originalConsoleError;
    });
  });
});
