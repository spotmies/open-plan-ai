export interface CallCardFinalizedPayload {
  conversationId: string;
  messageId: string;
  content: string;
}

type Listener = (payload: CallCardFinalizedPayload) => void;

/**
 * finalizeCallCard edits the message via a plain REST call, not a socket
 * emit, so there's no guarantee the editor's own client ever receives a
 * 'message-updated' echo for it (the same reason Chat.tsx's handleEditMessage
 * forces a refetch after a normal edit). This lets useMessages patch its
 * local state immediately, the same way it already reacts to a real
 * 'message-updated' socket event, without needing a hook-level callback
 * threaded through from outside React.
 */
const listeners = new Set<Listener>();

export function onCallCardFinalized(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitCallCardFinalized(payload: CallCardFinalizedPayload): void {
  listeners.forEach((listener) => listener(payload));
}
