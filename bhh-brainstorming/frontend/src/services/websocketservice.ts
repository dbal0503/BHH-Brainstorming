// File: frontend/src/services/websocket.ts
export interface User {
  id: string;
  username: string;
}

export interface Idea {
  id: string;
  content: string;
  mediaType: string;
  mediaURL?: string;
  submittedBy: User;
  ratings: IdeaRating[];
}

export interface IdeaRating {
  userId: string;
  novelty: number;
  feasibility: number;
  usefulness: number;
  comment?: string;
}

export interface ISession {
  id: string;
  name: string;
  guidingQuestions: string[];
  createdAt: string;
  creator: User;
  users: Record<string, User>;
  ideas: Idea[];
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

  getUsername(): string {
    return this.username;
  }

  connect(username: string): Promise<void> {
    this.username = username;
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket('ws://bhh-brainstorming-production-d38d.up.railway.app/ws');
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
          this.listeners[message.type].forEach((callback) => callback(message.data));
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

  createSession(name: string, guidingQuestions: string[]): void {
    this.sendMessage({
      type: 'create_session',
      username: this.username,
      data: { name, guidingQuestions },
    });
  }

  joinSession(sessionId: string): void {
    this.sendMessage({
      type: 'join_session',
      sessionId: sessionId,
      username: this.username,
    });
  }

  leaveSession(): void {
    this.sendMessage({ type: 'leave_session' });
  }

  listSessions(): void {
    this.sendMessage({ type: 'list_sessions' });
  }

  sendSessionMessage(sessionId: string, data: any): void {
    this.sendMessage({
      type: 'session_message',
      sessionId: sessionId,
      data: data,
    });
  }

  submitIdea(sessionId: string, content: string, mediaType: string = 'text', mediaURL?: string): void {
    this.sendMessage({
      type: 'idea_submission',
      sessionId: sessionId,
      username: this.username,
      data: { content, mediaType, mediaURL },
    });
  }

  aggregateIdeas(sessionId: string): void {
    this.sendMessage({
      type: 'aggregate_ideas',
      sessionId: sessionId,
    });
  }

  sendIdeaRating(sessionId: string, ideaId: string, rating: { novelty: number; feasibility: number; usefulness: number; comment?: string }): void {
    this.sendMessage({
      type: 'idea_rating',
      sessionId: sessionId,
      data: { ideaId, rating },
    });
  }

  startDiscussion(sessionId: string): void {
    this.sendMessage({
      type: 'start_discussion',
      sessionId: sessionId,
    });
  }

  sendMessage(message: Message): void {
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
      this.listeners[type] = this.listeners[type].filter((cb) => cb !== callback);
    }
  }
}

export const websocketService = new WebSocketService();
