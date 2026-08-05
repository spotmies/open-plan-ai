import type { AskUserQuestion, AssistantCard } from '../assistantData';

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
  onDone(handler: (messageId: string) => void): Unsubscribe;
  onStopped(handler: (messageId: string | null) => void): Unsubscribe;
  onError(handler: (code: string, message: string) => void): Unsubscribe;
}
