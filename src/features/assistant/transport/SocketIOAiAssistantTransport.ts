import { io, Socket } from 'socket.io-client';
import { config } from '@/config';
import { logger } from '@/services/monitoring/logger';
import { refreshAccessToken, AUTH_TOKEN_REFRESHED_EVENT } from '@/services/api/client';
import type { AskUserQuestion, AssistantCard } from '../assistantData';
import type { IAiAssistantTransport, Unsubscribe } from './IAiAssistantTransport';

// A second, independent Socket.IO connection — not a fork of an established
// pattern here, but a precedent-following one: src/modules/auth/AuthContext.tsx
// already opens its own separate `io()` connection (for auth:force_logout)
// rather than sharing the chat feature's socket, which keeps its `Socket`
// field private. Same idea here: the assistant's event vocabulary
// (ai:token/ai:tool-call/ai:question/...) has nothing to do with chat's.

// The accessToken cookie this socket authenticates with at handshake time is
// short-lived (~15 min) and never re-checked once connected. If the socket
// drops for any reason (network blip, backgrounded tab, server restart) after
// that cookie has expired, every automatic reconnection attempt fails
// identically forever — refresh normally only happens reactively, when a REST
// call gets a 401, and nothing was tying that back to this socket. Cap how
// often a connect failure is allowed to trigger its own refresh so a truly
// dead session (refresh token also expired) doesn't hammer the endpoint.
// Mirrors SocketIOChatTransport's fix for the identical problem.
const CONNECT_ERROR_REFRESH_COOLDOWN_MS = 10_000;

export class SocketIOAiAssistantTransport implements IAiAssistantTransport {
  private socket: Socket;
  private activeRooms = new Set<string>();
  private refreshInFlight = false;
  private lastConnectErrorRefreshAt = 0;

  constructor() {
    this.socket = io(config.api.wsUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });

    this.socket.on('connect_error', (err) => {
      logger.warn('[SocketIOAiAssistantTransport] connect error', { message: err.message });
      this.tryRefreshAndReconnect();
    });

    // A REST call elsewhere (or the refresh triggered above) may have just
    // rotated the accessToken cookie — retry immediately rather than waiting
    // out socket.io's own backoff with a cookie it hasn't re-read yet.
    window.addEventListener(AUTH_TOKEN_REFRESHED_EVENT, () => this.connect());

    this.socket.on('connect', () => {
      this.activeRooms.forEach((id) => this.socket.emit('join-ai-conversation', id));
    });
  }

  private tryRefreshAndReconnect(): void {
    if (this.refreshInFlight) return;
    const now = Date.now();
    if (now - this.lastConnectErrorRefreshAt < CONNECT_ERROR_REFRESH_COOLDOWN_MS) return;
    this.lastConnectErrorRefreshAt = now;
    this.refreshInFlight = true;
    refreshAccessToken()
      .then((refreshed) => {
        if (refreshed) this.connect();
      })
      .finally(() => {
        this.refreshInFlight = false;
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

  // ─── Voice dictation (Sarvam realtime STT) ───────────────────────────────

  startDictation(options?: { language?: string }): void {
    this.socket.emit('stt:start', options ?? {});
  }

  sendAudioChunk(chunk: ArrayBuffer): void {
    this.socket.emit('stt:audio', chunk);
  }

  stopDictation(): void {
    this.socket.emit('stt:stop');
  }

  onSttReady(handler: () => void): Unsubscribe {
    this.socket.on('stt:ready', handler);
    return () => this.socket.off('stt:ready', handler);
  }

  onSttPartial(handler: (text: string, utteranceIdx: number) => void): Unsubscribe {
    const wrapped = (payload: { text: string; utteranceIdx: number }) => handler(payload.text, payload.utteranceIdx);
    this.socket.on('stt:partial', wrapped);
    return () => this.socket.off('stt:partial', wrapped);
  }

  onSttFinal(handler: (text: string, utteranceIdx: number) => void): Unsubscribe {
    const wrapped = (payload: { text: string; utteranceIdx: number }) => handler(payload.text, payload.utteranceIdx);
    this.socket.on('stt:final', wrapped);
    return () => this.socket.off('stt:final', wrapped);
  }

  onSttSpeechStart(handler: (utteranceIdx: number) => void): Unsubscribe {
    const wrapped = (payload: { utteranceIdx: number }) => handler(payload.utteranceIdx);
    this.socket.on('stt:speech-start', wrapped);
    return () => this.socket.off('stt:speech-start', wrapped);
  }

  onSttSpeechEnd(handler: (utteranceIdx: number) => void): Unsubscribe {
    const wrapped = (payload: { utteranceIdx: number }) => handler(payload.utteranceIdx);
    this.socket.on('stt:speech-end', wrapped);
    return () => this.socket.off('stt:speech-end', wrapped);
  }

  onSttError(handler: (code: string, message: string, fatal: boolean) => void): Unsubscribe {
    const wrapped = (payload: { code: string; message: string; fatal: boolean }) =>
      handler(payload.code, payload.message, payload.fatal);
    this.socket.on('stt:error', wrapped);
    return () => this.socket.off('stt:error', wrapped);
  }

  onSttStopped(handler: () => void): Unsubscribe {
    this.socket.on('stt:stopped', handler);
    return () => this.socket.off('stt:stopped', handler);
  }
}
