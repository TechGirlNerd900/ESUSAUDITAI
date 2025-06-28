import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ErrorBoundary from '../ErrorBoundary'

// Mock fetch for error reporting
global.fetch = jest.fn()

// Component that throws an error for testing
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock console.error to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('renders error UI when there is an error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument()
  })

  it('provides retry functionality', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    const retryButton = screen.getByText('Try Again')
    fireEvent.click(retryButton)

    // After retry, component should attempt to render children again
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('provides reload page functionality', () => {
    // Mock window.location.reload
    const mockReload = jest.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    })

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    const reloadButton = screen.getByText('Reload Page')
    fireEvent.click(reloadButton)

    expect(mockReload).toHaveBeenCalled()
  })

  it('shows contact support message after multiple retries', () => {
    const TestComponent = () => {
      const [errorCount, setErrorCount] = React.useState(0)
      
      return (
        <ErrorBoundary key={errorCount}>
          <button onClick={() => setErrorCount(count => count + 1)}>
            Trigger Error
          </button>
          <ThrowError shouldThrow={errorCount > 0} />
        </ErrorBoundary>
      )
    }

    render(<TestComponent />)

    // Trigger multiple errors
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByText('Trigger Error'))
      if (screen.queryByText('Try Again')) {
        fireEvent.click(screen.getByText('Try Again'))
      }
    }

    expect(screen.getByText(/Multiple retry attempts detected/)).toBeInTheDocument()
    expect(screen.getByText(/contact support/)).toBeInTheDocument()
  })

  it('uses custom fallback component when provided', () => {
    const CustomFallback = ({ error, retry }: { error: Error | null; retry: () => void }) => (
      <div>
        <h1>Custom Error UI</h1>
        <p>Error: {error?.message}</p>
        <button onClick={retry}>Custom Retry</button>
      </div>
    )

    render(
      <ErrorBoundary fallback={CustomFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom Error UI')).toBeInTheDocument()
    expect(screen.getByText('Error: Test error message')).toBeInTheDocument()
    expect(screen.getByText('Custom Retry')).toBeInTheDocument()
  })

  it('reports errors to API in production', async () => {
    const originalEnv = process.env.NODE_ENV
    
    // Mock NODE_ENV properly
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      writable: true,
      configurable: true,
    })

    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    // Wait for error reporting
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/errors',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Test error message'),
      })
    )

    // Restore original NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
      configurable: true,
    })
  })
})