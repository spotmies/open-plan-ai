import { io, Socket } from 'socket.io-client';
import { config } from '@/config';
import { logger } from '@/services/monitoring/logger';
import type { AskUserQuestion, AssistantCard } from '../assistantData';
import type { IAiAssistantTransport, Unsubscribe } from './IAiAssistantTransport';

// A second, independent Socket.IO connection — not a fork of an established
// pattern here, but a precedent-following one: src/modules/auth/AuthContext.tsx
// already opens its own separate `io()` connection (for auth:force_logout)
// rather than sharing the chat feature's socket, which keeps its `Socket`
// field private. Same idea here: the assistant's event vocabulary
// (ai:token/ai:tool-call/ai:question/...) has nothing to do with chat's.
export class SocketIOAiAssistantTransport implements IAiAssistantTransport {
  private socket: Socket;
  private activeRooms = new Set<string>();

  constructor() {
    this.socket = io(config.api.wsUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });

    this.socket.on('connect_error', (err) => {
      logger.warn('[SocketIOAiAssistantTransport] connect error', { message: err.message });
    });

    this.socket.on('connect', () => {
      this.activeRooms.forEach((id) => this.socket.emit('join-ai-conversation', id));
    });
  }

  connect(): void {
    if (!this.socket.connected) this.socket.connect();
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  joinConversation(conversationId: string): void {
    this.activeRooms.add(conversationId);
    this.socket.emit('join-ai-conversation', conversationId);
  }

  leaveConversation(conversationId: string): void {
    this.activeRooms.delete(conversationId);
    this.socket.emit('leave-ai-conversation', conversationId);
  }

  onToken(handler: (token: string) => void): Unsubscribe {
    const wrapped = (payload: { token: string }) => handler(payload.token);
    this.socket.on('ai:token', wrapped);
    return () => this.socket.off('ai:token', wrapped);
  }

  onToolCall(handler: (tool: string) => void): Unsubscribe {
    const wrapped = (payload: { tool: string }) => handler(payload.tool);
    this.socket.on('ai:tool-call', wrapped);
    return () => this.socket.off('ai:tool-call', wrapped);
  }

  onToolResult(handler: (tool: string, summary: string) => void): Unsubscribe {
    const wrapped = (payload: { tool: string; summary: string }) => handler(payload.tool, payload.summary);
    this.socket.on('ai:tool-result', wrapped);
    return () => this.socket.off('ai:tool-result', wrapped);
  }

  onQuestion(handler: (questions: AskUserQuestion[]) => void): Unsubscribe {
    const wrapped = (payload: { questions: AskUserQuestion[] }) => handler(payload.questions);
    this.socket.on('ai:question', wrapped);
    return () => this.socket.off('ai:question', wrapped);
  }

  onCard(handler: (card: AssistantCard) => void): Unsubscribe {
    const wrapped = (payload: { card: AssistantCard }) => handler(payload.card);
    this.socket.on('ai:card', wrapped);
    return () => this.socket.off('ai:card', wrapped);
  }

  onDone(handler: (messageId: string) => void): Unsubscribe {
    const wrapped = (payload: { messageId: string }) => handler(payload.messageId);
    this.socket.on('ai:done', wrapped);
    return () => this.socket.off('ai:done', wrapped);
  }

  onStopped(handler: (messageId: string | null) => void): Unsubscribe {
    const wrapped = (payload: { messageId: string | null }) => handler(payload.messageId);
    this.socket.on('ai:stopped', wrapped);
    return () => this.socket.off('ai:stopped', wrapped);
  }

  onError(handler: (code: string, message: string) => void): Unsubscribe {
    const wrapped = (payload: { code: string; message: string }) => handler(payload.code, payload.message);
    this.socket.on('ai:error', wrapped);
    return () => this.socket.off('ai:error', wrapped);
  }
}
