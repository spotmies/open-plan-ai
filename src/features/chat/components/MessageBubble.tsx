import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Copy, Pencil, Trash2, FileText, Download, Check, X, CheckCheck, MoreHorizontal, SmilePlus, Clock, Loader2, Reply, Forward, ZoomIn, FileImage, File as FileIcon2, Pin, PinOff, Bookmark, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FilePreviewDialog } from '@/components/FilePreviewDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { differenceInHours } from 'date-fns';
import { ChatMessage, ReadReceipt, MessageReaction, ChatEntityType, EntityTagRef } from '../types';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import { formatMessageTimestamp } from '@/utils/dateTime';
import EntityTagChip from './EntityTagChip';
import { HighlightedText } from './HighlightedText';

const ENTITY_TAG_ROUTE: Record<ChatEntityType, (tag: EntityTagRef) => string> = {
  task: (tag) => `/projects/${tag.projectId}/tasks/${tag.entityId}`,
  issue: (tag) => `/projects/${tag.projectId}/issues/${tag.entityId}`,
  milestone: (tag) => `/projects/${tag.projectId}/milestones/${tag.entityId}`,
  hardware_module: (tag) => `/projects/${tag.projectId}/modules/${tag.entityId}`,
  bom_node: (tag) => `/projects/${tag.projectId}/bom/${tag.entityId}`,
  eco: (tag) => `/projects/${tag.projectId}/eng-changes/${tag.entityId}`,
};

const EMOJI_SET = ['👍', '❤️', '😂', '😮', '🔥', '💯'];
// Mobile gets a wider quick-react row up front since the "more emoji" popover
// is a second tap away and hover-based discovery doesn't apply on touch.
const MOBILE_EMOJI_SET = [
  '👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '💯', '🎉', '🙏', '😍', '👎',
];
const EXTENDED_EMOJI_SET = [
  '👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '💯',
  '🎉', '🤔', '👀', '🙏', '💪', '✨', '🫡', '😍',
  '🥳', '😎', '🤣', '😅', '😡', '💔', '👎', '🤝',
];

// Detects http(s) URLs so message text can render them as clickable, blue links.
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

