import { useEffect, useState } from 'react';
import { Pin, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PinnedMessage } from '../types';

interface PinnedBannerProps {
  pinnedMessages: PinnedMessage[];
  onUnpin: (messageId: string) => void;
  onShowAll: () => void;
}

function previewText(message: PinnedMessage): string {
  if (message.deletedAt) return 'This message was deleted';
  if (message.contentType === 'image') return message.content?.trim() || 'Photo';
  if (message.contentType === 'file') return message.content?.trim() || 'Attachment';
  return message.content;
}

/** WhatsApp-style pinned bar: sticks to the top of the message area, cycling through active pins. */
export function PinnedBanner({ pinnedMessages, onUnpin, onShowAll }: PinnedBannerProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= pinnedMessages.length) setIndex(0);
  }, [pinnedMessages.length, index]);

  if (pinnedMessages.length === 0) return null;

  const current = pinnedMessages[index];

  const handleJump = () => {
    document.getElementById(`msg-${current.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const cycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i + 1) % pinnedMessages.length);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/40">
      <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
      <button
        type="button"
        onClick={handleJump}
        className="flex-1 min-w-0 text-left"
        title="Jump to pinned message"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-primary shrink-0">
            {pinnedMessages.length > 1 ? `Pinned message ${index + 1}/${pinnedMessages.length}` : 'Pinned message'}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">· {current.senderName}</span>
        </div>
        <p className={cn('text-xs text-foreground truncate', current.deletedAt && 'italic text-muted-foreground')}>
          {previewText(current)}
        </p>
      </button>

      {pinnedMessages.length > 1 && (
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={cycle} title="Next pinned message">
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-[11px] px-2 shrink-0"
        onClick={(e) => { e.stopPropagation(); onShowAll(); }}
      >
        See all
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={(e) => { e.stopPropagation(); onUnpin(current.id); }}
        title="Unpin this message"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
