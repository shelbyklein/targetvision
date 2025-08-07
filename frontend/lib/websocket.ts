const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

class WebSocketService {
  private socket: WebSocket | null = null;
  private messageHandlers: ((data: any) => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private sessionId: string | null = null;
  private currentClientId: string | null = null;
  private isIntentionalDisconnect = false;
  private connectionPromise: Promise<void> | null = null;

  connect(clientId: string, sessionId?: string) {
    // If already connected or connecting with the same clientId, don't reconnect
    if (this.currentClientId === clientId && 
        (this.socket?.readyState === WebSocket.OPEN || 
         this.socket?.readyState === WebSocket.CONNECTING)) {
      return this.connectionPromise || Promise.resolve();
    }

    // If connecting with a different clientId, close the existing connection
    if (this.socket && this.currentClientId !== clientId) {
      this.isIntentionalDisconnect = true;
      this.socket.close();
      this.socket = null;
      this.connectionPromise = null;
    }

    this.currentClientId = clientId;
    this.sessionId = sessionId || null;
    this.isIntentionalDisconnect = false;
    const wsUrl = `${WS_URL}/api/chat/ws/${clientId}`;
    
    // Create connection promise to prevent duplicate connections
    this.connectionPromise = new Promise((resolve) => {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.messageHandlers.forEach(handler => handler(data));
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.socket.onclose = () => {
        console.log('WebSocket disconnected');
        this.connectionPromise = null;
        if (!this.isIntentionalDisconnect && this.currentClientId) {
          this.attemptReconnect(this.currentClientId);
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        resolve(); // Resolve even on error to prevent hanging
      };
    });
    
    return this.connectionPromise;
  }

  private attemptReconnect(clientId: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms...`);
    
    setTimeout(() => {
      this.connect(clientId, this.sessionId || undefined);
    }, delay);
  }

  sendMessage(content: string, sessionId?: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const message = {
        content,
        session_id: sessionId || this.sessionId,
        timestamp: new Date().toISOString(),
      };
      
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  onMessage(handler: (data: any) => void) {
    this.messageHandlers.push(handler);
  }

  removeMessageHandler(handler: (data: any) => void) {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
  }

  disconnect() {
    if (this.socket) {
      this.isIntentionalDisconnect = true;
      this.socket.close();
      this.socket = null;
      this.currentClientId = null;
    }
    this.messageHandlers = [];
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();