'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';

interface WebSocketContextType {
  ws: WebSocket | null;
  isConnected: boolean;
  sendMessage: (message: any) => void;
  error: Event | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
  url?: string; // Optional WebSocket URL, defaults to localhost:8080
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  url = 'ws://localhost:8080',
}) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Event | null>(null);

  const connect = useCallback(() => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return; // Already connected or connecting
    }

    // Skip WebSocket connection in development if server is not available
    if (process.env.NODE_ENV === 'development') {
      console.log('WebSocket connection skipped in development mode');
      return;
    }

    console.log('Attempting to connect to WebSocket...');
    try {
      const newWs = new WebSocket(url);

      newWs.onopen = () => {
        console.log('WebSocket connected');
        setWs(newWs);
        setIsConnected(true);
        setError(null);
      };

      newWs.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        // You might want to dispatch this to a global state manager or use a callback
        // For now, just log.
      };

      newWs.onerror = (event) => {
        console.warn('WebSocket error (connection optional):', event);
        setError(event);
        setIsConnected(false);
      };

      newWs.onclose = (event) => {
        console.log('WebSocket disconnected:', event);
        setIsConnected(false);
        setWs(null); // Clear the WebSocket instance
        
        // Only attempt to reconnect in production or if explicitly enabled
        if (process.env.NODE_ENV === 'production' || process.env.ENABLE_WEBSOCKET_RECONNECT === 'true') {
          setTimeout(connect, 10000); // Increased delay to reduce noise
        }
      };

      setWs(newWs); // Set the new WebSocket instance even if not yet open
    } catch (error) {
      console.warn('WebSocket connection failed (optional feature):', error);
      setError(error as Event);
      setIsConnected(false);
    }
  }, [url, ws]);

  useEffect(() => {
    connect();

    // Clean up on unmount
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [connect, ws]);

  const sendMessage = useCallback(
    (message: any) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      } else {
        console.warn('WebSocket is not connected. Message not sent:', message);
      }
    },
    [ws]
  );

  return (
    <WebSocketContext.Provider value={{ ws, isConnected, sendMessage, error }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
