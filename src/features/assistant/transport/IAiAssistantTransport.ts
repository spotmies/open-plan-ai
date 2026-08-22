import type { AskUserQuestion, AssistantCard, AssistantProposalEvent, AssistantProposalUpdateEvent } from '../assistantData';

export type Unsubscribe = () => void;

// Deliberately smaller than IChatTransport (chat/transport/IChatTransport.ts):
// no typing/reactions/pins/calls, and only ever one active conversation room
// at a time (the assistant page shows one conversation, not a list of many
// simultaneously live ones), so events aren't filtered by conversationId the
// way chat's are — the room membership itself is the filter.
export interface IAiAssistantTransport {
  connect(): void;
  disconnect(): void;

  joinConversation(conversationId: string): void;
  leaveConversation(conversationId: string): void;

  onToken(handler: (token: string) => void): Unsubscribe;
  onToolCall(handler: (tool: string) => void): Unsubscribe;
  onToolResult(handler: (tool: string, summary: string) => void): Unsubscribe;
  onQuestion(handler: (questions: AskUserQuestion[]) => void): Unsubscribe;
  onCard(handler: (card: AssistantCard) => void): Unsubscribe;
  // Act (phase 2) — a new pending confirmation card, and any later status
  // change to one (confirmed/rejected/expired/superseded/executed). Both are
  // optimizations only: the conversation-detail REST fetch already returns
  // every proposal (I15), so a handler here just triggers a refetch rather
  // than being the source of truth for proposal state.
  onProposal(handler: (proposal: AssistantProposalEvent) => void): Unsubscribe;
  onProposalUpdate(handler: (update: AssistantProposalUpdateEvent) => void): Unsubscribe;
  onDone(handler: (messageId: string) => void): Unsubscribe;
  onStopped(handler: (messageId: string | null) => void): Unsubscribe;
  onError(handler: (code: string, message: string) => void): Unsubscribe;

  // ─── Voice dictation (Sarvam realtime STT) ───────────────────────────────
  // Per-socket, not conversation-room-scoped — dictation happens in the
  // composer before a conversation may even exist yet, and every event here
  // is implicitly addressed to "whichever socket sent it" (like call:*
  // signaling), so there's no join/leave pair the way conversations have.
  startDictation(options?: { language?: string }): void;
  sendAudioChunk(chunk: ArrayBuffer): void;
  stopDictation(): void;

  onSttReady(handler: () => void): Unsubscribe;
  onSttPartial(handler: (text: string, utteranceIdx: number) => void): Unsubscribe;
  onSttFinal(handler: (text: string, utteranceIdx: number) => void): Unsubscribe;
  onSttSpeechStart(handler: (utteranceIdx: number) => void): Unsubscribe;
  onSttSpeechEnd(handler: (utteranceIdx: number) => void): Unsubscribe;
  onSttError(handler: (code: string, message: string, fatal: boolean) => void): Unsubscribe;
  onSttStopped(handler: () => void): Unsubscribe;
}
