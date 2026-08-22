import { Phone, PhoneMissed, Video, VideoOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatMessageTimestamp } from '@/utils/dateTime';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import type { ChatMessage } from '../types';
import { callCardPreviewText, formatCallDuration, type CallCardContent } from '../utils/callCard';

interface CallHistoryCardProps {
  message: ChatMessage;
  content: CallCardContent;
  isGroupChat: boolean;
  currentUserId?: string;
}

function getCallCardText(content: CallCardContent): { title: string; subtitle: string | null } {
  const { status, durationSec, initiatorName } = content;
  const title = callCardPreviewText(content);

  if (status === 'ongoing') return { title, subtitle: null };
  if (status === 'completed') return { title, subtitle: formatCallDuration(durationSec) };
  return { title, subtitle: `started by ${initiatorName}` };
}

/** WhatsApp-style call-history bubble — a system-generated message sent automatically by whoever starts the call. */
export function CallHistoryCard({ message, content, isGroupChat, currentUserId }: CallHistoryCardProps) {
  const timezone = useUserTimezone();
  const isOwn = message.senderId === currentUserId;
  const { callType, status } = content;
  const isMissed = status === 'missed';
  const { title, subtitle } = getCallCardText(content);

  const Icon = isMissed ? (callType === 'video' ? VideoOff : PhoneMissed) : callType === 'video' ? Video : Phone;

  return (
    <div className={cn('flex gap-2 px-4 py-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {isGroupChat && (
        <div className="w-8 shrink-0">
          {!isOwn && (
            <Avatar className="h-8 w-8">
              {message.senderAvatar && (
                <AvatarImage src={message.senderAvatar} alt={message.senderName} className="object-cover" />
              )}
              <AvatarFallback className="text-[10px]">{message.senderInitials}</AvatarFallback>
            </Avatar>
          )}
        </div>
      )}

      <div className={cn('flex flex-col max-w-[70%] min-w-0', isOwn ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-2xl px-3 py-2.5 min-w-[200px] shadow-sm',
            isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground border border-border/60',
          )}
        >
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
              isMissed
                ? 'bg-destructive/20 text-destructive'
                : isOwn
                  ? 'bg-primary-foreground/15 text-primary-foreground'
                  : 'bg-primary/10 text-primary',
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{title}</span>
            {subtitle && (
              <span className={cn('block text-xs', isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {subtitle}
              </span>
            )}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
          {formatMessageTimestamp(message.createdAt, timezone)}
        </span>
      </div>
    </div>
  );
}
