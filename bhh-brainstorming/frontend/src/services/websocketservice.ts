// src/services/websocket.ts
export interface User {
    id: string;
    username: string;
  }
  
  export interface Session {
    id: string;
    name: string;
    createdAt: string;
    creator: User;
    users: Record<string, User>;
  }
  
  export interface Message {
    type: string;
    sessionId?: string;
    userId?: string;
    username?: string;
    data?: any;
  }
  
  export class WebSocketService {
    private socket: WebSocket | null = null;
    private username: string = '';
    private listeners: { [key: string]: ((data: any) => void)[] } = {};
  
    connect(username: string): Promise<void> {
      this.username = username;
      
      return new Promise((resolve, reject) => {
        this.socket = new WebSocket('ws://localhost:8080/ws');
        
        this.socket.onopen = () => {
          console.log('WebSocket connected');
          this.listSessions();
          resolve();
        };
        
        this.socket.onclose = () => {
          console.log('WebSocket disconnected');
          this.socket = null;
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
        
        this.socket.onmessage = (event) => {
          const message: Message = JSON.parse(event.data);
          console.log('Received message:', message);
          
          if (message.type && this.listeners[message.type]) {
            this.listeners[message.type].forEach(callback => callback(message.data));
          }
        };
      });
    }
    
    disconnect(): void {
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
    }
    
    createSession(name: string): void {
      this.sendMessage({
        type: 'create_session',
        username: this.username,
        data: name
      });
    }
    
    joinSession(sessionId: string): void {
      this.sendMessage({
        type: 'join_session',
        sessionId: sessionId,
        username: this.username
      });
    }
    
    leaveSession(): void {
      this.sendMessage({
        type: 'leave_session'
      });
    }
    
    listSessions(): void {
      this.sendMessage({
        type: 'list_sessions'
      });
    }
    
    sendSessionMessage(sessionId: string, data: any): void {
      this.sendMessage({
        type: 'session_message',
        sessionId: sessionId,
        data: data
      });
    }
    
    private sendMessage(message: Message): void {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message));
      } else {
        console.error('WebSocket is not connected');
      }
    }
    
    on(type: string, callback: (data: any) => void): void {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }
      this.listeners[type].push(callback);
    }
    
    off(type: string, callback: (data: any) => void): void {
      if (this.listeners[type]) {
        this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
      }
    }
  }
  
  export const websocketService = new WebSocketService();