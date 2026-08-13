import { useCallback, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { ConversationList } from './components/ConversationList';
import { MessageArea } from './components/MessageArea';
import { MessageInput } from './components/MessageInput';
import { ChatHeader } from './components/ChatHeader';
import { DetailPanel } from './components/DetailPanel';
import { AddMemberDialog } from './components/AddMemberDialog';
import { ForwardMessageDialog } from './components/ForwardMessageDialog';
import { EmptyState } from './components/EmptyState';
import { TypingIndicator } from './components/TypingIndicator';
import { MessageAreaSkeleton } from './components/MessageAreaSkeleton';
import { PinnedBanner } from './components/PinnedBanner';
import { SavedMessagesView } from './components/SavedMessagesView';
import { useChatStore } from './stores/useChatStore';
import { useConversations, useMessages, useReactions, usePinnedMessages, useFavouriteMessages, useGlobalFavourites } from './hooks/useChatData';
import { useTypingIndicator } from './hooks/useTypingIndicator';
import { useReachableUsers } from './hooks/useReachableUsers';
import { useReadReceipts } from './hooks/useReadReceipts';
import { chatService } from '@/services/chat.service';
import { toast } from 'sonner';
import { ChatMessage, FavouriteMessage } from './types';
import { logger } from '@/services/monitoring/logger';


export default function Chat() {
  useEffect(() => {
    document.title = 'Chat | Open Plan AI';
    return () => { document.title = 'Open Plan AI'; };
  }, []);

  // Clear the "currently viewing" conversation on unmount so the app-wide chat
  // listener (ChatNotificationsProvider) correctly treats every conversation as
  // inactive — and therefore notifiable — once the user navigates away from Chat.
  useEffect(() => {
    return () => { useChatStore.getState().setActiveConversation(null); };
  }, []);

  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { activeConversationId, lastActiveConversationId, setActiveConversation, isDetailPanelOpen, isMessageSearchOpen } = useChatStore();

  const {
    conversations, loading: convsLoading, refetch,
    toggleConversationFavourite, hideConversation, toggleMute, markConversationRead,
  } = useConversations();
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [forwardMessages, setForwardMessages] = useState<ChatMessage[] | null>(null);
  const activeId = conversationId || (isMobile ? null : activeConversationId);
  const { messages, loading: msgsLoading, error: msgsError, hasMore, loadMore, refetchMessages, sendMessage, readOnly, readOnlyNotice } = useMessages(activeId ?? null);
  const { reactionMap, handleToggleReaction } = useReactions(messages, user?.id, activeId ?? null);
  const { data: reachableUsers = [] } = useReachableUsers();
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);
  const [messageFilter, setMessageFilter] = useState<'pinned' | 'favourites' | null>(null);
  const pendingFilterRef = useRef<'pinned' | 'favourites' | null>(null);
  const { pinnedMessages, pinnedMessageIds, pinMessage, unpinMessage } = usePinnedMessages(activeId ?? null);
  const { favouriteMessages, favouriteIds, toggleFavourite, refetchFavourites } = useFavouriteMessages(activeId ?? null);
  const [showSaved, setShowSaved] = useState(false);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const { messages: savedMessages, loading: savedLoading, refetch: refetchSaved, removeFavourite: removeSavedMessage } = useGlobalFavourites();

  const activeConv = conversations.find((c) => c.id === activeId);

  const { typingNames, broadcastTyping } = useTypingIndicator(
    activeId,
    activeConv?.members,
    user?.id
  );

  const { readReceiptMap } = useReadReceipts(activeId, messages, user?.id, activeConv?.members ?? []);

  useEffect(() => {
    if (conversationId && conversationId !== activeConversationId) {
      setActiveConversation(conversationId);
    }
  }, [conversationId, activeConversationId, setActiveConversation]);

  useEffect(() => {
    setReplyingTo(null);
    setMessageFilter(pendingFilterRef.current);
    pendingFilterRef.current = null;
  }, [activeId]);

  // Landing on bare /chat (e.g. via the sidebar nav icon) after previously having
  // a conversation open should restore it, rather than showing the empty state.
  useEffect(() => {
    if (conversationId || isMobile || convsLoading || !lastActiveConversationId) return;
    if (conversations.some((c) => c.id === lastActiveConversationId)) {
      navigate(`/chat/${lastActiveConversationId}`, { replace: true });
    }
  }, [conversationId, isMobile, convsLoading, lastActiveConversationId, conversations, navigate]);

  useEffect(() => {
    if (!conversationId || convsLoading) return;
    const existsInList = conversations.some((c) => c.id === conversationId);
    if (existsInList) return;

    // Newly-created project chats can lag briefly in local conversation state.
    // Refetch immediately (and once shortly after) so route-opened chats render without manual refresh.
    refetch().catch(() => {
      // Non-blocking: ConversationList handles fetch errors internally.
    });
    const baseDelayMs = Number(import.meta.env.VITE_CHAT_CONVERSATION_REFETCH_BASE_DELAY_MS ?? 600);
    const maxRetries = Number(import.meta.env.VITE_CHAT_CONVERSATION_REFETCH_MAX_RETRIES ?? 1);

    // Exponential backoff to avoid hardcoding a single delay under varying latency/load.
    const retryDelaysMs = Array.from({ length: maxRetries }, (_, i) => baseDelayMs * (2 ** i));
    let isCancelled = false;

    const retryTimers = retryDelaysMs.map((delayMs) =>
      window.setTimeout(() => {
        if (isCancelled) return;
        refetch().catch(() => {
          // Non-blocking retry.
        });
      }, delayMs)
    );

    return () => {
      isCancelled = true;
      retryTimers.forEach((t) => window.clearTimeout(t));
    };
  }, [conversationId, convsLoading, conversations, refetch]);

  useEffect(() => {
    // On mobile /chat route, do not auto-open a stale cached conversation.
    if (isMobile && !conversationId && activeConversationId) {
      setActiveConversation(null);
    }
  }, [isMobile, conversationId, activeConversationId, setActiveConversation]);

  const navigateToConversation = useCallback((id: string) => {
    setActiveConversation(id);
    navigate(`/chat/${id}`);
  }, [navigate, setActiveConversation]);

  const handleSelectConversation = useCallback((id: string) => {
    setShowSaved(false);
    setHighlightMessageId(null);
    navigateToConversation(id);
  }, [navigateToConversation]);

  const handleBack = useCallback(() => {
    setActiveConversation(null);
    navigate('/chat');
  }, [navigate, setActiveConversation]);

  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    try {
      await chatService.editMessage(messageId, newContent);
      await refetchMessages();
    } catch (err) {
      logger.error('Failed to edit message:', err);
      toast.error('Failed to edit message');
    }
  }, [refetchMessages]);

  const handleDeleteMessage = useCallback(async (messageId: string, senderName: string) => {
    try {
      await chatService.deleteMessage(messageId, senderName);
      await refetchMessages();
    } catch (err) {
      logger.error('Failed to delete message:', err);
      toast.error('Failed to delete message');
    }
  }, [refetchMessages]);

  const handleDeleteMessageForMe = useCallback(async (messageId: string) => {
    try {
      await chatService.deleteMessageForMe(messageId);
      await refetchMessages();
    } catch (err) {
      logger.error('Failed to delete message for me:', err);
      toast.error('Failed to delete message');
    }
  }, [refetchMessages]);

  const handleReplyMessage = useCallback((message: ChatMessage) => {
    setReplyingTo(message);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleForwardMessage = useCallback((messages: ChatMessage[]) => {
    setForwardMessages(messages);
  }, []);

  const handleForwardSubmit = useCallback(async (targetConversationIds: string[]) => {
    if (!forwardMessages) return;
    try {
      for (const targetId of targetConversationIds) {
        for (const msg of forwardMessages) {
          await chatService.forwardMessage(targetId, msg);
        }
      }
      toast.success(
        forwardMessages.length > 1
          ? `${forwardMessages.length} items forwarded`
          : 'Message forwarded'
      );
      if (targetConversationIds.includes(activeId ?? '')) await refetchMessages();
    } catch (err) {
      logger.error('Failed to forward message:', err);
      toast.error('Failed to forward message');
      throw err;
    }
  }, [forwardMessages, activeId, refetchMessages]);

  const handleTogglePin = useCallback((messageId: string) => {
    if (!activeId) return;
    if (pinnedMessageIds.has(messageId)) {
      unpinMessage(messageId);
    } else {
      pinMessage(messageId);
    }
  }, [activeId, pinnedMessageIds, pinMessage, unpinMessage]);

  const handleToggleFavourite = useCallback(async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId)
      ?? pinnedMessages.find((m) => m.id === messageId)
      ?? favouriteMessages.find((m) => m.id === messageId);
    if (msg) await toggleFavourite(msg);
    // Keep the global Saved panel (a separate fetch) in sync with per-message toggles
    // made anywhere else, so a newly-saved message shows up without a manual refresh.
    refetchSaved();
  }, [messages, pinnedMessages, favouriteMessages, toggleFavourite, refetchSaved]);

  const handleShowPinned = useCallback(() => {
    useChatStore.getState().setDetailPanelOpen(false);
    setMessageFilter('pinned');
  }, []);

  const handleShowFavourites = useCallback(() => {
    useChatStore.getState().setDetailPanelOpen(false);
    setMessageFilter('favourites');
  }, []);

  const handleCloseFilter = useCallback(() => {
    setMessageFilter(null);
  }, []);

  const handleShowSaved = useCallback(() => {
    useChatStore.getState().setDetailPanelOpen(false);
    setShowSaved(true);
    refetchSaved();
  }, [refetchSaved]);

  const handleRemoveSaved = useCallback(async (messageId: string) => {
    await removeSavedMessage(messageId);
    // The removed message might be the currently open conversation's — refresh its
    // own favourites so the bookmark icon on that bubble updates too.
    refetchFavourites();
  }, [removeSavedMessage, refetchFavourites]);

  const handleDeleteChat = useCallback((targetConversationId: string) => {
    hideConversation(targetConversationId);
    if (targetConversationId === activeId) handleBack();
  }, [hideConversation, activeId, handleBack]);

  const handleOpenSavedMessage = useCallback((message: FavouriteMessage) => {
    // Desktop keeps the Saved panel open as a third column (Teams-style) so another
    // saved item can be picked next; mobile has no room for three panes, so it closes.
    if (isMobile) setShowSaved(false);
    setHighlightMessageId(message.id);
    if (message.conversationId === activeId) {
      setMessageFilter(null);
    } else {
      pendingFilterRef.current = null;
      navigateToConversation(message.conversationId);
    }
  }, [isMobile, activeId, navigateToConversation]);

  const routeHasConversation = Boolean(conversationId);
  // Desktop shows conversation list + (optionally) the Saved panel + the chat pane all at
  // once — three columns, like Teams' Quick views. Mobile has room for only one at a time,
  // so panes are shown/hidden in sequence instead (list -> saved -> chat).
  const showConversationList = isMobile ? !routeHasConversation && !showSaved : true;
  const showSavedPane = showSaved;
  const showChatPane = isMobile ? routeHasConversation && !showSaved : true;

  const typingText = typingNames.length > 0
    ? typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : `${typingNames.length} people typing...`
    : undefined;

  const displayMessages = messageFilter === 'pinned'
    ? pinnedMessages
    : messageFilter === 'favourites'
      ? favouriteMessages
      : messages;

  return (
    <>
      <div className="flex h-full overflow-hidden relative">
        {showConversationList && (
          <div className="w-full md:w-[280px] shrink-0 overflow-hidden">
            <ConversationList
              conversations={conversations}
              loading={convsLoading}
              onSelect={handleSelectConversation}
              onConversationCreated={refetch}
              onlineUserIds={onlineUserIds}
              onShowSaved={handleShowSaved}
              isSavedActive={showSaved}
              onToggleFavourite={toggleConversationFavourite}
              onToggleMute={user?.id ? (id) => toggleMute(id, user.id) : undefined}
              onMarkRead={markConversationRead}
              onDeleteChat={handleDeleteChat}
            />
          </div>
        )}

        {showSavedPane && (
          <div className="w-full md:w-[320px] shrink-0 overflow-hidden border-r border-border">
            <SavedMessagesView
              messages={savedMessages}
              conversations={conversations}
              loading={savedLoading}
              currentUserId={user?.id}
              onOpenMessage={handleOpenSavedMessage}
              onRemove={handleRemoveSaved}
              onClose={() => setShowSaved(false)}
            />
          </div>
        )}

        {showChatPane && (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {activeConv ? (
              <>
                <ChatHeader
                  conversation={activeConv}
                  onBack={isMobile ? handleBack : undefined}
                  onlineUserIds={onlineUserIds}
                  typingText={typingText}
                  onAddMember={() => setAddMemberOpen(true)}
                  onSendMessage={sendMessage}
                  pinnedCount={pinnedMessages.length}
                  favouriteCount={favouriteMessages.length}
                  filterMode={messageFilter}
                  onShowPinned={handleShowPinned}
                  onShowFavourites={handleShowFavourites}
                  onCloseFilter={handleCloseFilter}
                />
                {!messageFilter && pinnedMessages.length > 0 && (
                  <PinnedBanner
                    pinnedMessages={pinnedMessages}
                    onUnpin={unpinMessage}
                    onShowAll={handleShowPinned}
                  />
                )}
                {msgsLoading ? (
                  <MessageAreaSkeleton />
                ) : !messageFilter && msgsError && messages.length === 0 ? (
                  <EmptyState type="error" description={msgsError} onRetry={refetchMessages} />
                ) : (
                  <MessageArea
                    messages={displayMessages}
                    conversation={activeConv}
                    hasMore={!messageFilter && hasMore}
                    onLoadMore={!messageFilter ? loadMore : undefined}
                    readReceiptMap={readReceiptMap}
                    reactionMap={reactionMap}
                    onEditMessage={handleEditMessage}
                    onDeleteMessage={handleDeleteMessage}
                    onDeleteMessageForMe={handleDeleteMessageForMe}
                    onToggleReaction={handleToggleReaction}
                    onReplyMessage={handleReplyMessage}
                    onForwardMessage={handleForwardMessage}
                    filterMode={messageFilter}
                    pinnedMessageIds={pinnedMessageIds}
                    favouriteMessageIds={favouriteIds}
                    onTogglePin={handleTogglePin}
                    onToggleFavourite={handleToggleFavourite}
                    highlightMessageId={highlightMessageId}
                    onHighlightHandled={() => setHighlightMessageId(null)}
                    onJumpToMessage={setHighlightMessageId}
                  />
                )}
                <TypingIndicator typingNames={typingNames} />
                <MessageInput
                  conversationId={activeConv.id}
                  onMessageSent={refetch}
                  onTyping={broadcastTyping}
                  members={activeConv.members}
                  isGroup={activeConv.type === 'group'}
                  sendMessage={sendMessage}
                  readOnly={readOnly}
                  readOnlyNotice={readOnlyNotice}
                  replyingTo={replyingTo}
                  onCancelReply={handleCancelReply}
                />
              </>
            ) : (
              routeHasConversation && convsLoading ? <MessageAreaSkeleton /> : <EmptyState type="no-selection" />
            )}
          </div>
        )}

        {activeConv && (
          <AddMemberDialog
            conversation={activeConv}
            open={addMemberOpen}
            onOpenChange={setAddMemberOpen}
            onMemberAdded={refetch}
          />
        )}

        <ForwardMessageDialog
          open={forwardMessages !== null}
          onOpenChange={(open) => { if (!open) setForwardMessages(null); }}
          conversations={conversations}
          reachableUsers={reachableUsers}
          messages={forwardMessages}
          onForward={handleForwardSubmit}
        />

        {isDetailPanelOpen && activeConv && (
          isMobile ? (
            <div className="absolute inset-0 z-20 bg-background">
              <DetailPanel
                conversation={activeConv}
                onRefetch={refetch}
                className="w-full border-l-0"
                pinnedCount={pinnedMessages.length}
                favouriteCount={favouriteMessages.length}
                onShowPinned={handleShowPinned}
                onShowFavourites={handleShowFavourites}
              />
            </div>
          ) : (
            <DetailPanel
              conversation={activeConv}
              onRefetch={refetch}
              pinnedCount={pinnedMessages.length}
              favouriteCount={favouriteMessages.length}
              onShowPinned={handleShowPinned}
              onShowFavourites={handleShowFavourites}
            />
          )
        )}
      </div>
    </>
  );
}
