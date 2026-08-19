import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { chatService, CHAT_ACCESS_INVALIDATE_EVENT } from '@/services/chat.service';
import { toast } from 'sonner';
import { chatTransport } from '../transport';
import { mapMessage, entityTagsPreviewText } from '../chat.mappers';
import { useChatStore } from '../stores/useChatStore';
import type { Conversation, ChatMessage, MessageReaction, EntityTagRef, PinnedMessage, FavouriteMessage } from '../types';
import type { Unsubscribe } from '../transport/IChatTransport';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/services/monitoring/logger';
import { onCallCardFinalized } from '../utils/callCardEvents';

type ConversationAccessState = { readOnly: boolean; leftAt: string | null; joinedAt: string | null };

/** Transient errors/timeouts use readOnly + leftAt null; do not cache those so we retry on next open. */
function shouldCacheAccessState(state: ConversationAccessState): boolean {
  return !(state.readOnly && state.leftAt === null);
}

function readOnlyNoticeFromState(state: ConversationAccessState): string | null {
  if (!state.readOnly) return null;
  return state.leftAt
    ? 'You have been removed from this project. You can view previous messages, but you cannot send new ones in this group.'
    : 'Unable to verify your access right now. This may be temporary; messages may be read-only until verification succeeds.';
}

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
};

/**
 * Stale-while-revalidate hook for conversations.
 */
export function useConversations() {
  const conversations = useChatStore((s) => s.conversations);
  const setConversations = useChatStore((s) => s.setConversations);
  const isConversationsStale = useChatStore((s) => s.isConversationsStale);

  const hasCachedData = conversations.length > 0;
  const [loading, setLoading] = useState(!hasCachedData);
  const isMountedRef = useRef(true);

  const fetchConversations = useCallback(async (background = false) => {
    try {
      if (!background) setLoading(true);
      const data = await chatService.getConversations();
      if (isMountedRef.current) {
        setConversations(data);
        useChatStore.getState().hydrateUnreadCounts(data);
      }
    } catch (err) {
      logger.error('Failed to fetch conversations:', err);
    } finally {
      if (isMountedRef.current && !background) setLoading(false);
    }
  }, [setConversations]);

  useEffect(() => {
    isMountedRef.current = true;
    if (hasCachedData) {
      setLoading(false);
      if (isConversationsStale()) fetchConversations(true);
    } else {
      fetchConversations(false);
    }
    return () => { isMountedRef.current = false; };
  }, []);

  // Real-time subscriptions (new-message unread tracking, toasts, conversation/member
  // updates) are handled once app-wide by ChatNotificationsProvider — this hook only
  // reads the resulting store state so it stays in sync wherever it's used.

  const toggleConversationFavourite = useCallback(async (conversationId: string) => {
    const current = useChatStore.getState().conversations;
    const wasFavourite = current.find((c) => c.id === conversationId)?.isFavourite ?? false;
    setConversations(current.map((c) => (c.id === conversationId ? { ...c, isFavourite: !wasFavourite } : c)));
    try {
      await chatService.toggleConversationFavourite(conversationId);
    } catch (err) {
      logger.error('Failed to toggle chat favourite:', err);
      toast.error('Failed to update favourite');
      const reverted = useChatStore.getState().conversations;
      setConversations(reverted.map((c) => (c.id === conversationId ? { ...c, isFavourite: wasFavourite } : c)));
    }
  }, [setConversations]);

  const hideConversation = useCallback(async (conversationId: string) => {
    const previous = useChatStore.getState().conversations;
    setConversations(previous.filter((c) => c.id !== conversationId));
    try {
      await chatService.hideConversation(conversationId);
    } catch (err) {
      logger.error('Failed to delete chat:', err);
      toast.error('Failed to delete chat');
      setConversations(previous);
    }
  }, [setConversations]);

  const toggleMute = useCallback(async (conversationId: string, userId: string) => {
    const conv = useChatStore.getState().conversations.find((c) => c.id === conversationId);
    const wasEnabled = conv?.members.find((m) => m.id === userId)?.notificationsEnabled ?? true;
    const applyLocal = (enabled: boolean) => {
      const latest = useChatStore.getState().conversations;
      setConversations(latest.map((c) => (
        c.id === conversationId
          ? { ...c, members: c.members.map((m) => (m.id === userId ? { ...m, notificationsEnabled: enabled } : m)) }
          : c
      )));
    };
    applyLocal(!wasEnabled);
    try {
      await chatService.updateNotificationSettings(conversationId, !wasEnabled);
    } catch (err) {
      logger.error('Failed to toggle mute:', err);
      toast.error('Failed to update notification settings');
      applyLocal(wasEnabled);
    }
  }, [setConversations]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    useChatStore.getState().markAsRead(conversationId);
    try {
      await chatService.markConversationAsRead(conversationId);
    } catch (err) {
      logger.error('Failed to mark conversation as read:', err);
    }
  }, []);

  return {
    conversations,
    loading,
    refetch: () => fetchConversations(true),
    toggleConversationFavourite,
    hideConversation,
    toggleMute,
    markConversationRead,
  };
}

