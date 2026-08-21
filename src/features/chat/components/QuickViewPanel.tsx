import { Star, PenLine, X, MessagesSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { messagePreviewText } from '../chat.mappers';
import type { Conversation } from '../types';

interface QuickViewPanelProps {
  type: 'favourites' | 'drafts';
  conversations: Conversation[];
  draftMessages: Record<string, string>;
  loading: boolean;
  currentUserId?: string;
  selectedId: string | null;
  onlineUserIds?: Set<string>;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const CONFIG = {
  favourites: {
    title: 'Favorites',
    icon: Star,
    emptyTitle: 'No favorites yet',
    emptyDescription: 'Hover a chat and pin it to add it to your favorites',
  },
  drafts: {
    title: 'Drafts',
    icon: PenLine,
    emptyTitle: 'No drafts',
    emptyDescription: 'Messages you start typing but don’t send will show up here',
  },
};

function getConversationDisplay(conversation: Conversation, currentUserId?: string) {
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

export function QuickViewPanel({
  type, conversations, draftMessages, loading, currentUserId, selectedId, onlineUserIds, onSelect, onClose,
}: QuickViewPanelProps) {
  const config = CONFIG[type];
  const Icon = config.icon;

  const items = type === 'favourites'
    ? conversations.filter((c) => c.isFavourite)
    : conversations.filter((c) => !!draftMessages[c.id]?.trim());

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', type === 'favourites' && 'fill-amber-500 text-amber-500')} />
          <h3 className="text-sm font-semibold">{config.title}</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessagesSquare className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium">{config.emptyTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">{config.emptyDescription}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((conversation) => {
              const display = getConversationDisplay(conversation, currentUserId);
              const isOtherOnline = conversation.type === 'dm' && conversation.members.some(
                (m) => m.id !== currentUserId && onlineUserIds?.has(m.id)
              );
              const draftText = draftMessages[conversation.id];
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors',
                    selectedId === conversation.id && 'bg-accent ring-1 ring-inset ring-ring/60'
                  )}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <Avatar className="h-9 w-9">
                      {display.avatarUrl && <AvatarImage src={display.avatarUrl} className="object-cover" />}
                      <AvatarFallback className="text-[10px]">{display.initials}</AvatarFallback>
                    </Avatar>
                    {conversation.type === 'dm' && (
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
                          isOtherOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                        )}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{display.name}</span>
                    {type === 'drafts' ? (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        <span className="font-medium text-foreground/70">Draft: </span>
                        {messagePreviewText(draftText)}
                      </p>
                    ) : conversation.lastMessage ? (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {messagePreviewText(conversation.lastMessage.content)}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
