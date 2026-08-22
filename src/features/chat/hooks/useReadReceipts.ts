import { useState, useEffect, useRef, useMemo } from 'react';
import { chatService } from '@/services/chat.service';
import { chatTransport } from '../transport';
import type { ChatMessage, ConversationMember, ReadReceipt } from '../types';
import type { Unsubscribe } from '../transport/IChatTransport';
import { logger } from '@/services/monitoring/logger';

/**
 * Derives per-message read ("blue tick") state from each member's
 * conversation-level lastReadAt, rather than per-message receipts — the
 * backend only tracks one read marker per member per conversation.
 */
export function useReadReceipts(
  conversationId: string | null | undefined,
  messages: ChatMessage[],
  currentUserId: string | undefined,
  members: ConversationMember[] = []
) {
  const [memberLastReadAt, setMemberLastReadAt] = useState<Record<string, string>>({});
  const channelRef = useRef<Unsubscribe | null>(null);

  // Stable primitive key to avoid infinite useEffect loops when members array reference changes
  const membersKey = (members || []).map((m) => `${m.id}:${m.lastReadAt ?? ''}`).join('|');

  // Seed from the conversation's member list whenever it changes (e.g. on conversation switch).
  useEffect(() => {
    const seed: Record<string, string> = {};
    for (const m of members || []) {
      if (m.lastReadAt) seed[m.id] = m.lastReadAt;
    }
    setMemberLastReadAt((prev) => {
      const prevKeys = Object.keys(prev);
      const seedKeys = Object.keys(seed);
      if (
        prevKeys.length === seedKeys.length &&
        seedKeys.every((k) => prev[k] === seed[k])
      ) {
        return prev;
      }
      return seed;
    });
  }, [membersKey]);

  // Mark the conversation as read whenever it's opened or new messages arrive.
  useEffect(() => {
    if (!conversationId || !messages.length) return;
    chatService.markConversationAsRead(conversationId).catch((err) => {
      logger.error('[ReadReceipts] markConversationAsRead failed:', err);
    });
  }, [conversationId, messages.length]);

  // Realtime: other members' read markers as they mark the conversation read.
  useEffect(() => {
    if (!conversationId) return;

    if (channelRef.current) {
      chatTransport.unsubscribe(channelRef.current);
      channelRef.current = null;
    }

    channelRef.current = chatTransport.subscribeToReadReceipts(conversationId, (payload) => {
      const p = payload as { conversationId: string; userId: string; lastReadAt: string };
      if (!p?.userId || p.userId === currentUserId) return;
      setMemberLastReadAt((prev) => ({ ...prev, [p.userId]: p.lastReadAt }));
    });

    return () => {
      if (channelRef.current) {
        chatTransport.unsubscribe(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, currentUserId]);

  const readReceiptMap = useMemo(() => {
    const map: Record<string, ReadReceipt[]> = {};
    for (const msg of messages) {
      const msgTime = new Date(msg.createdAt).getTime();
      const receipts: ReadReceipt[] = [];
      for (const [userId, lastReadAt] of Object.entries(memberLastReadAt)) {
        if (userId === currentUserId) continue;
        if (new Date(lastReadAt).getTime() >= msgTime) {
          receipts.push({ messageId: msg.id, userId, readAt: lastReadAt });
        }
      }
      if (receipts.length) map[msg.id] = receipts;
    }
    return map;
  }, [messages, memberLastReadAt, currentUserId]);

  return { readReceiptMap };
}
