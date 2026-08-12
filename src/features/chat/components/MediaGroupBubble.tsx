import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Download, Check, X, CheckCheck, MoreHorizontal, SmilePlus, Clock, Reply, Forward, ChevronLeft, ChevronRight, Trash2, Pin, PinOff, Bookmark } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChatMessage, ReadReceipt, MessageReaction } from '../types';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import { formatMessageTimestamp } from '@/utils/dateTime';

const EMOJI_SET = ['👍', '❤️', '😂', '😮', '🔥', '💯'];
const MOBILE_EMOJI_SET = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '💯', '🎉', '🙏', '😍', '👎'];
const EXTENDED_EMOJI_SET = [
  '👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '💯',
  '🎉', '🤔', '👀', '🙏', '💪', '✨', '🫡', '😍',
  '🥳', '😎', '🤣', '😅', '😡', '💔', '👎', '🤝',
];

const MAX_VISIBLE_TILES = 4;

interface MediaGroupBubbleProps {
  messages: ChatMessage[];
  showSenderInfo: boolean;
  showTimestamp: boolean;
  isGroupChat: boolean;
  currentUserId?: string;
  readReceipts?: ReadReceipt[];
  otherMembersCount?: number;
  reactions?: MessageReaction[];
  reactionUsers?: Record<string, string>;
  isPinned?: boolean;
  isFavourited?: boolean;
  onDelete?: (messageId: string, senderName: string) => void;
  onDeleteForMe?: (messageId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void | Promise<void>;
  onReply?: (message: ChatMessage) => void;
  onForward?: (messages: ChatMessage[]) => void;
  onTogglePin?: (messageId: string) => void;
  onToggleFavourite?: (messageId: string) => void;
}

function getImageUrl(message: ChatMessage): { url: string; name: string } {
  if (message.attachments?.length) {
    const a = message.attachments[0] as any;
    return { url: a.url ?? '', name: a.name ?? a.fileName ?? message.content };
  }
  try {
    const parsed = JSON.parse(message.content);
    if (parsed.fileName && (parsed.storagePath || parsed.url)) {
      return { url: parsed.url ?? '', name: parsed.fileName };
    }
  } catch {
    // legacy content wasn't JSON — fall through
  }
  return { url: '', name: message.content };
}

// ─── Lightbox with prev/next navigation across the group ────────────────────

function GroupLightbox({
  images,
  messages,
  startIndex,
  onClose,
  onForward,
}: {
  images: { url: string; name: string }[];
  messages: ChatMessage[];
  startIndex: number;
  onClose: () => void;
  onForward?: (message: ChatMessage) => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const current = images[index];

  const goPrev = useCallback(() => setIndex((i) => (i - 1 + images.length) % images.length), [images.length]);
  const goNext = useCallback(() => setIndex((i) => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent hideClose className="w-[95vw] h-[95vh] max-w-[95vw] max-h-[95vh] p-0 bg-black/90 border-none flex items-center justify-center overflow-hidden">
        {images.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-50 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/80 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-50 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/80 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute top-3 left-3 z-50 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">
              {index + 1} / {images.length}
            </div>
          </>
        )}
        <img
          src={current.url}
          alt={current.name}
          className="max-w-full max-h-full object-contain rounded"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="absolute top-3 right-3 z-50 flex items-center gap-2">
          {onForward && (
            <button
              onClick={() => { onForward(messages[index]); onClose(); }}
              className="rounded-full bg-black/50 p-1.5 text-white hover:bg-black/80 transition-colors"
              title="Forward this photo"
            >
              <Forward className="h-4 w-4" />
            </button>
          )}
          <a
            href={current.url}
            download={current.name}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-black/50 p-1.5 text-white hover:bg-black/80 transition-colors"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </a>
          <button
            onClick={onClose}
            className="rounded-full bg-black/50 p-1.5 text-white hover:bg-black/80 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Grid layout helpers (WhatsApp/Telegram-style album) ─────────────────────

function gridClass(count: number): string {
  return count === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2';
}

function tileClass(index: number, count: number): string {
  if (count === 3 && index === 0) return 'row-span-2';
  return '';
}

export function MediaGroupBubble({
  messages, showSenderInfo, showTimestamp, isGroupChat, currentUserId,
  readReceipts, otherMembersCount, reactions, reactionUsers, isPinned, isFavourited,
  onDelete, onDeleteForMe, onToggleReaction, onReply, onForward, onTogglePin, onToggleFavourite,
}: MediaGroupBubbleProps) {
  const timezone = useUserTimezone();
  const isMobile = useIsMobile();
  const first = messages[0];
  const last = messages[messages.length - 1];
  const isOwn = first.senderId === currentUserId;

  const images = messages.map((m) => getImageUrl(m));
  const visible = images.slice(0, MAX_VISIBLE_TILES);
  const hiddenCount = images.length - MAX_VISIBLE_TILES;
  const containerAspect = visible.length === 2 ? 'aspect-[2/1]' : 'aspect-square';

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isMoreEmojiOpen, setIsMoreEmojiOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [isMobileToolbarOpen, setIsMobileToolbarOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const showToolbar = (isMobile ? isMobileToolbarOpen : isHovered) || isMoreEmojiOpen || isMenuOpen;

  const isDeleted = messages.every((m) => !!m.deletedAt);
  const canModify = isOwn; // images have no 24h edit window relevance (no edit action offered)

  const handleEmojiClick = (emoji: string) => {
    onToggleReaction?.(last.id, emoji);
    setIsMobileToolbarOpen(false);
  };
  const handleMoreEmojiClick = (emoji: string) => {
    onToggleReaction?.(last.id, emoji);
    setIsMoreEmojiOpen(false);
    setIsMobileToolbarOpen(false);
  };
  const handleReactionReplace = (emoji: string) => {
    onToggleReaction?.(last.id, emoji);
    setIsReactionPickerOpen(false);
  };
  const handleDeleteAllForEveryone = () => {
    messages.forEach((m) => onDelete?.(m.id, m.senderName));
    setShowDeleteConfirm(false);
  };

  const handleDeleteAllForMe = () => {
    messages.forEach((m) => onDeleteForMe?.(m.id));
    setShowDeleteConfirm(false);
  };

  const getReactorNames = useCallback((r: MessageReaction) => {
    return r.userIds.map((id) => {
      if (id === currentUserId) return 'You';
      return reactionUsers?.[id] ?? 'Unknown';
    });
  }, [currentUserId, reactionUsers]);

  const renderStatusIcon = () => {
    const otherReads = (readReceipts ?? []).filter((r) => r.userId !== currentUserId);
    const allRead = otherReads.length > 0 && (otherMembersCount === undefined || otherReads.length >= otherMembersCount);
    if (allRead) return <CheckCheck className="h-3 w-3 text-blue-500 dark:text-blue-400" aria-label="Read by everyone" />;
    if (last.status === 'pending') return <Clock className="h-3 w-3 text-muted-foreground" aria-label="Pending" />;
    if (last.isOptimistic || last.status === 'sending') return <Check className="h-3 w-3 text-muted-foreground" aria-label="Sending" />;
    return <CheckCheck className="h-3 w-3 text-muted-foreground" aria-label="Sent" />;
  };

  if (isDeleted) {
    return (
      <div className={cn('flex gap-2 px-4', isOwn ? 'flex-row-reverse' : 'flex-row')}>
        {isGroupChat && <div className="w-8 shrink-0" />}
        <div className={cn('flex flex-col max-w-[70%] min-w-0', isOwn ? 'items-end' : 'items-start')}>
          <div className="rounded-2xl px-3 py-2 text-sm italic text-muted-foreground bg-muted/50 border border-dashed border-border">
            🚫 {messages.length} photos were deleted by {first.deletedByName || first.senderName}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2 px-4', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {isGroupChat && (
        <div className="w-8 shrink-0">
          {showSenderInfo && !isOwn && (
            <Avatar className="h-8 w-8">
              {first.senderAvatar && <AvatarImage src={first.senderAvatar} alt={first.senderName} className="object-cover" />}
              <AvatarFallback className="text-[10px]">{first.senderInitials}</AvatarFallback>
            </Avatar>
          )}
        </div>
      )}

      <div className={cn('flex flex-col max-w-[70%] min-w-0', isOwn ? 'items-end' : 'items-start')}>
        {showSenderInfo && !isOwn && isGroupChat && (
          <span className="text-xs text-muted-foreground font-medium mb-0.5 px-1">{first.senderName}</span>
        )}

        <div
          className="relative"
          onMouseEnter={() => !isMobile && setIsHovered(true)}
          onMouseLeave={() => !isMobile && setIsHovered(false)}
        >
          <div
            className={cn(
              'absolute z-10 w-max rounded-lg border border-border bg-popover shadow-md px-1 py-0.5 flex items-center flex-nowrap gap-0.5 transition-opacity',
              isMobile
                ? 'bottom-full mb-2 left-1/2 -translate-x-1/2 max-w-[88vw] justify-center'
                : cn('top-0', isOwn ? 'right-full mr-2' : 'left-full ml-2'),
              showToolbar ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            )}
            onMouseEnter={() => !isMobile && setIsHovered(true)}
            onMouseLeave={() => !isMobile && setIsHovered(false)}
            onClick={(e) => e.stopPropagation()}
          >
            {(isMobile ? MOBILE_EMOJI_SET : EMOJI_SET).map((emoji) => (
              <button
                key={emoji}
                className="text-base hover:bg-muted rounded p-1 transition-colors cursor-pointer leading-none"
                title={emoji}
                onClick={() => handleEmojiClick(emoji)}
              >
                {emoji}
              </button>
            ))}

            <Popover open={isMoreEmojiOpen} onOpenChange={setIsMoreEmojiOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="More reactions">
                  <SmilePlus className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" side="top" align="center">
                <div className="grid grid-cols-8 gap-1">
                  {EXTENDED_EMOJI_SET.map((emoji) => (
                    <button
                      key={emoji}
                      className="text-lg hover:bg-muted rounded p-1 transition-colors cursor-pointer leading-none"
                      onClick={() => handleMoreEmojiClick(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <div className="w-px h-5 bg-border mx-0.5" />

            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="More options">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align={isOwn ? 'end' : 'start'} className="min-w-[160px]">
                <DropdownMenuItem onClick={() => onReply?.(first)} className="cursor-pointer">
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </DropdownMenuItem>
                {onForward && (
                  <DropdownMenuItem onClick={() => onForward(messages)} className="cursor-pointer">
                    <Forward className="h-4 w-4 mr-2" />
                    Forward{messages.length > 1 ? ` ${messages.length} Photos` : ''}
                  </DropdownMenuItem>
                )}
                {onTogglePin && (
                  <DropdownMenuItem onClick={() => onTogglePin(last.id)} className="cursor-pointer">
                    {isPinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
                    {isPinned ? 'Unpin' : 'Pin'}
                  </DropdownMenuItem>
                )}
                {onToggleFavourite && (
                  <DropdownMenuItem onClick={() => onToggleFavourite(last.id)} className="cursor-pointer">
                    <Bookmark className={cn('h-4 w-4 mr-2', isFavourited && 'fill-amber-500 text-amber-500')} />
                    {isFavourited ? 'Remove from Saved' : 'Save message'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="cursor-pointer text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {messages.length > 1 ? `${messages.length} photos` : 'photo'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div
            className={cn('grid gap-0.5 w-[260px] max-w-full rounded-2xl overflow-hidden', containerAspect, gridClass(visible.length))}
            onClick={() => !isMobile ? undefined : setIsMobileToolbarOpen((v) => !v)}
          >
            {visible.map((img, i) => {
              const isLastVisibleWithMore = hiddenCount > 0 && i === visible.length - 1;
              return (
                <button
                  key={messages[i].id}
                  type="button"
                  className={cn('relative group w-full h-full overflow-hidden', tileClass(i, visible.length))}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  title="Click to view"
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  {isLastVisibleWithMore && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-lg font-semibold">+{hiddenCount}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {lightboxIndex !== null && (
            <GroupLightbox
              images={images}
              messages={messages}
              startIndex={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
              onForward={onForward ? (message) => onForward([message]) : undefined}
            />
          )}
        </div>

        {reactions && reactions.length > 0 && (
          <div className={cn('flex flex-wrap gap-1 mt-1 px-1', isOwn ? 'justify-end' : 'justify-start')}>
            <Popover open={isReactionPickerOpen} onOpenChange={setIsReactionPickerOpen}>
              <PopoverTrigger asChild>
                <div className="flex flex-wrap gap-1 cursor-pointer">
                  {reactions.map((r) => {
                    const names = getReactorNames(r);
                    return (
                      <Tooltip key={r.emoji} delayDuration={200}>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors',
                              r.reactedByMe ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
                            )}
                          >
                            <span>{r.emoji}</span>
                            <span>{r.count}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{names.join(', ')}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" side="top" align="center">
                <div className="flex flex-wrap gap-1 max-w-[220px]">
                  {(isMobile ? MOBILE_EMOJI_SET : EMOJI_SET).map((emoji) => (
                    <button
                      key={emoji}
                      className={cn(
                        'text-lg rounded p-1 transition-colors cursor-pointer',
                        reactions?.some((r) => r.emoji === emoji && r.reactedByMe) ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-muted'
                      )}
                      onClick={() => handleReactionReplace(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {showTimestamp && (
          <span className="text-[10px] text-muted-foreground mt-0.5 px-1 flex items-center gap-1">
            {isPinned && <Pin className="h-2.5 w-2.5" aria-label="Pinned" />}
            {isFavourited && <Bookmark className="h-2.5 w-2.5 fill-amber-500 text-amber-500" aria-label="Saved" />}
            {formatMessageTimestamp(last.createdAt, timezone)}
            {isOwn && renderStatusIcon()}
          </span>
        )}
        {!showTimestamp && isOwn && (
          <span className="text-[10px] mt-0.5 px-1 flex items-center justify-end gap-1">
            {isPinned && <Pin className="h-2.5 w-2.5" aria-label="Pinned" />}
            {isFavourited && <Bookmark className="h-2.5 w-2.5 fill-amber-500 text-amber-500" aria-label="Saved" />}
            {renderStatusIcon()}
          </span>
        )}
      </div>

      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={canModify ? handleDeleteAllForEveryone : handleDeleteAllForMe}
        title={messages.length > 1 ? `Delete ${messages.length} photos?` : 'Delete photo?'}
        description={
          canModify
            ? 'Choose whether to remove these just for you, or for everyone in the chat.'
            : 'This removes the photos from your view only — other people in the chat will still see them.'
        }
        confirmText={canModify ? 'Delete for everyone' : 'Delete for me'}
        cancelText="Cancel"
        variant="destructive"
        extraActionText={canModify ? 'Delete for me' : undefined}
        onExtraAction={canModify ? handleDeleteAllForMe : undefined}
      />
    </div>
  );
}
