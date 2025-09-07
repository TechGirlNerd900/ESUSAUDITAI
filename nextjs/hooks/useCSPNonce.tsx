/**
 * React Hook for CSP Nonce Support
 * Provides access to CSP nonce for inline scripts and styles
 */

import { useEffect, useState } from 'react';

/**
 * Hook to get CSP nonce from meta tag or headers
 * @returns nonce string or null
 */
export function useCSPNonce(): string | null {
  const [nonce, setNonce] = useState<string | null>(null);

  useEffect(() => {
    // Try to get nonce from meta tag first
    const metaNonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content');
    if (metaNonce) {
      setNonce(metaNonce);
      return;
    }

    // For development, we might not have a nonce
    if (process.env.NODE_ENV === 'development') {
      setNonce(null);
      return;
    }

    // In production, we should always have a nonce
    console.warn('CSP nonce not found. This may cause security issues in production.');
    setNonce(null);
  }, []);

  return nonce;
}

/**
 * Hook to safely execute inline scripts with CSP nonce
 * @param script Script content to execute
 * @param dependencies Dependency array for useEffect
 */
export function useSecureScript(script: string, dependencies: any[] = []): void {
  const nonce = useCSPNonce();

  useEffect(() => {
    if (!script) return;

    // Create script element with nonce
    const scriptElement = document.createElement('script');
    if (nonce) {
      scriptElement.setAttribute('nonce', nonce);
    }
    scriptElement.textContent = script;

    // Add to document
    document.head.appendChild(scriptElement);

    // Cleanup
    return () => {
      try {
        document.head.removeChild(scriptElement);
      } catch (error) {
        // Element might already be removed
      }
    };
  }, [script, nonce, ...dependencies]);
}

/**
 * Hook to safely add inline styles with CSP nonce
 * @param css CSS content to add
 * @param dependencies Dependency array for useEffect
 */
export function useSecureStyle(css: string, dependencies: any[] = []): void {
  const nonce = useCSPNonce();

  useEffect(() => {
    if (!css) return;

    // Create style element with nonce
    const styleElement = document.createElement('style');
    if (nonce) {
      styleElement.setAttribute('nonce', nonce);
    }
    styleElement.textContent = css;

    // Add to document
    document.head.appendChild(styleElement);

    // Cleanup
    return () => {
      try {
        document.head.removeChild(styleElement);
      } catch (error) {
        // Element might already be removed
      }
    };
  }, [css, nonce, ...dependencies]);
}

/**
 * Component wrapper to provide nonce to child components
 */
interface CSPNonceProviderProps {
  children: React.ReactNode;
}

export function CSPNonceProvider({ children }: CSPNonceProviderProps) {
  const nonce = useCSPNonce();

  // Add nonce to meta tag for child components to access
  useEffect(() => {
    if (nonce && typeof document !== 'undefined') {
      let metaTag = document.querySelector('meta[name="csp-nonce"]') as HTMLMetaElement;

      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.name = 'csp-nonce';
        document.head.appendChild(metaTag);
      }

      metaTag.content = nonce;
    }
  }, [nonce]);

  return <>{children}</>;
}

/**
 * Utility function to create secure inline event handlers
 * @param handler Event handler function
 * @returns Secure event handler attributes
 */
export function createSecureEventHandler(handler: () => void): {
  onClick?: () => void;
  'data-handler'?: string;
} {
  // In development or when CSP is not strict, use regular onClick
  if (process.env.NODE_ENV === 'development') {
    return { onClick: handler };
  }

  // For production with strict CSP, use data attributes and event delegation
  return {
    'data-handler': handler.toString(),
    onClick: handler, // Fallback for components that expect onClick
  };
}

/**
 * Initialize event delegation for secure event handlers
 * Call this once in your app root
 */
export function initializeSecureEventDelegation(): void {
  if (typeof document === 'undefined') return;

  // Handle clicks on elements with data-handler attributes
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const handlerString = target.getAttribute('data-handler');

    if (handlerString) {
      try {
        // Safely evaluate the handler function
        const handler = new Function('return ' + handlerString)();
        if (typeof handler === 'function') {
          handler();
        }
      } catch (error) {
        console.error('Error executing secure event handler:', error);
      }
    }
  });
}