/**
 * Stale-while-revalidate hook for messages with offline support.
 */
export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const profile = user;
  const {
    getCachedMessages,
    setCachedMessages,
    isMessagesStale,
    addMessage: storeAddMessage,
    updateMessage: storeUpdateMessage,
    resolveOptimisticMessage: storeResolveOptimistic,
    appendOlderMessages: storeAppendOlder,
    pendingMessages,
    addPendingMessage,
    removePendingMessage,
  } = useChatStore();

  const cached = conversationId ? getCachedMessages(conversationId) : null;
  const hasCachedData = !!cached;

  const [messages, setMessages] = useState<ChatMessage[]>(cached?.messages ?? []);
  const [loading, setLoading] = useState(!hasCachedData && !!conversationId);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const [readOnly, setReadOnly] = useState(false);
  const [readOnlyNotice, setReadOnlyNotice] = useState<string | null>(null);
  const [leftAt, setLeftAt] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const channelRef = useRef<Unsubscribe | null>(null);
  const updateChannelRef = useRef<Unsubscribe | null>(null);
  const PAGE_SIZE = 50;

  const accessStateCacheRef = useRef(new Map<string, { expiresAt: number; state: ConversationAccessState }>());
  const accessCacheTtlMs = Number(import.meta.env.VITE_CHAT_ACCESS_STATE_CACHE_TTL_MS ?? 5000);
  const accessRetryScheduledRef = useRef(new Map<string, boolean>());

  const updatePreview = useCallback((convId: string, lastMsg: any) => {
    const store = useChatStore.getState();
    store.setConversations(
      store.conversations.map(c =>
        c.id === convId ? { ...c, lastMessage: lastMsg, lastMessageAt: lastMsg.createdAt } : c
      )
    );
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setHasMore(true);
      setLoading(false);
      setError(null);
      setReadOnly(false);
      setReadOnlyNotice(null);
      setLeftAt(null);
      setJoinedAt(null);
      return;
    }
    let cancelled = false;
    setError(null);

    const setFromAccessState = (state: ConversationAccessState) => {
      if (cancelled) return;
      setReadOnly(state.readOnly);
      setLeftAt(state.leftAt);
      setJoinedAt(state.joinedAt);
      setReadOnlyNotice(readOnlyNoticeFromState(state));

      // If we got an "unverified" fallback, schedule a single retry (temporary nature).
      if (state.readOnly && state.leftAt === null) {
        const alreadyScheduled = accessRetryScheduledRef.current.get(conversationId) ?? false;
        if (!alreadyScheduled) {
          accessRetryScheduledRef.current.set(conversationId, true);
          window.setTimeout(() => {
            if (cancelled) return;
            chatService
              .getConversationAccessState(conversationId)
              .then((retryState) => {
                if (cancelled) return;
                if (shouldCacheAccessState(retryState)) {
                  accessStateCacheRef.current.set(conversationId, {
                    expiresAt: Date.now() + accessCacheTtlMs,
                    state: retryState,
                  });
                }
                setFromAccessState(retryState);
              })
              .catch(() => {
                // Keep the existing read-only fallback.
              })
              .finally(() => {
                accessRetryScheduledRef.current.set(conversationId, false);
              });
          }, 1000);
        }
      }
    };

    const cachedAccess = accessStateCacheRef.current.get(conversationId);
    const now = Date.now();
    let usedCachedAccess = false;
    if (cachedAccess && cachedAccess.expiresAt > now && shouldCacheAccessState(cachedAccess.state)) {
      setFromAccessState(cachedAccess.state);
      usedCachedAccess = true;
    } else if (cachedAccess && !shouldCacheAccessState(cachedAccess.state)) {
      accessStateCacheRef.current.delete(conversationId);
    }

    if (!usedCachedAccess) {
      chatService
        .getConversationAccessState(conversationId)
        .then((state) => {
          if (cancelled) return;
          if (shouldCacheAccessState(state)) {
            accessStateCacheRef.current.set(conversationId, {
              expiresAt: Date.now() + accessCacheTtlMs,
              state,
            });
          }
          setFromAccessState(state);
        })
        .catch(() => {
          if (cancelled) return;
          const fallbackState: ConversationAccessState = { readOnly: true, leftAt: null, joinedAt: null };
          setFromAccessState(fallbackState);
        });
    }

    const cachedEntry = getCachedMessages(conversationId);
    if (cachedEntry) {
      setMessages(cachedEntry.messages);
      setHasMore(cachedEntry.hasMore);
      setLoading(false);
      if (isMessagesStale(conversationId)) {
        chatService
          .getMessages(conversationId, { limit: PAGE_SIZE })
          .then((data) => {
            if (cancelled) return;
            setMessages(data);
            setHasMore(data.length === PAGE_SIZE);
            setCachedMessages(conversationId, data, data.length === PAGE_SIZE);
          })
          .catch((err) => {
            if (!cancelled) logger.error('Background message revalidation failed:', err);
          });
      }
    } else {
      setLoading(true);
      chatService
        .getMessages(conversationId, { limit: PAGE_SIZE })
        .then((data) => {
          if (cancelled) return;
          setMessages(data);
          setHasMore(data.length === PAGE_SIZE);
          setLoading(false);
          setCachedMessages(conversationId, data, data.length === PAGE_SIZE);
        })
        .catch((err) => {
          logger.error('Failed to fetch messages:', err);
          if (!cancelled) {
            setLoading(false);
            setError('Failed to load messages. Please try again.');
          }
        });
    }

    return () => {
      cancelled = true;
      accessRetryScheduledRef.current.delete(conversationId);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const onInvalidate = (e: Event) => {
      const detail = (e as CustomEvent<{ conversationId?: string }>).detail;
      if (detail?.conversationId !== conversationId) return;

      accessStateCacheRef.current.delete(conversationId);
      accessRetryScheduledRef.current.delete(conversationId);

      chatService
        .getConversationAccessState(conversationId)
        .then((state) => {
          if (shouldCacheAccessState(state)) {
            accessStateCacheRef.current.set(conversationId, {
              expiresAt: Date.now() + accessCacheTtlMs,
              state,
            });
          }
          setReadOnly(state.readOnly);
          setLeftAt(state.leftAt);
          setJoinedAt(state.joinedAt);
          setReadOnlyNotice(readOnlyNoticeFromState(state));
        })
        .catch(() => {
          const fallbackState: ConversationAccessState = { readOnly: true, leftAt: null, joinedAt: null };
          setReadOnly(fallbackState.readOnly);
          setLeftAt(fallbackState.leftAt);
          setJoinedAt(fallbackState.joinedAt);
          setReadOnlyNotice(readOnlyNoticeFromState(fallbackState));
        });
    };

    window.addEventListener(CHAT_ACCESS_INVALIDATE_EVENT, onInvalidate);
    return () => window.removeEventListener(CHAT_ACCESS_INVALIDATE_EVENT, onInvalidate);
  }, [conversationId, accessCacheTtlMs]);

  useEffect(() => {
    if (!conversationId) return;
    channelRef.current = chatTransport.subscribeToMessages(
      conversationId,
      async (payload) => {
        // SocketIO backend sends MessageResponse directly;
        // Supabase sent { new: row }. Handle both shapes.
        const raw = payload as any;
        const newMsg = raw?.new ?? raw;
        const msgCreatedAt = newMsg?.createdAt ?? newMsg?.created_at;
        const newMsgCreatedAtTs = msgCreatedAt ? new Date(msgCreatedAt).getTime() : NaN;
        const leftAtTs = leftAt ? new Date(leftAt).getTime() : NaN;

        if (Number.isFinite(leftAtTs) && Number.isFinite(newMsgCreatedAtTs) && newMsgCreatedAtTs > leftAtTs) return;
        const joinedAtTs = joinedAt ? new Date(joinedAt).getTime() : NaN;
        if (Number.isFinite(joinedAtTs) && Number.isFinite(newMsgCreatedAtTs) && newMsgCreatedAtTs < joinedAtTs) return;

        const mapped = mapMessage(newMsg as any, null);
        setMessages((prev) => {
          if (prev.some((m) => m.id === mapped.id)) return prev;
          return [...prev, mapped];
        });
        storeAddMessage(conversationId, mapped);
        updatePreview(conversationId, {
          content: mapped.content?.trim() ? mapped.content : entityTagsPreviewText(mapped.entityTags),
          senderName: mapped.senderName,
          createdAt: mapped.createdAt,
        });
      }
    );
    return () => { if (channelRef.current) chatTransport.unsubscribe(channelRef.current); };
  }, [conversationId, storeAddMessage, updatePreview, leftAt, joinedAt]);

  const sendMessage = useCallback(async (content: string, type: 'text' | 'file' = 'text', fileData?: any, replyToMessageId?: string, entityTags?: EntityTagRef[]) => {
    if (!conversationId || !user) return;

    const tempId = `temp-${generateId()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId,
      senderId: user.id,
      senderName: profile?.name || 'You',
      senderInitials: profile?.initials || 'Y',
      contentType: type,
      content: type === 'file' ? JSON.stringify(fileData) : content,
      attachments: [],
      entityTags,
      createdAt: new Date().toISOString(),
      isEdited: false,
      isOptimistic: true,
      status: 'sending',
      replyToMessageId,
    };

    // 1. Add optimistically to local state and store
    setMessages((prev) => [...prev, optimisticMsg]);
    storeAddMessage(conversationId, optimisticMsg);

    const markAsPending = () => {
      const pendingMsg = { ...optimisticMsg, status: 'pending' as const };
      setMessages((prev) => prev.map(m => m.id === tempId ? pendingMsg : m));
      storeUpdateMessage(conversationId, tempId, () => pendingMsg);
      addPendingMessage(pendingMsg);
      updatePreview(conversationId, {
        content: pendingMsg.content?.trim() ? pendingMsg.content : entityTagsPreviewText(pendingMsg.entityTags),
        senderName: pendingMsg.senderName,
        createdAt: pendingMsg.createdAt,
        status: 'pending'
      });
    };

    // Check immediate offline
    if (!navigator.onLine) {
      markAsPending();
      return;
    }

    try {
      let realMsg: ChatMessage;
      realMsg = await chatService.sendMessage(conversationId, content, undefined, replyToMessageId, entityTags);
      realMsg.status = 'sent';
      setMessages((prev) => {
        // If the real message was already added by realtime, just remove the temp one
        if (prev.some((m) => m.id === realMsg.id)) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? realMsg : m));
      });
      storeResolveOptimistic(conversationId, tempId, realMsg);
      removePendingMessage(tempId);
    } catch (err) {
      logger.error('Failed to send message:', err);
      const isNetworkError = !navigator.onLine ||
        err.name === 'TypeError' ||
        err.message?.toLowerCase().includes('fetch') ||
        err.message?.toLowerCase().includes('network');

      if (isNetworkError) {
        markAsPending();
        // Do NOT re-throw, as we handled it by showing it as pending
        return;
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast.error('Failed to send message');
        throw err;
      }
    }
  }, [conversationId, user, profile, storeAddMessage, storeResolveOptimistic, storeUpdateMessage, addPendingMessage, removePendingMessage, updatePreview]);

  useEffect(() => {
    if (!conversationId) return;
    const handleOnline = async () => {
      const allPending = useChatStore.getState().pendingMessages;
      if (allPending.length === 0) return;

      toast.info(`Connection restored. Syncing ${allPending.length} pending message(s)...`);

      for (const msg of allPending) {
        try {
          const isCurrentConv = msg.conversationId === conversationId;
          const sendingMsg = { ...msg, status: 'sending' as const };

          if (isCurrentConv) {
            setMessages(prev => prev.map(m => m.id === msg.id ? sendingMsg : m));
          }
          storeUpdateMessage(msg.conversationId, msg.id, () => sendingMsg);

          const realMsg = await chatService.sendMessage(msg.conversationId, msg.content, msg.senderId);
          realMsg.status = 'sent';

          if (isCurrentConv) {
            setMessages(prev => {
              if (prev.some(m => m.id === realMsg.id)) {
                return prev.filter(m => m.id !== msg.id);
              }
              return prev.map(m => m.id === msg.id ? realMsg : m);
            });
          }
          storeResolveOptimistic(msg.conversationId, msg.id, realMsg);
          removePendingMessage(msg.id);
        } catch (err) {
          logger.error('Failed to resend:', err);
          const isStillOffline = !navigator.onLine || err.name === 'TypeError' || err.message?.includes('fetch');
          if (!isStillOffline) {
            // If it's a real server error (e.g. 400), remove it to avoid infinite loops
            removePendingMessage(msg.id);
            if (msg.conversationId === conversationId) {
              setMessages(prev => prev.filter(m => m.id !== msg.id));
            }
          } else {
            // Keep as pending
            const reverted = { ...msg, status: 'pending' as const };
            if (msg.conversationId === conversationId) {
              setMessages(prev => prev.map(m => m.id === msg.id ? reverted : m));
            }
            storeUpdateMessage(msg.conversationId, msg.id, () => reverted);
          }
        }
      }
    };
    window.addEventListener('online', handleOnline);
    if (navigator.onLine) handleOnline();
    return () => window.removeEventListener('online', handleOnline);
  }, [conversationId, pendingMessages, storeUpdateMessage, storeResolveOptimistic, removePendingMessage]);

  useEffect(() => {
    if (!conversationId) return;
    updateChannelRef.current = chatTransport.subscribeToMessageUpdates(
      conversationId,
      (payload) => {
        const raw = payload as any;
        const updatedRow = raw?.new ?? raw;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== updatedRow.id) return m;
            return mapMessage(updatedRow, {
              id: m.senderId,
              name: m.senderName,
              initials: m.senderInitials,
            } as any);
          })
        );
        storeUpdateMessage(conversationId, updatedRow.id, (m) =>
          mapMessage(updatedRow, {
            id: m.senderId,
            name: m.senderName,
            initials: m.senderInitials,
          } as any)
        );
      }
    );
    return () => { if (updateChannelRef.current) chatTransport.unsubscribe(updateChannelRef.current); };
  }, [conversationId, storeUpdateMessage]);

  // A call-history card is finalized via a plain REST edit, not a socket
  // emit, so the editor's own client can't rely on a 'message-updated' echo
  // for it — apply the new content locally the moment the edit succeeds,
  // the same way the socket handler above does for edits made elsewhere.
  useEffect(() => {
    if (!conversationId) return;
    return onCallCardFinalized((payload) => {
      if (payload.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.messageId ? { ...m, content: payload.content } : m))
      );
      storeUpdateMessage(conversationId, payload.messageId, (m) => ({ ...m, content: payload.content }));
    });
  }, [conversationId, storeUpdateMessage]);

  const refetchMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const data = await chatService.getMessages(conversationId, { limit: PAGE_SIZE });
      setMessages(data);
      setHasMore(data.length === PAGE_SIZE);
      setCachedMessages(conversationId, data, data.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      logger.error('Failed to refetch messages:', err);
      setError('Failed to load messages. Please try again.');
    }
  }, [conversationId, setCachedMessages]);

  const loadMore = useCallback(async () => {
    if (!conversationId || !messages.length || !hasMore) return;
    const oldest = messages[0];
    const older = await chatService.getMessages(conversationId, {
      before: oldest.createdAt,
      limit: PAGE_SIZE,
    });
    const newHasMore = older.length === PAGE_SIZE;
    setHasMore(newHasMore);
    setMessages((prev) => [...older, ...prev]);
    storeAppendOlder(conversationId, older, newHasMore);
  }, [conversationId, messages, hasMore, storeAppendOlder]);

  const combinedMessages = useMemo(() => {
    if (!conversationId) return [];
    const convPending = pendingMessages.filter(m => m.conversationId === conversationId);
    const result = [...messages];

    for (const pm of convPending) {
      if (!result.some(m => m.id === pm.id)) {
        result.push(pm);
      }
    }

    return result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, pendingMessages, conversationId]);

  return { messages: combinedMessages, loading, error, hasMore, loadMore, refetchMessages, sendMessage, readOnly, readOnlyNotice };
}

export function useReactions(messages: ChatMessage[], currentUserId?: string, conversationId?: string | null) {
  const [reactionMap, setReactionMap] = useState<Record<string, MessageReaction[]>>({});
  const messagesKey = (messages || []).map((m) => m.id).join(',');

  const fetchReactions = useCallback(async () => {
    if (!messages.length || !currentUserId) return;
    try {
      const ids = messages.map((m) => m.id).filter(id => !id.startsWith('temp-'));
      if (ids.length === 0) { setReactionMap({}); return; }
      const map = await chatService.getReactions(ids, currentUserId);
      setReactionMap(map);
    } catch (err) {
      logger.error('Failed to fetch reactions:', err);
    }
  }, [messagesKey, currentUserId]);

  useEffect(() => { fetchReactions(); }, [fetchReactions]);

  // Real-time: apply the full reaction state pushed by the server — no secondary API call needed
  useEffect(() => {
    if (!conversationId) return;
    const unsub = chatTransport.subscribeToReactionUpdates(
      conversationId,
      ({ messageId, reactions }) => {
        const mapped = reactions.map((r) => ({
          ...r,
          reactedByMe: r.userIds.includes(currentUserId ?? ''),
        }));
        setReactionMap((prev) => ({ ...prev, [messageId]: mapped }));
      },
    );
    return () => unsub();
  }, [conversationId, currentUserId]);

  const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    // 1. Optimistic update — instant feedback for the clicker
    setReactionMap((prev) => {
      const current = prev[messageId] ?? [];
      const existing = current.find((r) => r.emoji === emoji);

      if (existing?.reactedByMe) {
        const newCount = existing.count - 1;
        if (newCount === 0) return { ...prev, [messageId]: current.filter((r) => r.emoji !== emoji) };
        return {
          ...prev,
          [messageId]: current.map((r) =>
            r.emoji === emoji
              ? { ...r, count: newCount, userIds: r.userIds.filter((id) => id !== currentUserId), reactedByMe: false }
              : r,
          ),
        };
      }
      if (existing) {
        return {
          ...prev,
          [messageId]: current.map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.count + 1, userIds: [...r.userIds, currentUserId ?? ''], reactedByMe: true }
              : r,
          ),
        };
      }
      return { ...prev, [messageId]: [...current, { emoji, count: 1, userIds: [currentUserId ?? ''], reactedByMe: true }] };
    });

    try {
      // 2. Persist + trigger socket broadcast to other users
      await chatService.toggleReaction(messageId, emoji);
      // 3. Reconcile with server truth (handles race conditions and socket failures)
      const map = await chatService.getReactions([messageId], currentUserId ?? '');
      setReactionMap((prev) => ({ ...prev, [messageId]: map[messageId] ?? [] }));
    } catch (err) {
      logger.error('Failed to toggle reaction:', err);
      // Revert optimistic update on error
      const map = await chatService.getReactions([messageId], currentUserId ?? '').catch(() => ({}));
      setReactionMap((prev) => ({ ...prev, [messageId]: (map as Record<string, MessageReaction[]>)[messageId] ?? prev[messageId] ?? [] }));
    }
  }, [currentUserId]);

  return { reactionMap, handleToggleReaction };
}

/** Mirrors the backend cap in chat.service.ts (MAX_PINNED_MESSAGES) — checked client-side too, for instant feedback. */
export const MAX_PINNED_MESSAGES = 5;

/**
 * Pinned messages are shared conversation state (every member sees the same
 * pins), so they're kept in a small dedicated list synced over sockets —
 * unlike favourites, which are private per user.
 */
export function usePinnedMessages(conversationId: string | null) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPinned = useCallback(async () => {
    if (!conversationId) { setPinnedMessages([]); return; }
    setLoading(true);
    try {
      const data = await chatService.getPinnedMessages(conversationId);
      setPinnedMessages(data);
    } catch (err) {
      logger.error('Failed to fetch pinned messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { fetchPinned(); }, [fetchPinned]);

  useEffect(() => {
    if (!conversationId) return;
    const unsub = chatTransport.subscribeToPinUpdates(
      conversationId,
      ({ message }) => {
        const raw = message as any;
        const mapped: PinnedMessage = {
          ...mapMessage(raw, null),
          pinnedAt: raw.pinnedAt ?? raw.pinned_at ?? new Date().toISOString(),
          pinnedBy: raw.pinnedBy ?? raw.pinned_by ?? null,
        };
        setPinnedMessages((prev) => (prev.some((m) => m.id === mapped.id) ? prev : [...prev, mapped]));
      },
      ({ messageId }) => {
        setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
      },
    );
    return () => unsub();
  }, [conversationId]);

  const pinMessage = useCallback(async (messageId: string) => {
    if (!conversationId) return;
    if (pinnedMessages.length >= MAX_PINNED_MESSAGES) {
      toast.error(`You can only pin up to ${MAX_PINNED_MESSAGES} messages in this chat. Unpin one first.`);
      return;
    }
    try {
      const pinned = await chatService.pinMessage(conversationId, messageId);
      setPinnedMessages((prev) => (prev.some((m) => m.id === pinned.id) ? prev : [...prev, pinned]));
    } catch (err) {
      logger.error('Failed to pin message:', err);
      toast.error('Failed to pin message');
    }
  }, [conversationId, pinnedMessages.length]);

  const unpinMessage = useCallback(async (messageId: string) => {
    if (!conversationId) return;
    const previous = pinnedMessages;
    setPinnedMessages((prev) => prev.filter((m) => m.id !== messageId));
    try {
      await chatService.unpinMessage(conversationId, messageId);
    } catch (err) {
      logger.error('Failed to unpin message:', err);
      toast.error('Failed to unpin message');
      setPinnedMessages(previous);
    }
  }, [conversationId, pinnedMessages]);

  const pinnedMessageIds = useMemo(() => new Set(pinnedMessages.map((m) => m.id)), [pinnedMessages]);

  return { pinnedMessages, pinnedMessageIds, loading, pinMessage, unpinMessage, refetchPinned: fetchPinned };
}

/**
 * Favourite (starred) messages are private per user — no socket sync needed.
 * The full per-conversation list is fetched eagerly (it's a small, personal
 * dataset); favouriteIds is simply derived from it for badge state on
 * individual message bubbles.
 */
export function useFavouriteMessages(conversationId: string | null) {
  const [favouriteMessages, setFavouriteMessages] = useState<FavouriteMessage[]>([]);
  const [loadingFavourites, setLoadingFavourites] = useState(false);

  const fetchFavouriteMessages = useCallback(async () => {
    if (!conversationId) { setFavouriteMessages([]); return; }
    setLoadingFavourites(true);
    try {
      const data = await chatService.getFavouriteMessages(conversationId);
      setFavouriteMessages(data);
    } catch (err) {
      logger.error('Failed to fetch favourite messages:', err);
    } finally {
      setLoadingFavourites(false);
    }
  }, [conversationId]);

  useEffect(() => { fetchFavouriteMessages(); }, [fetchFavouriteMessages]);

  const toggleFavourite = useCallback(async (message: ChatMessage) => {
    const wasFavourited = favouriteMessages.some((m) => m.id === message.id);
    setFavouriteMessages((prev) =>
      wasFavourited
        ? prev.filter((m) => m.id !== message.id)
        : [{ ...message, favouritedAt: new Date().toISOString() }, ...prev]
    );
    try {
      await chatService.toggleFavourite(message.id);
    } catch (err) {
      logger.error('Failed to toggle favourite:', err);
      toast.error('Failed to update favourite');
      setFavouriteMessages((prev) =>
        wasFavourited
          ? [{ ...message, favouritedAt: new Date().toISOString() }, ...prev]
          : prev.filter((m) => m.id !== message.id)
      );
    }
  }, [favouriteMessages]);

  const favouriteIds = useMemo(() => new Set(favouriteMessages.map((m) => m.id)), [favouriteMessages]);

  return { favouriteMessages, favouriteIds, loadingFavourites, toggleFavourite, refetchFavourites: fetchFavouriteMessages };
}

/**
 * The Teams-style global "Saved" view — every message the user has favourited
 * across all of their conversations, not just the one currently open.
 */
export function useGlobalFavourites() {
  const [messages, setMessages] = useState<FavouriteMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatService.getAllFavouriteMessages();
      setMessages(data);
    } catch (err) {
      logger.error('Failed to fetch saved messages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const removeFavourite = useCallback(async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    try {
      await chatService.toggleFavourite(messageId);
    } catch (err) {
      logger.error('Failed to remove saved message:', err);
      toast.error('Failed to remove saved message');
      refetch();
    }
  }, [refetch]);

  return { messages, loading, refetch, removeFavourite };
}
