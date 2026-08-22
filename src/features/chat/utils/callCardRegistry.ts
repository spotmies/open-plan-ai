import { chatService } from '@/services/chat.service';
import { logger } from '@/services/monitoring/logger';
import { buildCallCardContent, CallCardStatus } from './callCard';
import { emitCallCardFinalized } from './callCardEvents';

interface RegistryEntry {
  conversationId: string;
  callType: 'audio' | 'video';
  isGroup: boolean;
  initiatorId: string;
  initiatorName: string;
  messageId: string;
  /** Wall-clock ms when the call first became active (someone joined) — null while still ringing. */
  activeAt: number | null;
}

/**
 * Tracks call-history card messages created by the current user as a call's
 * initiator, keyed by callId, independent of useCallStore — which resets on
 * every hangup. A group call can outlive the initiator's own participation
 * (they leave, others keep talking), so the card can only be finalized once
 * the call has truly ended for everyone, which may arrive well after this
 * client's own local call state has already reset.
 */
const registry = new Map<string, RegistryEntry>();

export function registerCallCard(callId: string, entry: RegistryEntry): void {
  registry.set(callId, entry);
}

/** Marks the call as having connected at least once — first join sets the talk-time clock; later joins/rejoins no-op. */
export function markCallCardActive(callId: string): void {
  const entry = registry.get(callId);
  if (entry && entry.activeAt == null) {
    entry.activeAt = Date.now();
  }
}

/**
 * Rewrites the call's card message to its terminal state (completed with
 * duration, or missed) and forgets the entry. Safe to call more than once
 * or from a client that never registered this callId — both are no-ops
 * past the first successful finalize.
 */
export async function finalizeCallCard(callId: string): Promise<void> {
  const entry = registry.get(callId);
  if (!entry) return;
  registry.delete(callId);

  const durationSec = entry.activeAt ? Math.max(0, Math.round((Date.now() - entry.activeAt) / 1000)) : 0;
  const status: CallCardStatus = entry.activeAt ? 'completed' : 'missed';

  const content = buildCallCardContent({
    kind: 'call-card',
    callId,
    callType: entry.callType,
    isGroup: entry.isGroup,
    status,
    durationSec,
    initiatorId: entry.initiatorId,
    initiatorName: entry.initiatorName,
  });

  try {
    await chatService.editMessage(entry.messageId, content);
    // The editor's own client isn't guaranteed to receive a 'message-updated'
    // socket echo for its own edit (same reason Chat.tsx's handleEditMessage
    // forces a refetch) — patch local state directly instead of waiting for one.
    emitCallCardFinalized({ conversationId: entry.conversationId, messageId: entry.messageId, content });
  } catch (err) {
    logger.error('Failed to finalize call-history card:', err);
  }
}
