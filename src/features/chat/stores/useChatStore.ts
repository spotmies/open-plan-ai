import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Conversation, ChatMessage } from '../types';

type ConversationFilter = 'all' | 'dms' | 'groups';

/** How long cached data is considered "fresh" (ms). After this, a background revalidation fires. */
const STALE_THRESHOLD_MS = 30_000;

interface MessagesCacheEntry {
  messages: ChatMessage[];
  hasMore: boolean;
  loadedAt: number;
}

interface ChatState {
  // ── UI state ──────────────────────────────────────────────────────────
  activeConversationId: string | null;
  /** Last non-null activeConversationId, kept across unmount so returning to
   *  bare /chat can restore it — unlike activeConversationId, which is
   *  deliberately cleared on unmount so notifications resume for it. */
  lastActiveConversationId: string | null;
  conversationFilter: ConversationFilter;
  searchQuery: string;
  isDetailPanelOpen: boolean;
  draftMessages: Record<string, string>;
  unreadCounts: Record<string, number>;
  isMessageSearchOpen: boolean;
  messageSearchQuery: string;
  isNewDMDialogOpen: boolean;
  isNewGroupDialogOpen: boolean;

  // ── Data cache ────────────────────────────────────────────────────────
  conversations: Conversation[];
  conversationsLoadedAt: number | null;
  messagesCache: Record<string, MessagesCacheEntry>;
  pendingMessages: ChatMessage[];

  // ── Presence state ────────────────────────────────────────────────────
  onlineUserIds: Set<string>;
  setOnlineUserIds: (ids: Set<string>) => void;

  // ── UI actions ────────────────────────────────────────────────────────
  setActiveConversation: (id: string | null) => void;
  setConversationFilter: (filter: ConversationFilter) => void;
  setSearchQuery: (query: string) => void;
  toggleDetailPanel: () => void;
  setDetailPanelOpen: (open: boolean) => void;
  setDraft: (conversationId: string, draft: string) => void;
  getDraft: (conversationId: string) => string;
  markAsRead: (conversationId: string) => void;
  incrementUnread: (conversationId: string) => void;
  hydrateUnreadCounts: (conversations: Conversation[]) => void;
  getTotalUnread: () => number;
  toggleMessageSearch: () => void;
  setMessageSearchQuery: (query: string) => void;
  setNewDMDialogOpen: (open: boolean) => void;
  setNewGroupDialogOpen: (open: boolean) => void;

  // ── Data actions ──────────────────────────────────────────────────────
  setConversations: (conversations: Conversation[]) => void;
  isConversationsStale: () => boolean;

