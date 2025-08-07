const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private socket: WebSocket | null = null;
  private messageHandlers: Set<(data: any) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private clientId: string | null = null;
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
      // Generate a stable client ID for the session
      WebSocketManager.instance.clientId = 
        typeof window !== 'undefined' 
          ? (sessionStorage.getItem('ws-client-id') || Math.random().toString(36).substring(7))
          : Math.random().toString(36).substring(7);
      
      if (typeof window !== 'undefined' && WebSocketManager.instance.clientId) {
        sessionStorage.setItem('ws-client-id', WebSocketManager.instance.clientId);
      }
    }
    return WebSocketManager.instance;
  }

  connect(): void {
    // Prevent multiple simultaneous connections
    if (this.isConnecting || this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = `${WS_URL}/api/chat/ws/${this.clientId}`;
    
    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
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
        this.isConnecting = false;
        this.socket = null;
        this.attemptReconnect();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.isConnecting = false;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms...`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  sendMessage(content: string, sessionId?: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const message = {
        content,
        session_id: sessionId,
        timestamp: new Date().toISOString(),
      };
      
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
      // Try to reconnect
      this.connect();
    }
  }

  onMessage(handler: (data: any) => void): void {
    this.messageHandlers.add(handler);
  }

  removeMessageHandler(handler: (data: any) => void): void {
    this.messageHandlers.delete(handler);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.messageHandlers.clear();
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

// Export a singleton instance
export const wsService = WebSocketManager.getInstance();