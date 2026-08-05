import { io, Socket } from 'socket.io-client';
import { config } from '@/config';
import type {
  IChatTransport,
  Unsubscribe,
  CallInvitePayload,
  CallActionPayload,
  IncomingCallEvent,
  CallStatusEvent,
} from './IChatTransport';
import { logger } from '@/services/monitoring/logger';
import { refreshAccessToken, AUTH_TOKEN_REFRESHED_EVENT } from '@/services/api/client';

// The accessToken cookie this socket authenticates with at handshake time is
// short-lived (~15 min) and never re-checked once connected. If the socket
// drops for any reason (network blip, backgrounded tab, server restart) after
// that cookie has expired, every automatic reconnection attempt fails
// identically forever — refresh normally only happens reactively, when a REST
// call gets a 401, and nothing was tying that back to this socket. Cap how
// often a connect failure is allowed to trigger its own refresh so a truly
// dead session (refresh token also expired) doesn't hammer the endpoint.
const CONNECT_ERROR_REFRESH_COOLDOWN_MS = 10_000;

export class SocketIOChatTransport implements IChatTransport {
  private socket: Socket;
  private activeRooms = new Set<string>();
  private roomRefCounts = new Map<string, number>();
  private refreshInFlight = false;
  private lastConnectErrorRefreshAt = 0;