  setCachedMessages: (conversationId: string, messages: ChatMessage[], hasMore: boolean) => void;
  getCachedMessages: (conversationId: string) => MessagesCacheEntry | null;
  isMessagesStale: (conversationId: string) => boolean;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updater: (msg: ChatMessage) => ChatMessage) => void;
  resolveOptimisticMessage: (conversationId: string, tempId: string, realMessage: ChatMessage) => void;
  appendOlderMessages: (conversationId: string, older: ChatMessage[], hasMore: boolean) => void;
  addPendingMessage: (message: ChatMessage) => void;
  removePendingMessage: (messageId: string) => void;
  clearCache: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // ── UI state defaults ─────────────────────────────────────────────
      activeConversationId: null,
      lastActiveConversationId: null,
      conversationFilter: 'all',
      searchQuery: '',
      isDetailPanelOpen: false,
      draftMessages: {},
      unreadCounts: {},
      isMessageSearchOpen: false,
      messageSearchQuery: '',
      isNewDMDialogOpen: false,
      isNewGroupDialogOpen: false,

      // ── Data cache defaults ───────────────────────────────────────────
      conversations: [],
      conversationsLoadedAt: null,
      messagesCache: {},
      pendingMessages: [],

      // ── Presence state defaults ───────────────────────────────────────
      onlineUserIds: new Set(),
      setOnlineUserIds: (ids) => set({ onlineUserIds: ids }),

      // ── UI actions ────────────────────────────────────────────────────
      setActiveConversation: (id) => {
        set((state) => ({
          activeConversationId: id,
          lastActiveConversationId: id ?? state.lastActiveConversationId,
        }));
        if (id) {
          set((state) => ({
            unreadCounts: { ...state.unreadCounts, [id]: 0 },
          }));
        }
      },
      setConversationFilter: (filter) => set({ conversationFilter: filter }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      toggleDetailPanel: () => set((s) => ({ isDetailPanelOpen: !s.isDetailPanelOpen })),
      setDetailPanelOpen: (open) => set({ isDetailPanelOpen: open }),
      setDraft: (conversationId, draft) =>
        set((state) => ({
          draftMessages: { ...state.draftMessages, [conversationId]: draft },
        })),
      getDraft: (conversationId) => get().draftMessages[conversationId] || '',
      markAsRead: (conversationId) =>
        set((state) => ({
          unreadCounts: { ...state.unreadCounts, [conversationId]: 0 },
        })),
      incrementUnread: (conversationId) =>
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [conversationId]: (state.unreadCounts[conversationId] || 0) + 1,
          },
        })),
      hydrateUnreadCounts: (conversations) =>
        set((state) => {
          const next = { ...state.unreadCounts };
          for (const c of conversations) {
            next[c.id] = c.id === state.activeConversationId ? 0 : (c.unreadCount ?? next[c.id] ?? 0);
          }
          return { unreadCounts: next };
        }),
      getTotalUnread: () => {
        const counts = get().unreadCounts;
        return Object.values(counts).reduce((sum, c) => sum + c, 0);
      },
      toggleMessageSearch: () => set((s) => ({
        isMessageSearchOpen: !s.isMessageSearchOpen,
        messageSearchQuery: s.isMessageSearchOpen ? '' : s.messageSearchQuery,
      })),
      setMessageSearchQuery: (query) => set({ messageSearchQuery: query }),
      setNewDMDialogOpen: (open) => set({ isNewDMDialogOpen: open }),
      setNewGroupDialogOpen: (open) => set({ isNewGroupDialogOpen: open }),

      // ── Data actions ──────────────────────────────────────────────────
      setConversations: (conversations) =>
        set({ conversations, conversationsLoadedAt: Date.now() }),

      isConversationsStale: () => {
        const { conversationsLoadedAt } = get();
        if (!conversationsLoadedAt) return true;
        return Date.now() - conversationsLoadedAt > STALE_THRESHOLD_MS;
      },

      setCachedMessages: (conversationId, messages, hasMore) =>
        set((state) => ({
          messagesCache: {
            ...state.messagesCache,
            [conversationId]: { messages, hasMore, loadedAt: Date.now() },
          },
        })),

      getCachedMessages: (conversationId) => {
        return get().messagesCache[conversationId] ?? null;
      },

      isMessagesStale: (conversationId) => {
        const entry = get().messagesCache[conversationId];
        if (!entry) return true;
        return Date.now() - entry.loadedAt > STALE_THRESHOLD_MS;
      },

      addMessage: (conversationId, message) =>
        set((state) => {
          const entry = state.messagesCache[conversationId];
          if (!entry) return state;
          // Avoid duplicates
          if (entry.messages.some((m) => m.id === message.id)) return state;
          return {
            messagesCache: {
              ...state.messagesCache,
              [conversationId]: {
                ...entry,
                messages: [...entry.messages, message],
              },
            },
          };
        }),

      updateMessage: (conversationId, messageId, updater) =>
        set((state) => {
          const entry = state.messagesCache[conversationId];
          if (!entry) return state;
          return {
            messagesCache: {
              ...state.messagesCache,
              [conversationId]: {
                ...entry,
                messages: entry.messages.map((m) =>
                  m.id === messageId ? updater(m) : m
                ),
              },
            },
          };
        }),

      resolveOptimisticMessage: (conversationId, tempId, realMessage) =>
        set((state) => {
          const entry = state.messagesCache[conversationId];
          if (!entry) return state;

          const messages = entry.messages.map((m) =>
            m.id === tempId ? realMessage : m
          );

          // If the real message was already added (e.g. by realtime before we resolved),
          // we should filter out the duplicate (tempId) instead of replacing it.
          const hasRealAlready = entry.messages.some(
            (m) => m.id === realMessage.id && m.id !== tempId
          );
          const finalMessages = hasRealAlready
            ? entry.messages.filter((m) => m.id !== tempId)
            : messages;

          return {
            messagesCache: {
              ...state.messagesCache,
              [conversationId]: {
                ...entry,
                messages: finalMessages,
              },
            },
          };
        }),

      appendOlderMessages: (conversationId, older, hasMore) =>
        set((state) => {
          const entry = state.messagesCache[conversationId];
          if (!entry) return state;
          const existingIds = new Set(entry.messages.map((m) => m.id));
          return {
            messagesCache: {
              ...state.messagesCache,
              [conversationId]: {
                ...entry,
                messages: [...older.filter((m) => !existingIds.has(m.id)), ...entry.messages],
                hasMore,
              },
            },
          };
        }),

      addPendingMessage: (message) =>
        set((state) => ({
          pendingMessages: [...state.pendingMessages.filter(m => m.id !== message.id), message],
        })),

      removePendingMessage: (messageId) =>
        set((state) => ({
          pendingMessages: state.pendingMessages.filter((m) => m.id !== messageId),
        })),

      clearCache: () =>
        set({ conversations: [], conversationsLoadedAt: null, messagesCache: {}, pendingMessages: [] }),
    }),
    {
      name: 'chat-store',
      partialize: (state) => ({
        draftMessages: state.draftMessages,
        pendingMessages: state.pendingMessages
      }),
    }
  )
);
