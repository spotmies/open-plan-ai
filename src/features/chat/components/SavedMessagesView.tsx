import { useMemo } from 'react';
import { Bookmark, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import { formatMessageTimestamp } from '@/utils/dateTime';
import type { Conversation, FavouriteMessage } from '../types';

interface SavedMessagesViewProps {
  messages: FavouriteMessage[];
  conversations: Conversation[];
  loading: boolean;
  currentUserId?: string;
  onOpenMessage: (message: FavouriteMessage) => void;
  onRemove: (messageId: string) => void;
  onClose: () => void;
}

function getConversationDisplay(conversation: Conversation | undefined, currentUserId?: string) {
  if (!conversation) return { name: 'Unknown conversation', avatarUrl: undefined as string | undefined, initials: '?' };
  if (conversation.type === 'group') {
    return {
      name: conversation.name,
      avatarUrl: conversation.avatarUrl,
      initials: conversation.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '??',
    };
  }
  const isSelfChat = conversation.members.every((m) => m.id === currentUserId);
  const otherMember = conversation.members.find((m) => m.id !== currentUserId) ?? (isSelfChat ? conversation.members[0] : undefined);
  return {
    name: isSelfChat ? `${otherMember?.name || 'You'} (You)` : otherMember?.name || conversation.name,
    avatarUrl: otherMember?.avatarUrl,
    initials: otherMember?.initials || '??',
  };
}

function previewText(message: FavouriteMessage): string {
  if (message.deletedAt) return 'Message deleted';
  if (message.contentType === 'image') return 'Photo';
  if (message.contentType === 'file') return 'Attachment';
  return message.content;
}

export function SavedMessagesView({
  messages, conversations, loading, currentUserId, onOpenMessage, onRemove, onClose,
}: SavedMessagesViewProps) {
  const timezone = useUserTimezone();
  const conversationById = useMemo(() => new Map(conversations.map((c) => [c.id, c])), [conversations]);

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 fill-amber-500 text-amber-500" />
          <h3 className="text-sm font-semibold">Saved Messages</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Bookmark className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium">No saved messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Save a message in any chat to see it here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {messages.map((message) => {
              const display = getConversationDisplay(conversationById.get(message.conversationId), currentUserId);
              const isOwn = message.senderId === currentUserId;
              return (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => onOpenMessage(message)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors group"
                >
                  <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                    {display.avatarUrl && <AvatarImage src={display.avatarUrl} className="object-cover" />}
                    <AvatarFallback className="text-[10px]">{display.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{display.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatMessageTimestamp(message.createdAt, timezone)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      <span className="font-medium text-foreground/70">{isOwn ? 'You' : message.senderName}: </span>
                      {previewText(message)}
                    </p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); onRemove(message.id); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onRemove(message.id); } }}
                    title="Remove from saved"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-background cursor-pointer"
                  >
                    <Bookmark className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
