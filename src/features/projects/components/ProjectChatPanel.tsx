import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ExternalLink, MessageCircle, Users } from 'lucide-react';
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

interface ProjectChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
}

/**
 * Floating docked chat panel — same corner-card shell as AssistantWidget, so it
 * sits below the app header and project tabs instead of covering them, and
 * doesn't dim the rest of the page. Stays mounted across Tasks/Issues/
 * Milestones/Modules/BOM/ECO tabs since it lives in ProjectDetail, above the
 * tab content. Only wires `conversationId` into the data hooks while `open`,
 * so it doesn't compete with the full Chat page for "currently viewing"
 * notification suppression when closed.
 */
export function ProjectChatPanel({ open, onOpenChange, conversationId }: ProjectChatPanelProps) {
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

  if (!open) return null;

  const computeInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return words[0]?.charAt(0).toUpperCase() || '??';
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex h-[600px] max-h-[80vh] w-[420px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        {activeConv ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={activeConv.avatarUrl} alt={activeConv.name} />
              <AvatarFallback>{computeInitials(activeConv.name || 'GC')}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{activeConv.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Users className="h-3 w-3 shrink-0" />
                {activeConv.members.length} member{activeConv.members.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="h-4 w-4" />
            </div>
            <p className="truncate text-sm font-semibold text-foreground">Project Chat</p>
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {activeConv && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Open full chat"
              onClick={() => {
                onOpenChange(false);
                navigate(`/chat/${activeConv.id}`);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