interface MessageBubbleProps {
  message: ChatMessage;
  showSenderInfo: boolean;
  showTimestamp: boolean;
  isGroupChat: boolean;
  currentUserId?: string;
  currentUserName?: string;
  searchQuery?: string;
  memberNames?: string[];
  reactionUsers?: Record<string, string>;
  readReceipts?: ReadReceipt[];
  otherMembersCount?: number;
  reactions?: MessageReaction[];
  isPinned?: boolean;
  isFavourited?: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string, senderName: string) => void;
  onDeleteForMe?: (messageId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void | Promise<void>;
  onReply?: (message: ChatMessage) => void;
  onForward?: (message: ChatMessage) => void;
  onTogglePin?: (messageId: string) => void;
  onToggleFavourite?: (messageId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
}

interface FileContent {
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath?: string;
  url?: string;
  text?: string;
}

function parseFileContent(content: string): FileContent | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.fileName && (parsed.storagePath || parsed.url)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function ExpandableText({ text, query, isOwn = false, memberNames, currentUserName }: { text: string; query?: string; isOwn?: boolean; memberNames?: string[]; currentUserName?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isLong = text.length > 300 || (text.match(/\n/g) || []).length > 5;

  const displayText = isLong && !isExpanded
    ? text.substring(0, 300) + (text.length > 300 ? '...' : '')
    : text;

  const renderText = (content: string) => {
    return content.split('\n').map((line, i) => (
      <span key={i}>
        <MentionHighlightedText text={line} query={query} isOwn={isOwn} memberNames={memberNames} currentUserName={currentUserName} />
        {i < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className="flex flex-col min-w-0">
      <div className={cn('whitespace-pre-wrap break-words', isLong && !isExpanded && 'line-clamp-6')}>
        {renderText(displayText)}
      </div>
      {isLong && (
        <button
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          className="text-xs opacity-80 hover:opacity-100 font-medium mt-1 self-start underline underline-offset-2"
        >
          {isExpanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

function MentionHighlightedText({ text, query, isOwn = false, memberNames, currentUserName }: { text: string; query?: string; isOwn?: boolean; memberNames?: string[]; currentUserName?: string }) {
  const currentUserNameLower = currentUserName?.trim().toLowerCase();
  // First pass: split out @everyone tokens (case-insensitive)
  const everyoneRegex = /(@everyone)(?=\s|$|[.,!?])/gi;
  const withEveryone: { text: string; isEveryone: boolean; isMention: boolean }[] = [];
  let lastEv = 0;
  let evMatch: RegExpExecArray | null;
  while ((evMatch = everyoneRegex.exec(text)) !== null) {
    if (evMatch.index > lastEv) {
      withEveryone.push({ text: text.slice(lastEv, evMatch.index), isEveryone: false, isMention: false });
    }
    withEveryone.push({ text: evMatch[1], isEveryone: true, isMention: false });
    lastEv = evMatch.index + evMatch[0].length;
  }
  if (lastEv < text.length) {
    withEveryone.push({ text: text.slice(lastEv), isEveryone: false, isMention: false });
  }
  if (withEveryone.length === 0) withEveryone.push({ text, isEveryone: false, isMention: false });

  // Second pass: within non-@everyone segments, detect individual @name mentions
  const parts: { text: string; isEveryone: boolean; isMention: boolean }[] = [];
  for (const seg of withEveryone) {
    if (seg.isEveryone) { parts.push(seg); continue; }
    const segText = seg.text;
    if (memberNames && memberNames.length > 0) {
      const sorted = [...memberNames].sort((a, b) => b.length - a.length);
      const escaped = sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const mentionRegex = new RegExp(`(@(?:${escaped.join('|')}))(?=\\s|$|[.,!?])`, 'g');
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = mentionRegex.exec(segText)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ text: segText.slice(lastIndex, match.index), isEveryone: false, isMention: false });
        }
        parts.push({ text: match[1], isEveryone: false, isMention: true });
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < segText.length) {
        parts.push({ text: segText.slice(lastIndex), isEveryone: false, isMention: false });
      }
    } else {
      // Fallback: match @Word or @Word Word (up to two words)
      const mentionRegex = /(@\w+(?:\s\w+)?)(?=\s|$|[.,!?])/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = mentionRegex.exec(segText)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ text: segText.slice(lastIndex, match.index), isEveryone: false, isMention: false });
        }
        parts.push({ text: match[1], isEveryone: false, isMention: true });
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < segText.length) {
        parts.push({ text: segText.slice(lastIndex), isEveryone: false, isMention: false });
      }
    }
  }

  if (parts.length === 0) parts.push({ text, isEveryone: false, isMention: false });

  return (
    <>
      {parts.map((part, i) => {
        if (part.isEveryone) {
          return (
            <span
              key={i}
              className={cn(
                'font-semibold rounded px-0.5',
                isOwn
                  ? 'bg-amber-300/30 text-amber-100'
                  : 'bg-amber-400/25 text-amber-700 dark:text-amber-400'
              )}
            >
              <HighlightedText text={part.text} query={query} />
            </span>
          );
        }
        if (part.isMention) {
          // Teams-style "you were mentioned" — the mentioned name matches the
          // viewer's own name, so it gets a distinct, always-bright highlight
          // regardless of which side of the conversation the bubble is on.
          const isSelfMention = !!currentUserNameLower && part.text.slice(1).toLowerCase() === currentUserNameLower;
          return (
            <span
              key={i}
              className={cn(
                'font-medium rounded px-0.5',
                isSelfMention
                  ? 'font-semibold bg-yellow-300/90 text-yellow-950 ring-1 ring-yellow-500/50 dark:bg-yellow-400/30 dark:text-yellow-200 dark:ring-yellow-400/40'
                  : isOwn
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-primary/20 text-primary'
              )}
            >
              <HighlightedText text={part.text} query={query} />
            </span>
          );
        }
        return <LinkifiedText key={i} text={part.text} query={query} isOwn={isOwn} />;
      })}
    </>
  );
}

function LinkifiedText({ text, query, isOwn = false }: { text: string; query?: string; isOwn?: boolean }) {
  // split() with a single-capture-group regex interleaves [text, url, text, url, ...] —
  // odd indices are always the captured URLs, so index parity (not re-testing the
  // stateful global regex) is what tells them apart.
  const segments = text.split(URL_REGEX);
  if (segments.length === 1) return <HighlightedText text={text} query={query} />;
  return (
    <>
      {segments.map((segment, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={segment}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'underline break-all hover:opacity-80 font-medium cursor-pointer',
              isOwn ? 'text-blue-100 dark:text-blue-800' : 'text-blue-500 dark:text-blue-400'
            )}
          >
            {segment}
          </a>
        ) : (
          <HighlightedText key={i} text={segment} query={query} />
        )
      )}
    </>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getFileType(mimeType: string, fileName: string): 'image' | 'pdf' | 'doc' | 'other' {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf' || fileName?.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (
    mimeType?.includes('word') ||
    mimeType?.includes('document') ||
    /\.(docx?|odt)$/i.test(fileName ?? '')
  ) return 'doc';
  return 'other';
}

function getFileIcon(type: 'image' | 'pdf' | 'doc' | 'other') {
  if (type === 'image') return FileImage;
  if (type === 'pdf' || type === 'doc') return FileText;
  return FileIcon2;
}

// ─── Image Lightbox ──────────────────────────────────────────────────────────

function ImageLightbox({
  src,
  alt,
  onClose,
  onForward,
}: {
  src: string;
  alt: string;
  onClose: () => void;
  onForward?: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent hideClose className="w-[95vw] h-[95vh] max-w-[95vw] max-h-[95vh] p-0 bg-black/90 border-none flex items-center justify-center overflow-hidden">
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain rounded"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="absolute top-3 right-3 z-50 flex items-center gap-2">
          {onForward && (
            <button
              onClick={onForward}
              className="rounded-full bg-black/50 p-1.5 text-white hover:bg-black/80 transition-colors"
              title="Forward this photo"
            >
              <Forward className="h-4 w-4" />
            </button>
          )}
          <a
            href={src}
            download={alt}
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

// ─── Main FileAttachment component ──────────────────────────────────────────

function FileAttachment({
  file,
  isOwn,
  message,
  onForward,
}: {
  file: FileContent;
  isOwn: boolean;
  message?: ChatMessage;
  onForward?: (message: ChatMessage) => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const url = file.url ?? '';
  const fileType = getFileType(file.mimeType ?? '', file.fileName ?? '');
  const Icon = getFileIcon(fileType);
  const handleClick = useCallback(() => {
    if (!url) return;
    if (fileType === 'image') {
      setLightboxOpen(true);
    } else {
      setPreviewOpen(true);
    }
  }, [url, fileType]);

  if (fileType === 'image') {
    return (
      <>
        <div
          className="group relative cursor-pointer rounded-xl overflow-hidden max-w-full"
          style={{ maxWidth: 280 }}
          onClick={handleClick}
          title="Click to view"
        >
          <img
            src={url}
            alt={file.fileName}
            className="w-full max-h-[220px] object-cover rounded-xl"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
          </div>
        </div>
        {file.text && <p className="text-sm mt-1 break-words">{file.text}</p>}
        {lightboxOpen && url && (
          <ImageLightbox
            src={url}
            alt={file.fileName}
            onClose={() => setLightboxOpen(false)}
            onForward={message && onForward ? () => { onForward(message); setLightboxOpen(false); } : undefined}
          />
        )}
      </>
    );
  }

  // PDF / DOC / other file card — small preview thumbnail above the filename,
  // with a dedicated preview action beside the name (opens the file in a modal
  // instead of triggering a raw browser download).
  const isPreviewable = fileType === 'pdf' || fileType === 'doc';
  return (
    <div
      className={cn(
        'w-full max-w-full rounded-xl border overflow-hidden',
        isOwn ? 'border-primary-foreground/20 bg-primary-foreground/5' : 'border-border bg-muted/30'
      )}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={!url}
        className={cn(
          'flex w-full items-center justify-center h-16 transition-colors',
          'hover:bg-accent/40 disabled:opacity-50 disabled:cursor-not-allowed',
          fileType === 'pdf' ? 'bg-red-500/10 text-red-500' :
            fileType === 'doc' ? 'bg-blue-500/10 text-blue-500' :
              'bg-muted text-muted-foreground'
        )}
        title={isPreviewable ? `Open ${fileType.toUpperCase()} preview` : 'Open file'}
      >
        <Icon className="h-7 w-7" />
      </button>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 border-t',
          isOwn ? 'border-primary-foreground/10' : 'border-border/60'
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{file.fileName}</p>
          <p className="text-xs opacity-60 mt-0.5">
            {file.fileSize ? formatFileSize(file.fileSize) : ''}
            {file.fileSize && fileType !== 'other' ? ' · ' : ''}
            {fileType === 'pdf' ? 'PDF' : fileType === 'doc' ? 'Document' : ''}
          </p>
        </div>
        {url && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setPreviewOpen(true); }}
            title="Preview"
            className="h-8 px-2.5 shrink-0 rounded-full flex items-center gap-1 opacity-80 hover:opacity-100 hover:bg-accent/70 transition-colors text-xs font-medium"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        )}
      </div>
      {previewOpen && url && (
        <FilePreviewDialog
          file={{ url, fileName: file.fileName ?? '', mimeType: file.mimeType }}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

export function MessageBubble({
  message, showSenderInfo, showTimestamp, isGroupChat, currentUserId, currentUserName,
  searchQuery, memberNames, reactionUsers, readReceipts, otherMembersCount, reactions,
  isPinned, isFavourited, onEdit, onDelete, onDeleteForMe, onToggleReaction, onReply, onForward, onTogglePin, onToggleFavourite, onJumpToMessage,
}: MessageBubbleProps) {
  const timezone = useUserTimezone();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isOwn = message.senderId === currentUserId;
  const isFile = message.contentType === 'file' || message.contentType === 'image' || (message.attachments?.length ?? 0) > 0;

  // Build fileData from new attachments[] array OR legacy JSON content
  const fileData: FileContent | null = (() => {
    // New format: attachments array from backend
    if (message.attachments?.length) {
      const a = message.attachments[0] as any;
      return {
        fileName: a.name ?? a.fileName ?? '',
        fileSize: a.size ?? a.fileSize ?? 0,
        mimeType: a.mimeType ?? a.type ?? '',
        url: a.url ?? '',
        text: message.contentType !== 'image' && message.contentType !== 'file' ? message.content : undefined,
      };
    }
    // Legacy format: JSON encoded in content
    if (message.contentType === 'file' || message.contentType === 'image') {
      const parsed = parseFileContent(message.content);
      if (parsed) return parsed;
    }
    return null;
  })();
  const isDeleted = !!message.deletedAt;
  const isWithin24h = differenceInHours(new Date(), new Date(message.createdAt)) < 24;
  const canModify = isOwn && isWithin24h && !isDeleted;

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const [isEditEmojiOpen, setIsEditEmojiOpen] = useState(false);

  // State-based hover + popover/dropdown management
  const [isHovered, setIsHovered] = useState(false);
  const [isMoreEmojiOpen, setIsMoreEmojiOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Touch devices don't fire hover reliably, so the toolbar is opened by tapping the bubble instead.
  const [isMobileToolbarOpen, setIsMobileToolbarOpen] = useState(false);

  const getReactorNames = useCallback((r: MessageReaction) => {
    return r.userIds.map((id) => {
      if (id === currentUserId) return 'You';
      return reactionUsers?.[id] ?? 'Unknown';
    });
  }, [currentUserId, reactionUsers]);

  // Toolbar stays visible while hovered/tapped OR any popover/dropdown is open
  const showToolbar = (isMobile ? isMobileToolbarOpen : isHovered) || isMoreEmojiOpen || isMenuOpen;

  const handleMouseEnter = () => {
    if (isMobile) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  const handleBubbleTap = () => {
    if (!isMobile) return;
    setIsMobileToolbarOpen((v) => !v);
  };

  const handleBubbleClick = () => {
    handleBubbleTap();
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const resizeEditTextarea = useCallback(() => {
    const el = editRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  useLayoutEffect(() => {
    if (isEditing) {
      editRef.current?.focus();
      resizeEditTextarea();
    }
  }, [isEditing, resizeEditTextarea]);

  const handleSaveEdit = () => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === message.content) {
      setIsEditing(false);
      setEditContent(message.content);
      return;
    }
    onEdit?.(message.id, trimmed);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  const handleInsertEditEmoji = (emoji: string) => {
    setEditContent((prev) => prev + emoji);
    setIsEditEmojiOpen(false);
    requestAnimationFrame(() => {
      editRef.current?.focus();
      resizeEditTextarea();
    });
  };

  const handleDeleteForEveryone = () => {
    onDelete?.(message.id, message.senderName);
    setShowDeleteConfirm(false);
  };

  const handleDeleteForMe = () => {
    onDeleteForMe?.(message.id);
    setShowDeleteConfirm(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Copied to clipboard');
  };

  const handleEmojiClick = (emoji: string) => {
    onToggleReaction?.(message.id, emoji);
    setIsMobileToolbarOpen(false);
  };

  const handleMoreEmojiClick = (emoji: string) => {
    onToggleReaction?.(message.id, emoji);
    setIsMoreEmojiOpen(false);
    setIsMobileToolbarOpen(false);
  };

  // When modifying a reaction via the pill picker, rely on backend replace logic
  const handleReactionReplace = async (emoji: string) => {
    onToggleReaction?.(message.id, emoji);
    setIsReactionPickerOpen(false);
  };

  // Blue double-check only once every other member has read it; grey double-check
  // covers "sent/delivered to all" (including partially-read) so partial reads don't
  // falsely look fully-read. Falls back to "any read = blue" if the member count is unknown.
  const renderStatusIcon = () => {
    const otherReads = (readReceipts ?? []).filter((r) => r.userId !== currentUserId);
    const allRead = otherReads.length > 0 && (otherMembersCount === undefined || otherReads.length >= otherMembersCount);
    if (allRead) {
      return <CheckCheck className="h-3 w-3 text-blue-500 dark:text-blue-400" aria-label="Read by everyone" />;
    }
    if (message.status === 'pending') {
      return <Clock className="h-3 w-3 text-muted-foreground" aria-label="Pending" />;
    }
    if (message.isOptimistic || message.status === 'sending') {
      return <Check className="h-3 w-3 text-muted-foreground" aria-label="Sending" />;
    }
    return <CheckCheck className="h-3 w-3 text-muted-foreground" aria-label="Sent" />;
  };

  // Deleted message display
  if (isDeleted) {
    return (
      <div className={cn('flex gap-2 px-4', isOwn ? 'flex-row-reverse' : 'flex-row')}>
        {isGroupChat && <div className="w-8 shrink-0" />}
        <div className={cn('flex flex-col max-w-[70%] min-w-0', isOwn ? 'items-end' : 'items-start')}>
          <div className="rounded-2xl px-3 py-2 text-sm italic text-muted-foreground bg-muted/50 border border-dashed border-border">
            🚫 This message was deleted by {message.deletedByName || message.senderName}
          </div>
          {showTimestamp && (
            <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
              {formatMessageTimestamp(message.createdAt, timezone)}
            </span>
          )}
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
              {message.senderAvatar && (
                <AvatarImage src={message.senderAvatar} alt={message.senderName} className="object-cover" />
              )}
              <AvatarFallback className="text-[10px]">{message.senderInitials}</AvatarFallback>
            </Avatar>
          )}
        </div>
      )}

      <div className={cn('flex flex-col max-w-[70%] min-w-0', isOwn ? 'items-end' : 'items-start')}>
        {showSenderInfo && !isOwn && isGroupChat && (
          <span className="text-xs text-muted-foreground font-medium mb-0.5 px-1">{message.senderName}</span>
        )}

        {/* Hover toolbar: emojis + more + 3-dot menu */}
        <div
          className="relative max-w-full min-w-0"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className={cn(
              'absolute z-10 w-max rounded-lg border border-border bg-popover shadow-md px-1 py-0.5 flex items-center flex-nowrap gap-0.5 transition-opacity',
              isMobile
                ? 'bottom-full mb-2 left-1/2 -translate-x-1/2 max-w-[88vw] justify-center'
                : cn('top-0', isOwn ? 'right-full mr-2' : 'left-full ml-2'),
              showToolbar ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick emoji reactions — mobile gets a wider set up front since there's no hover affordance */}
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



            {/* More emojis button */}
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

            {/* Divider */}
            <div className="w-px h-5 bg-border mx-0.5" />

            {/* 3-dot menu */}
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" title="More options">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align={isOwn ? 'end' : 'start'} className="min-w-[140px]">
                <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </DropdownMenuItem>
                {!isDeleted && (
                  <DropdownMenuItem onClick={() => onReply?.(message)} className="cursor-pointer">
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </DropdownMenuItem>
                )}
                {!isDeleted && onForward && (
                  <DropdownMenuItem onClick={() => onForward(message)} className="cursor-pointer">
                    <Forward className="h-4 w-4 mr-2" />
                    Forward
                  </DropdownMenuItem>
                )}
                {!isDeleted && onTogglePin && (
                  <DropdownMenuItem onClick={() => onTogglePin(message.id)} className="cursor-pointer">
                    {isPinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
                    {isPinned ? 'Unpin Message' : 'Pin Message'}
                  </DropdownMenuItem>
                )}
                {!isDeleted && onToggleFavourite && (
                  <DropdownMenuItem onClick={() => onToggleFavourite(message.id)} className="cursor-pointer">
                    <Bookmark className={cn('h-4 w-4 mr-2', isFavourited && 'fill-amber-500 text-amber-500')} />
                    {isFavourited ? 'Remove from Saved' : 'Save message'}
                  </DropdownMenuItem>
                )}
                {canModify && !isFile && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer">
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="cursor-pointer text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Message bubble content */}
          <div
            className={cn(
              'relative rounded-2xl px-3 py-2 text-sm leading-relaxed max-w-full min-w-0 overflow-hidden break-words [overflow-wrap:anywhere]',
              isMobile ? 'cursor-pointer' : 'cursor-text select-text',
              isOwn
                ? 'bg-primary text-primary-foreground rounded-br-md border border-primary/20'
                : 'bg-muted text-foreground rounded-bl-md border border-border'
            )}
            onClick={handleBubbleClick}
          >
            {message.replyToMessage && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (!message.replyToMessage!.deletedAt) onJumpToMessage?.(message.replyToMessage!.id);
                }}
                className={cn(
                  'mb-2 rounded-md border-l-2 px-2 py-1 text-xs',
                  !message.replyToMessage.deletedAt && 'cursor-pointer hover:brightness-95',
                  isOwn
                    ? 'border-primary-foreground/50 bg-primary-foreground/10'
                    : 'border-primary/40 bg-primary/10'
                )}
              >
                <div className="font-medium opacity-90">{message.replyToMessage.senderName}</div>
                <div className="opacity-80 truncate">
                  {message.replyToMessage.deletedAt
                    ? 'Message deleted'
                    : message.replyToMessage.contentType === 'file'
                      ? 'Attachment'
                      : message.replyToMessage.content}
                </div>
              </div>
            )}
            {isFile && fileData ? (
              <div onClick={(e) => e.stopPropagation()}>
                <FileAttachment file={fileData} isOwn={isOwn} message={message} onForward={onForward} />
              </div>
            ) : (
              <ExpandableText text={message.content} query={searchQuery} isOwn={isOwn} memberNames={memberNames} currentUserName={currentUserName} />
            )}
            {message.entityTags && message.entityTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                {message.entityTags.map((tag, i) => (
                  <EntityTagChip
                    key={`${tag.entityType}-${tag.entityId}-${i}`}
                    tag={tag}
                    variant="sent"
                    isOwn={isOwn}
                    onClick={() => navigate(ENTITY_TAG_ROUTE[tag.entityType](tag))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reaction pills — clicking opens picker to modify reaction */}
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
                              r.reactedByMe
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
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
                        reactions?.some((r) => r.emoji === emoji && r.reactedByMe)
                          ? 'bg-primary/20 ring-1 ring-primary'
                          : 'hover:bg-muted'
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
            {message.isEdited && <span>Edited</span>}
            {message.isEdited && <span>Edited</span>}
            {formatMessageTimestamp(message.createdAt, timezone)}
            {isOwn && renderStatusIcon()}
          </span>
        )}
        {!showTimestamp && (isOwn || message.isEdited) && (
          <span
            className={cn(
              'text-[10px] text-muted-foreground mt-0.5 px-1 flex items-center gap-1',
              isOwn ? 'justify-end' : 'justify-start'
            )}
          >
            {isPinned && <Pin className="h-2.5 w-2.5" aria-label="Pinned" />}
            {isFavourited && <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" aria-label="Favourited" />}
            {renderStatusIcon()}
          </span>
        )}
      </div>
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={canModify ? handleDeleteForEveryone : handleDeleteForMe}
        title="Delete message?"
        description={
          canModify
            ? 'Choose whether to remove this message just for you, or for everyone in the chat.'
            : 'This removes the message from your view only — other people in the chat will still see it.'
        }
        confirmText={canModify ? 'Delete for everyone' : 'Delete for me'}
        cancelText="Cancel"
        variant="destructive"
        extraActionText={canModify ? 'Delete for me' : undefined}
        onExtraAction={canModify ? handleDeleteForMe : undefined}
      />
      <Dialog open={isEditing} onOpenChange={(open) => { if (!open) handleCancelEdit(); }}>
        <DialogContent hideClose className="max-w-sm gap-0 overflow-hidden p-0">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <button
              type="button"
              onClick={handleCancelEdit}
              title="Close"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
            <DialogTitle className="text-base font-medium">Edit message</DialogTitle>
          </div>

          <div className="flex flex-col gap-3 p-4">
            {/* Live preview of the bubble being edited, same styling as the sent message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">
                {editContent || message.content}
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-primary-foreground/80">
                  {formatMessageTimestamp(message.createdAt, timezone)}
                  <CheckCheck className="h-3 w-3" />
                </div>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <Textarea
                ref={editRef}
                value={editContent}
                onChange={(e) => { setEditContent(e.target.value); resizeEditTextarea(); }}
                className="min-h-[36px] max-h-[160px] flex-1 resize-none rounded-lg border-0 border-b-2 border-border bg-transparent px-1 py-1.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
              <Popover open={isEditEmojiOpen} onOpenChange={setIsEditEmojiOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full text-muted-foreground" title="Emoji">
                    <SmilePlus className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" side="top" align="end">
                  <div className="grid grid-cols-8 gap-1">
                    {EXTENDED_EMOJI_SET.map((emoji) => (
                      <button
                        key={emoji}
                        className="text-lg hover:bg-muted rounded p-1 transition-colors cursor-pointer leading-none"
                        onClick={() => handleInsertEditEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <button
                type="button"
                title="Save"
                onClick={handleSaveEdit}
                disabled={!editContent.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
