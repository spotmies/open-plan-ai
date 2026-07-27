import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OnlineStatus } from './OnlineStatus';
import { UnreadBadge } from './UnreadBadge';
import { Clock } from 'lucide-react';
import { Conversation } from '../types';
import { messagePreviewText } from '../chat.mappers';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNowStrict } from 'date-fns';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  unreadCount: number;
  onClick: () => void;
  onlineUserIds?: Set<string>;
}

export function ConversationItem({ conversation, isActive, unreadCount, onClick, onlineUserIds }: ConversationItemProps) {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const isSelfChat = conversation.type === 'dm' && conversation.members.every((m) => m.id === currentUserId);
  const otherMember = conversation.type === 'dm'
    ? conversation.members.find((m) => m.id !== currentUserId) ?? (isSelfChat ? conversation.members[0] : undefined)
    : null;
  const isOtherOnline = otherMember ? onlineUserIds?.has(otherMember.id) ?? false : false;

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

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-md transition-colors overflow-hidden',
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
            {displayName}
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
    </button>
  );
}