  constructor() {
    this.socket = io(config.api.wsUrl, {
      // Auth is via the httpOnly accessToken cookie — withCredentials makes the
      // browser send it on the WS handshake, where the server reads it.
      withCredentials: true,
      transports: ['websocket', 'polling'],
      // Connection is deferred until we know the auth cookie is actually set
      // (see connect()). Connecting eagerly at module-load time races the
      // AuthProvider bootstrap: on a fresh login the socket would handshake
      // before the cookie exists, register with the server as unauthenticated,
      // and never re-register — leaving this user's presence permanently
      // wrong for everyone else until a full page reload re-created the
      // singleton after the cookie was already present.
      autoConnect: false,
    });

    this.socket.on('connect_error', (err) => {
      logger.warn('[SocketIOChatTransport] connect error', { message: err.message });
      this.tryRefreshAndReconnect();
    });

    // A REST call elsewhere (or the refresh triggered above) may have just
    // rotated the accessToken cookie — retry immediately rather than waiting
    // out socket.io's own backoff with a cookie it hasn't re-read yet.
    window.addEventListener(AUTH_TOKEN_REFRESHED_EVENT, () => this.connect());

    // Re-join all tracked rooms after every (re)connect
    this.socket.on('connect', () => {
      this.activeRooms.forEach((id) => {
        this.socket.emit('join-conversation', id);
      });
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

  private joinRoom(conversationId: string) {
    const count = (this.roomRefCounts.get(conversationId) || 0) + 1;
    this.roomRefCounts.set(conversationId, count);
    this.activeRooms.add(conversationId);
    if (count === 1) {
      this.socket.emit('join-conversation', conversationId);
    }
  }

  private leaveRoom(conversationId: string) {
    const count = Math.max(0, (this.roomRefCounts.get(conversationId) || 0) - 1);
    this.roomRefCounts.set(conversationId, count);
    if (count === 0) {
      this.activeRooms.delete(conversationId);
      this.socket.emit('leave-conversation', conversationId);
    }
  }

  subscribeToMessages(
    conversationId: string,
    onInsert: (message: unknown) => void
  ): Unsubscribe {
    this.joinRoom(conversationId);
    // Filter by conversationId — the socket may be in multiple rooms
    const handler = (msg: unknown) => {
      if ((msg as any)?.conversationId !== conversationId) return;
      onInsert(msg);
    };
    this.socket.on('new-message', handler);
    return () => {
      this.socket.off('new-message', handler);
      this.leaveRoom(conversationId);
    };
  }

  subscribeToMessageUpdates(
    conversationId: string,
    onUpdate: (message: unknown) => void
  ): Unsubscribe {
    this.joinRoom(conversationId);
    const handler = (msg: unknown) => {
      if ((msg as any)?.conversationId !== conversationId) return;
      onUpdate(msg);
    };
    this.socket.on('message-updated', handler);
    return () => {
      this.socket.off('message-updated', handler);
    };
  }

  subscribeToConversationUpdates(
    _conversationIds: string[],
    onUpdate: (payload: unknown) => void
  ): Unsubscribe {
    const handler = (payload: unknown) => onUpdate(payload);
    this.socket.on('conversation-updated', handler);
    return () => {
      this.socket.off('conversation-updated', handler);
    };
  }

  broadcastTyping(conversationId: string, userId: string): void {
    this.socket.emit('typing', { conversationId, userId });
  }

  subscribeToTyping(
    conversationId: string,
    onTyping: (userId: string) => void
  ): Unsubscribe {
    const handler = ({
      userId,
      conversationId: convId,
    }: {
      userId: string;
      conversationId: string;
    }) => {
      if (convId === conversationId) onTyping(userId);
    };
    this.socket.on('user-typing', handler);
    return () => {
      this.socket.off('user-typing', handler);
    };
  }

  subscribeToReadReceipts(
    conversationId: string,
    onInsert: (payload: unknown) => void
  ): Unsubscribe {
    const handler = (payload: unknown) => {
      if ((payload as any)?.conversationId !== conversationId) return;
      onInsert(payload);
    };
    this.socket.on('message-read', handler);
    return () => {
      this.socket.off('message-read', handler);
    };
  }

  subscribeToMemberUpdates(
    _conversationId: string | null,
    onUpdate: (payload: unknown) => void
  ): Unsubscribe {
    const handler = (payload: unknown) => onUpdate(payload);
    this.socket.on('member-updated', handler);
    return () => {
      this.socket.off('member-updated', handler);
    };
  }

  subscribeToReactionUpdates(
    conversationId: string,
    onUpdate: (payload: {
      messageId: string;
      conversationId: string;
      reactions: Array<{ emoji: string; count: number; userIds: string[] }>;
    }) => void
  ): Unsubscribe {
    const handler = (payload: unknown) => {
      const p = payload as { messageId: string; conversationId: string; reactions: Array<{ emoji: string; count: number; userIds: string[] }> };
      if (p?.conversationId !== conversationId) return;
      onUpdate(p);
    };
    this.socket.on('reaction-updated', handler);
    return () => { this.socket.off('reaction-updated', handler); };
  }

  subscribeToPinUpdates(
    conversationId: string,
    onPinned: (payload: { conversationId: string; message: unknown }) => void,
    onUnpinned: (payload: { conversationId: string; messageId: string }) => void
  ): Unsubscribe {
    const pinnedHandler = (payload: unknown) => {
      const p = payload as { conversationId: string; message: unknown };
      if (p?.conversationId !== conversationId) return;
      onPinned(p);
    };
    const unpinnedHandler = (payload: unknown) => {
      const p = payload as { conversationId: string; messageId: string };
      if (p?.conversationId !== conversationId) return;
      onUnpinned(p);
    };
    this.socket.on('message-pinned', pinnedHandler);
    this.socket.on('message-unpinned', unpinnedHandler);
    return () => {
      this.socket.off('message-pinned', pinnedHandler);
      this.socket.off('message-unpinned', unpinnedHandler);
    };
  }

  unsubscribe(unsub: Unsubscribe): void {
    unsub();
  }

  // Idempotent — safe to call whenever the caller learns the user is
  // authenticated, even if already connected/connecting.
  connect(): void {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  // ─── Call signaling ───────────────────────────────────────────────────────

  emitCallInvite(payload: CallInvitePayload): void {
    this.socket.emit('call:invite', payload);
  }

  emitCallAccept(payload: CallActionPayload): void {
    this.socket.emit('call:accept', payload);
  }

  emitCallDecline(payload: CallActionPayload): void {
    this.socket.emit('call:decline', payload);
  }

  emitCallEnd(payload: CallActionPayload): void {
    this.socket.emit('call:end', payload);
  }

  subscribeToIncomingCalls(onIncoming: (event: IncomingCallEvent) => void): Unsubscribe {
    const handler = (event: IncomingCallEvent) => onIncoming(event);
    this.socket.on('call:incoming', handler);
    return () => this.socket.off('call:incoming', handler);
  }

  subscribeToCallAccepted(onAccepted: (event: CallStatusEvent) => void): Unsubscribe {
    const handler = (event: CallStatusEvent) => onAccepted(event);
    this.socket.on('call:accepted', handler);
    return () => this.socket.off('call:accepted', handler);
  }

  subscribeToCallDeclined(onDeclined: (event: CallStatusEvent) => void): Unsubscribe {
    const handler = (event: CallStatusEvent) => onDeclined(event);
    this.socket.on('call:declined', handler);
    return () => this.socket.off('call:declined', handler);
  }

  subscribeToCallEnded(onEnded: (event: CallStatusEvent) => void): Unsubscribe {
    const handler = (event: CallStatusEvent) => onEnded(event);
    this.socket.on('call:ended', handler);
    return () => this.socket.off('call:ended', handler);
  }

  subscribeToCallParticipantLeft(onLeft: (event: CallStatusEvent) => void): Unsubscribe {
    const handler = (event: CallStatusEvent) => onLeft(event);
    this.socket.on('call:participant_left', handler);
    return () => this.socket.off('call:participant_left', handler);
  }
}
