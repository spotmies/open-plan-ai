import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ExternalLink, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useChatStore } from '@/features/chat/stores/useChatStore';
import { useConversations, useMessages, useReactions } from '@/features/chat/hooks/useChatData';
import { useTypingIndicator } from '@/features/chat/hooks/useTypingIndicator';
import { useReadReceipts } from '@/features/chat/hooks/useReadReceipts';
import { MessageArea } from '@/features/chat/components/MessageArea';
import { MessageInput } from '@/features/chat/components/MessageInput';
import { TypingIndicator } from '@/features/chat/components/TypingIndicator';
import { MessageAreaSkeleton } from '@/features/chat/components/MessageAreaSkeleton';
import { EmptyState } from '@/features/chat/components/EmptyState';
import { cn } from '@/lib/utils';

interface ProjectChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  /** Viewport pixels from the top to dock below — keeps the project's title/tabs header fully visible. */
  topOffset?: number;
}

/**
 * Google Meet-style docked chat panel — slides in over the right edge without
 * dimming the rest of the page, so Tasks/Issues/Milestones/Modules/BOM/ECO stay
 * usable while it's open. Kept mounted with `conversationId` set only while
 * `open`, so it doesn't compete with the full Chat page for "currently viewing"
 * notification suppression when closed.
 */
export function ProjectChatPanel({ open, onOpenChange, conversationId, topOffset = 0 }: ProjectChatPanelProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setActiveConversation } = useChatStore();
  const { conversations } = useConversations();
  const activeConv = conversations.find((c) => c.id === conversationId);

  const activeId = open ? conversationId : null;
  const { messages, loading, error, hasMore, loadMore, refetchMessages, sendMessage, readOnly, readOnlyNotice } =
    useMessages(activeId);
  const { reactionMap, handleToggleReaction } = useReactions(messages, user?.id, activeId);
  const { typingNames, broadcastTyping } = useTypingIndicator(activeId, activeConv?.members, user?.id);
  const { readReceiptMap } = useReadReceipts(activeId, messages, user?.id, activeConv?.members ?? []);

  useEffect(() => {
    setActiveConversation(activeId ?? null);
    return () => setActiveConversation(null);
  }, [activeId, setActiveConversation]);

  const computeInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return words[0]?.charAt(0).toUpperCase() || '??';
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 right-0 z-30 flex w-full sm:w-[380px] flex-col border-l border-t border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
      )}
      style={{ top: topOffset }}
      aria-hidden={!open}
    >
      {activeConv && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 shrink-0">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={activeConv.avatarUrl} alt={activeConv.name} />
            <AvatarFallback>{computeInitials(activeConv.name || 'GC')}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{activeConv.name}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {activeConv.members.length} member{activeConv.members.length === 1 ? '' : 's'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Open full chat"
            onClick={() => {
              onOpenChange(false);
              navigate(`/chat/${activeConv.id}`);
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Close chat"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!activeConv ? (
        <div className="flex-1" />
      ) : loading ? (
        <MessageAreaSkeleton />
      ) : error && messages.length === 0 ? (
        <EmptyState type="error" description={error} onRetry={refetchMessages} />
      ) : (
        <MessageArea
          messages={messages}
          conversation={activeConv}
          hasMore={hasMore}
          onLoadMore={loadMore}
          readReceiptMap={readReceiptMap}
          reactionMap={reactionMap}
          onToggleReaction={handleToggleReaction}
        />
      )}

      {activeConv && (
        <>
          <TypingIndicator typingNames={typingNames} />
          <MessageInput
            conversationId={activeConv.id}
            onMessageSent={undefined}
            onTyping={broadcastTyping}
            members={activeConv.members}
            isGroup={activeConv.type === 'group'}
            sendMessage={sendMessage}
            readOnly={readOnly}
            readOnlyNotice={readOnlyNotice}
          />
        </>
      )}
    </div>
  );
}
