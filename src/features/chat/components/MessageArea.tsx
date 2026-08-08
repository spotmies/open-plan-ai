import { useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MessageBubble } from './MessageBubble';
import { MediaGroupBubble } from './MediaGroupBubble';
import { MessageDateDivider } from './MessageDateDivider';
import { SystemMessage } from './SystemMessage';
import { CallHistoryCard } from './CallHistoryCard';
import { EmptyState } from './EmptyState';
import { ChatMessage, Conversation, ReadReceipt, MessageReaction } from '../types';
import { parseCallCardContent } from '../utils/callCard';
import { isSameDay, differenceInMinutes } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useChatStore } from '../stores/useChatStore';

interface MessageAreaProps {
  messages: ChatMessage[];
  conversation: Conversation;
  hasMore?: boolean;
  onLoadMore?: () => void;
  readReceiptMap?: Record<string, ReadReceipt[]>;
  reactionMap?: Record<string, MessageReaction[]>;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onDeleteMessage?: (messageId: string, senderName: string) => void;
  onDeleteMessageForMe?: (messageId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void | Promise<void>;
  onReplyMessage?: (message: ChatMessage) => void;
  onForwardMessage?: (messages: ChatMessage[]) => void;
  /** When set, only pinned/favourite messages render — the rest of the timeline is filtered out. */
  filterMode?: 'pinned' | 'favourites' | null;
  pinnedMessageIds?: Set<string>;
  favouriteMessageIds?: Set<string>;
  onTogglePin?: (messageId: string) => void;
  onToggleFavourite?: (messageId: string) => void;
}

export function MessageArea({
  messages, conversation, hasMore, onLoadMore, readReceiptMap, reactionMap,
  onEditMessage, onDeleteMessage, onDeleteMessageForMe, onToggleReaction, onReplyMessage, onForwardMessage,
  filterMode, pinnedMessageIds, favouriteMessageIds, onTogglePin, onToggleFavourite,
}: MessageAreaProps) {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevConvIdRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef(0);
  const atBottomRef = useRef(true);
  const isGroup = conversation.type === 'group';
  const searchQuery = useChatStore((s) => s.messageSearchQuery);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Consider "at bottom" if within 80px of the bottom
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  // On conversation change: instant jump to bottom (sync, before paint to avoid flash)
  useLayoutEffect(() => {
    const convChanged = prevConvIdRef.current !== conversation.id;
    if (convChanged) {
      prevConvIdRef.current = conversation.id;
      prevMessageCountRef.current = messages.length;
      atBottomRef.current = true;
      scrollToBottom('instant');
    }
  }, [conversation.id, messages.length, scrollToBottom]);

  // On new messages in the same conversation: smooth scroll only if already at bottom
  useEffect(() => {
    const isNewConv = prevConvIdRef.current !== conversation.id;
    if (isNewConv) return; // handled by useLayoutEffect above

    const prevCount = prevMessageCountRef.current;
    const newCount = messages.length;

    if (newCount <= prevCount) {
      prevMessageCountRef.current = newCount;
      return;
    }

    // Messages were appended (new messages, not history load)
    // Only auto-scroll if user was already at the bottom
    if (atBottomRef.current) {
      scrollToBottom('smooth');
    }

    prevMessageCountRef.current = newCount;
  }, [messages.length, conversation.id, scrollToBottom]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const messageById = useMemo(() => {
    return new Map(messages.map((message) => [message.id, message]));
  }, [messages]);

  const otherMembersCount = useMemo(
    () => conversation.members.filter((m) => m.id !== user?.id).length,
    [conversation.members, user?.id]
  );

  const reactionUsers = useMemo(
    () => Object.fromEntries(conversation.members.map((m) => [m.id, m.name])),
    [conversation.members]
  );

  if (messages.length === 0) {
    if (filterMode === 'pinned') {
      return (
        <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground px-8">
          No pinned messages yet. Pin up to 5 important messages to see them here.
        </div>
      );
    }
    if (filterMode === 'favourites') {
      return (
        <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground px-8">
          No favourite messages yet. Star a message to save it here.
        </div>
      );
    }
    return <EmptyState type="no-messages" />;
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto max-md:overflow-x-hidden"
    >
      <div className="flex flex-col gap-0.5 pt-4 pb-2 max-md:max-w-full">
        {hasMore && onLoadMore && (
          <div className="flex justify-center py-2">
            <Button variant="ghost" size="sm" onClick={onLoadMore} className="text-xs text-muted-foreground">
              Load older messages
            </Button>
          </div>
        )}
        {(() => {
          const nodes: JSX.Element[] = [];
          const isImageMsg = (m: ChatMessage) => m.contentType === 'image';
          let i = 0;

          while (i < filteredMessages.length) {
            const msg = filteredMessages[i];
            const prev = i > 0 ? filteredMessages[i - 1] : null;
            const msgDate = new Date(msg.createdAt);
            const showDateDivider = !prev || !isSameDay(new Date(prev.createdAt), msgDate);

            // Checked regardless of contentType: the backend doesn't reliably
            // echo back the 'system' type we post a call card as (it can come
            // back as 'text'), so detection has to rely on the JSON shape of
            // the content itself, not the server's reported contentType.
            const callCard = parseCallCardContent(msg.content);
            if (callCard) {
              nodes.push(
                <div key={msg.id}>
                  {showDateDivider && <MessageDateDivider date={msgDate} />}
                  <CallHistoryCard message={msg} content={callCard} isGroupChat={isGroup} currentUserId={user?.id} />
                </div>
              );
              i += 1;
              continue;
            }

            if (msg.contentType === 'system') {
              nodes.push(
                <div key={msg.id}>
                  {showDateDivider && <MessageDateDivider date={msgDate} />}
                  <SystemMessage content={msg.content} />
                </div>
              );
              i += 1;
              continue;
            }

            const isSameSenderAsPrev = prev && prev.senderId === msg.senderId && prev.contentType !== 'system' &&
              differenceInMinutes(msgDate, new Date(prev.createdAt)) < 2 && !showDateDivider;
            const showSenderInfo = !isSameSenderAsPrev;

            // Batch consecutive image-only messages from the same sender (tight
            // time gap, same day) into a single WhatsApp/Telegram-style grid
            // instead of stacking each as its own full-width bubble.
            if (isImageMsg(msg)) {
              const run: ChatMessage[] = [msg];
              let j = i + 1;
              while (
                j < filteredMessages.length &&
                isImageMsg(filteredMessages[j]) &&
                filteredMessages[j].senderId === msg.senderId &&
                isSameDay(new Date(filteredMessages[j].createdAt), msgDate) &&
                differenceInMinutes(new Date(filteredMessages[j].createdAt), new Date(filteredMessages[j - 1].createdAt)) < 2
              ) {
                run.push(filteredMessages[j]);
                j += 1;
              }

              if (run.length > 1) {
                const last = run[run.length - 1];
                const afterRun = j < filteredMessages.length ? filteredMessages[j] : null;
                const isSameSenderAsNext = afterRun && afterRun.senderId === last.senderId && afterRun.contentType !== 'system' &&
                  isSameDay(new Date(afterRun.createdAt), new Date(last.createdAt)) &&
                  differenceInMinutes(new Date(afterRun.createdAt), new Date(last.createdAt)) < 2;
                const showTimestamp = !isSameSenderAsNext;

                nodes.push(
                  <div key={msg.id} id={`msg-${last.id}`}>
                    {showDateDivider && <MessageDateDivider date={msgDate} />}
                    <div className={showSenderInfo && i > 0 ? 'mt-3' : 'mt-0.5'}>
                      <MediaGroupBubble
                        messages={run}
                        showSenderInfo={showSenderInfo}
                        showTimestamp={showTimestamp}
                        isGroupChat={isGroup}
                        currentUserId={user?.id}
                        readReceipts={readReceiptMap?.[last.id]}
                        otherMembersCount={otherMembersCount}
                        reactions={reactionMap?.[last.id]}
                        reactionUsers={reactionUsers}
                        isPinned={pinnedMessageIds?.has(last.id)}
                        isFavourited={favouriteMessageIds?.has(last.id)}
                        onDelete={onDeleteMessage}
                        onDeleteForMe={onDeleteMessageForMe}
                        onToggleReaction={onToggleReaction}
                        onReply={onReplyMessage}
                        onForward={onForwardMessage}
                        onTogglePin={onTogglePin}
                        onToggleFavourite={onToggleFavourite}
                      />
                    </div>
                  </div>
                );
                i = j;
                continue;
              }
            }

            const next = i < filteredMessages.length - 1 ? filteredMessages[i + 1] : null;
            const isSameSenderAsNext = next && next.senderId === msg.senderId && next.contentType !== 'system' &&
              differenceInMinutes(new Date(next.createdAt), msgDate) < 2 &&
              (next ? isSameDay(new Date(next.createdAt), msgDate) : false);
            const showTimestamp = !isSameSenderAsNext;

            nodes.push(
              <div key={msg.id} id={`msg-${msg.id}`}>
                {showDateDivider && <MessageDateDivider date={msgDate} />}
                <div className={showSenderInfo && i > 0 ? 'mt-3' : 'mt-0.5'}>
                  <MessageBubble
                    message={{
                      ...msg,
                      replyToMessage: msg.replyToMessageId ? messageById.get(msg.replyToMessageId) : undefined,
                    }}
                    showSenderInfo={showSenderInfo}
                    showTimestamp={showTimestamp}
                    isGroupChat={isGroup}
                    currentUserId={user?.id}
                    searchQuery={searchQuery}
                    memberNames={conversation.members.map((m) => m.name)}
                    readReceipts={readReceiptMap?.[msg.id]}
                    otherMembersCount={otherMembersCount}
                    reactions={reactionMap?.[msg.id]}
                    reactionUsers={reactionUsers}
                    isPinned={pinnedMessageIds?.has(msg.id)}
                    isFavourited={favouriteMessageIds?.has(msg.id)}
                    onEdit={onEditMessage}
                    onDelete={onDeleteMessage}
                    onDeleteForMe={onDeleteMessageForMe}
                    onToggleReaction={onToggleReaction}
                    onReply={onReplyMessage}
                    onForward={onForwardMessage ? (message) => onForwardMessage([message]) : undefined}
                    onTogglePin={onTogglePin}
                    onToggleFavourite={onToggleFavourite}
                  />
                </div>
              </div>
            );
            i += 1;
          }

          return nodes;
        })()}
        {searchQuery.trim() && filteredMessages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No messages match your search</div>
        )}
      </div>
    </div>
  );
}
