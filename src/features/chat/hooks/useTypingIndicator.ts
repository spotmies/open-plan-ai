import { useState, useEffect, useRef, useCallback } from 'react';
import { chatTransport } from '../transport';
import type { ConversationMember } from '../types';
import type { Unsubscribe } from '../transport/IChatTransport';

export function useTypingIndicator(
  conversationId: string | null | undefined,
  members: ConversationMember[] | undefined,
  currentUserId: string | undefined
) {
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const channelRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    channelRef.current = chatTransport.subscribeToTyping(conversationId, (userId) => {
      if (userId === currentUserId) return;

      setTypingUserIds((prev) => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });

      // Clear previous timer
      const existing = timersRef.current.get(userId);
      if (existing) clearTimeout(existing);

      // Set expiry timer
      const timer = setTimeout(() => {
        setTypingUserIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
        timersRef.current.delete(userId);
      }, 3000);

      timersRef.current.set(userId, timer);
    });

    return () => {
      if (channelRef.current) chatTransport.unsubscribe(channelRef.current);
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
      setTypingUserIds(new Set());
    };
  }, [conversationId, currentUserId]);

  const typingNames = Array.from(typingUserIds)
    .map((id) => members?.find((m) => m.id === id)?.name)
    .filter(Boolean) as string[];

  const broadcastTyping = useCallback(() => {
    if (conversationId && currentUserId) {
      chatTransport.broadcastTyping(conversationId, currentUserId);
    }
  }, [conversationId, currentUserId]);

  return { typingNames, broadcastTyping };
}
