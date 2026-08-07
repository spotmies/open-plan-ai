import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Pencil, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AssistantMarkdown } from './AssistantMarkdown';
import { fileIconFor } from './AssistantComposer';
import type { AiMessageAttachment } from '../assistantData';
import type { MessageVersionInfo } from '../lib/messageBranches';

interface AssistantMessageBubbleProps {
  id?: string;
  parentId?: string | null;
  role: 'user' | 'assistant';
  content: string;
  attachments?: AiMessageAttachment[] | null;
  versionInfo?: MessageVersionInfo;
  onEdit?: (messageId: string, content: string) => void;
  onSelectVersion?: (parentId: string | null, messageId: string) => void;
  disabled?: boolean;
  /**
   * 'compact' renders assistant prose in a bounded card-like box instead of
   * an open chat bubble — used when this turn made tool calls (so the
   * answer is data-grounded) but didn't produce a full present_card, e.g.
   * because there wasn't enough structured data for one. Never applies to
   * user messages.
   */
  variant?: 'bubble' | 'compact';
}

function VersionNav({
  versionInfo,
  parentId,
  onSelectVersion,
  disabled,
}: {
  versionInfo: MessageVersionInfo;
  parentId: string | null;
  onSelectVersion: (parentId: string | null, messageId: string) => void;
  disabled?: boolean;
}) {
  const { index, count, siblingIds } = versionInfo;
  return (
    <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
      <button
        type="button"
        title="Previous version"
        disabled={disabled || index === 0}
        onClick={() => onSelectVersion(parentId, siblingIds[index - 1])}
        className="rounded p-0.5 transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="tabular-nums">
        {index + 1}/{count}
      </span>
      <button
        type="button"
        title="Next version"
        disabled={disabled || index === count - 1}
        onClick={() => onSelectVersion(parentId, siblingIds[index + 1])}
        className="rounded p-0.5 transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AssistantMessageBubble({
  id,
  parentId = null,
  role,
  content,
  attachments,
  versionInfo,
  onEdit,
  onSelectVersion,
  disabled,
  variant = 'bubble',
}: AssistantMessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }, [isEditing, draft]);

  // Neither of these is a real persisted message yet — nothing to edit,
  // switch versions on, or copy meaningfully until it lands.
  const isOptimistic = !id || id.startsWith('optimistic-');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard');
    } catch {
      toast.error("Couldn't copy — try again.");
    }
  };

  const startEdit = () => {
    setDraft(content);
    setIsEditing(true);
  };

  const saveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === content) {
      setIsEditing(false);
      return;
    }
    onEdit?.(id as string, trimmed);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  if (role === 'user') {
    if (isEditing) {
      return (
        <div className="flex flex-col items-end gap-1.5">
          <div className="w-full max-w-[80%] rounded-2xl rounded-tr-sm border border-primary bg-background p-2">
            <textarea
              ref={textareaRef}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="max-h-60 w-full resize-none bg-transparent text-sm text-foreground focus:outline-none"
            />
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={!draft.trim()}
                className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                Save
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="group flex flex-col items-end gap-1">
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {attachments.map((attachment) => {
              const FileIcon = fileIconFor(attachment.fileName);
              return (
                <div
                  key={attachment.id}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs"
                >
                  <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="max-w-[160px] truncate font-medium text-foreground">{attachment.fileName}</span>
                </div>
              );
            })}
          </div>
        )}
        {content && (
          <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            {content}
          </div>
        )}
        {!isOptimistic && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {versionInfo && onSelectVersion && (
              <VersionNav versionInfo={versionInfo} parentId={parentId} onSelectVersion={onSelectVersion} disabled={disabled} />
            )}
            {onEdit && (
              <button
                type="button"
                title="Edit message"
                disabled={disabled}
                onClick={startEdit}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              title="Copy message"
              onClick={handleCopy}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  const isCompact = variant === 'compact';

  return (
    <div className="group flex items-start gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className={cn('flex min-w-0 flex-col items-start gap-1', isCompact ? 'flex-1' : 'max-w-[80%]')}>
        <AssistantMarkdown
          content={content}
          className={cn(
            'text-foreground',
            isCompact
              ? 'w-full rounded-lg border border-border bg-card px-3.5 py-3'
              : 'rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5',
          )}
        />
        {!isOptimistic && (
          <button
            type="button"
            title="Copy message"
            onClick={handleCopy}
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
