export type Unsubscribe = () => void;

export interface CallInvitePayload {
  callId: string;
  conversationId: string;
  callType: 'audio' | 'video';
  meetingUri: string;
}

export interface CallActionPayload {
  callId: string;
  conversationId: string;
}

export interface IncomingCallEvent {
  callId: string;
  conversationId: string;
  callType: 'audio' | 'video';
  meetingUri: string;
  fromUserId: string;
  fromUserName: string;
  participantIds: string[];
}

export interface CallStatusEvent {
  callId: string;
  byUserId: string;
  byUserName?: string;
}

export interface IChatTransport {
  subscribeToMessages(
    conversationId: string,
    onInsert: (message: unknown) => void
  ): Unsubscribe;

  subscribeToMessageUpdates(
    conversationId: string,
    onUpdate: (message: unknown) => void
  ): Unsubscribe;

  subscribeToConversationUpdates(
    conversationIds: string[],
    onUpdate: (payload: unknown) => void
  ): Unsubscribe;

  broadcastTyping(conversationId: string, userId: string): void;

  subscribeToTyping(
    conversationId: string,
    onTyping: (userId: string) => void
  ): Unsubscribe;

  subscribeToReadReceipts(
    conversationId: string,
    onInsert: (payload: unknown) => void
  ): Unsubscribe;

  subscribeToMemberUpdates(
    conversationId: string | null,
    onUpdate: (payload: unknown) => void
  ): Unsubscribe;

  subscribeToReactionUpdates(
    conversationId: string,
    onUpdate: (payload: {
      messageId: string;
      conversationId: string;
      reactions: Array<{ emoji: string; count: number; userIds: string[] }>;
    }) => void
  ): Unsubscribe;

  subscribeToPinUpdates(
    conversationId: string,
    onPinned: (payload: { conversationId: string; message: unknown }) => void,
    onUnpinned: (payload: { conversationId: string; messageId: string }) => void
  ): Unsubscribe;

  unsubscribe(channel: Unsubscribe): void;

  connect(): void;

  disconnect(): void;

  // ─── Call signaling ───────────────────────────────────────────────────────

  emitCallInvite(payload: CallInvitePayload): void;

  emitCallAccept(payload: CallActionPayload): void;

  emitCallDecline(payload: CallActionPayload): void;

  emitCallEnd(payload: CallActionPayload): void;

  subscribeToIncomingCalls(onIncoming: (event: IncomingCallEvent) => void): Unsubscribe;

  subscribeToCallAccepted(onAccepted: (event: CallStatusEvent) => void): Unsubscribe;

  subscribeToCallDeclined(onDeclined: (event: CallStatusEvent) => void): Unsubscribe;

  subscribeToCallEnded(onEnded: (event: CallStatusEvent) => void): Unsubscribe;

  /** Fired instead of `call:ended` when a 3+ person group call loses one participant but stays active for the rest. */
  subscribeToCallParticipantLeft(onLeft: (event: CallStatusEvent) => void): Unsubscribe;
}
