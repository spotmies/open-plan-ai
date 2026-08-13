import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OnlineStatus } from './OnlineStatus';
import { UnreadBadge } from './UnreadBadge';
import { Clock, MoreHorizontal, Star, Bell, BellOff, CheckCheck, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Conversation } from '../types';
import { messagePreviewText } from '../chat.mappers';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNowStrict } from 'date-fns';
import { HighlightedText } from './HighlightedText';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  unreadCount: number;
  onClick: () => void;
  onlineUserIds?: Set<string>;
  onToggleFavourite?: () => void;
  onToggleMute?: () => void;
  onMarkRead?: () => void;
  onDeleteChat?: () => void;
  searchQuery?: string;
}

export function ConversationItem({
  conversation, isActive, unreadCount, onClick, onlineUserIds,
  onToggleFavourite, onToggleMute, onMarkRead, onDeleteChat, searchQuery,
}: ConversationItemProps) {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isSelfChat = conversation.type === 'dm' && conversation.members.every((m) => m.id === currentUserId);
  const otherMember = conversation.type === 'dm'
    ? conversation.members.find((m) => m.id !== currentUserId) ?? (isSelfChat ? conversation.members[0] : undefined)
    : null;
  const isOtherOnline = otherMember ? onlineUserIds?.has(otherMember.id) ?? false : false;
  const notificationsEnabled = conversation.members.find((m) => m.id === currentUserId)?.notificationsEnabled ?? true;

  const displayName = conversation.type === 'dm'
    ? (isSelfChat ? `${otherMember?.name || 'You'} (You)` : otherMember?.name || conversation.name)
    : conversation.name;
  const initials = conversation.type === 'dm'
    ? otherMember?.initials || '??'
    : conversation.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const isEmoji = (str: string) => {
    const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
    return emojiRegex.test(str) && str.length <= 8;
  };

  const timeAgo = conversation.lastMessage
    ? formatDistanceToNowStrict(new Date(conversation.lastMessage.createdAt), { addSuffix: false })
      .replace(' seconds', 's').replace(' second', 's')
      .replace(' minutes', 'm').replace(' minute', 'm')
      .replace(' hours', 'h').replace(' hour', 'h')
      .replace(' days', 'd').replace(' day', 'd')
    : '';

  const avatarUrl = conversation.type === 'dm' ? otherMember?.avatarUrl : conversation.avatarUrl;
  const showActionsMenu = Boolean(onToggleFavourite || onToggleMute || onMarkRead || onDeleteChat);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={cn(
        'group flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-md transition-colors overflow-hidden cursor-pointer',
        isActive ? 'bg-accent' : 'hover:bg-accent/50'
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-9 w-9">
          {avatarUrl && !isEmoji(avatarUrl) && (
            <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />
          )}
          <AvatarFallback className={cn('text-xs font-medium', conversation.type === 'group' && 'bg-primary/10 text-primary')}>
            {isEmoji(avatarUrl || '') ? avatarUrl : initials}
          </AvatarFallback>
        </Avatar>
        {conversation.type === 'dm' && otherMember && (
          <OnlineStatus isOnline={isOtherOnline} className="absolute -bottom-0.5 -right-0.5" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={cn('text-sm truncate', unreadCount > 0 ? 'font-semibold' : 'font-medium')}>
            <HighlightedText text={displayName} query={searchQuery} />
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{timeAgo}</span>
        </div>
        {conversation.lastMessage && (
          <p className={cn('text-xs truncate mt-0.5', unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground')}>
            {conversation.lastMessage.senderId === currentUserId
              ? 'You: '
              : conversation.type === 'group' && conversation.lastMessage.senderName && `${conversation.lastMessage.senderName}: `}
            {messagePreviewText(conversation.lastMessage.content)}
            {conversation.lastMessage.status === 'pending' && (
              <Clock className="inline-block h-3 w-3 ml-1 text-muted-foreground" />
            )}
          </p>
        )}
      </div>

      <UnreadBadge count={unreadCount} />

      {showActionsMenu && (
        <div
          className={cn('shrink-0 transition-opacity', isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="More options"
                className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              {onToggleFavourite && (
                <DropdownMenuItem onClick={onToggleFavourite} className="cursor-pointer">
                  <Star className={cn('h-4 w-4 mr-2', conversation.isFavourite && 'fill-amber-500 text-amber-500')} />
                  {conversation.isFavourite ? 'Remove from Favourites' : 'Add to Favourites'}
                </DropdownMenuItem>
              )}
              {onToggleMute && (
                <DropdownMenuItem onClick={onToggleMute} className="cursor-pointer">
                  {notificationsEnabled ? <BellOff className="h-4 w-4 mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
                  {notificationsEnabled ? 'Mute notifications' : 'Unmute notifications'}
                </DropdownMenuItem>
              )}
              {onMarkRead && unreadCount > 0 && (
                <DropdownMenuItem onClick={onMarkRead} className="cursor-pointer">
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Mark as read
                </DropdownMenuItem>
              )}
              {onDeleteChat && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteConfirm(true)}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete chat
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {onDeleteChat && (
        <ConfirmationDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          onConfirm={onDeleteChat}
          title="Delete chat?"
          description="This removes the chat from your list only — nothing is deleted for other members, and it'll reappear if a new message arrives."
          confirmText="Delete chat"
          variant="destructive"
        />
      )}
    </div>
  );
}
