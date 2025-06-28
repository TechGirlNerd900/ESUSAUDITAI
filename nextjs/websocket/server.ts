import { WebSocket, WebSocketServer } from 'ws';

// Extend WebSocket interface for custom properties
interface CustomWebSocket extends WebSocket {
  isAlive: boolean;
  userId?: string;
  projectId?: string;
}

const wss = new WebSocketServer({ port: 8080 });

console.log('WebSocket server started on port 8080');

wss.on('connection', function connection(ws: WebSocket) { // Use base WebSocket type for connection event
  const customWs = ws as CustomWebSocket; // Cast to CustomWebSocket
  customWs.isAlive = true;
  console.log('Client connected');

  customWs.on('pong', () => {
    customWs.isAlive = true;
  });

  customWs.on('message', function message(data: string) { // Explicitly type data as string
    const message = data.toString();
    console.log('Received message:', message);

    try {
      const parsedMessage = JSON.parse(message);

      switch (parsedMessage.type) {
        case 'auth':
          customWs.userId = parsedMessage.payload.userId;
          customWs.projectId = parsedMessage.payload.projectId;
          console.log(`Client authenticated: User ${customWs.userId}, Project ${customWs.projectId}`);
          customWs.send(JSON.stringify({ type: 'auth_success', message: 'Authenticated' }));
          break;
        case 'ping':
          customWs.send(JSON.stringify({ type: 'pong' }));
          break;
        case 'project_update':
          // Example: Broadcast project updates to all clients in the same project
          wss.clients.forEach(client => {
            const clientWs = client as CustomWebSocket;
            if (clientWs.readyState === WebSocket.OPEN && clientWs.projectId === parsedMessage.payload.projectId) {
              clientWs.send(JSON.stringify({ type: 'project_updated', payload: parsedMessage.payload }));
            }
          });
          console.log(`Project ${parsedMessage.payload.projectId} updated:`, parsedMessage.payload.status);
          break;
        case 'document_analysis_progress':
          // Example: Send progress updates to specific user/project
          wss.clients.forEach(client => {
            const clientWs = client as CustomWebSocket;
            if (clientWs.readyState === WebSocket.OPEN && clientWs.userId === parsedMessage.payload.userId) {
              clientWs.send(JSON.stringify({ type: 'analysis_progress', payload: parsedMessage.payload }));
            }
          });
          console.log(`Analysis progress for user ${parsedMessage.payload.userId}: ${parsedMessage.payload.progress}%`);
          break;
        default:
          customWs.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
          break;
      }
    } catch (e: any) { // Explicitly type catch error
      console.error('Failed to parse message or handle:', e);
      customWs.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  customWs.on('close', () => {
    console.log('Client disconnected');
  });

  customWs.on('error', (error: Error) => { // Explicitly type error
    console.error('WebSocket error:', error);
  });
});

// Ping clients every 30 seconds to keep connection alive
const interval = setInterval(() => {
  wss.clients.forEach(ws => {
    const customWs = ws as CustomWebSocket;
    if (customWs.isAlive === false) {
      console.log('Terminating dead connection');
      return customWs.terminate();
    }

    customWs.isAlive = false;
    customWs.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
  console.log('WebSocket server closed');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing WebSocket server');
  wss.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing WebSocket server');
  wss.close(() => {
    process.exit(0);
  });
});