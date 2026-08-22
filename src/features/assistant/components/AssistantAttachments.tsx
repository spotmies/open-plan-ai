import { useState } from 'react';
import { FileSpreadsheet, FileText, Paperclip, X } from 'lucide-react';
import { FilePreviewDialog, type FilePreviewTarget } from '@/components/FilePreviewDialog';
import { cn } from '@/lib/utils';

/** Matches Chat's own MessageInput cap — keeps the two attach experiences consistent. */
export const ASSISTANT_MAX_ATTACHMENTS = 10;

const SPREADSHEET_EXTENSIONS = ['xlsx', 'xls', 'csv'];

export function fileIconFor(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return SPREADSHEET_EXTENSIONS.includes(ext) ? FileSpreadsheet : FileText;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export interface AssistantAttachmentItem {
  key: string;
  name: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  /** Object URL (staged, not-yet-sent file) or the uploaded fileUrl — used both for the thumbnail and the full preview dialog. */
  previewUrl: string;
}

interface AssistantAttachmentGridProps {
  items: AssistantAttachmentItem[];
  onRemove?: (index: number) => void;
  align?: 'start' | 'end';
  /** Composer-only: shows a "+Add" tile after the thumbnails, hidden once maxFiles is reached. */
  onAddMore?: () => void;
  maxFiles?: number;
}

/** Thumbnail grid for Ask attachments (staged in the composer, or already sent) — click a thumbnail to open the same FilePreviewDialog used in Chat. */
export function AssistantAttachmentGrid({ items, onRemove, align = 'start', onAddMore, maxFiles }: AssistantAttachmentGridProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  const previewFiles: FilePreviewTarget[] = items.map((item) => ({
    url: item.previewUrl,
    fileName: item.name,
    mimeType: item.mimeType,
  }));

  return (
    <>
      <div className={cn('flex flex-wrap gap-2', align === 'end' && 'justify-end')}>
        {items.map((item, i) => {
          const isImage = item.mimeType?.startsWith('image/') ?? false;
          const isVideo = item.mimeType?.startsWith('video/') ?? false;
          const FileIcon = fileIconFor(item.name);
          return (
            <div
              key={item.key}
              className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
            >
              <button
                type="button"
                onClick={() => setPreviewIndex(i)}
                title={`Preview ${item.name}`}
                className="flex h-full w-full items-center justify-center"
              >
                {isImage && item.previewUrl ? (
                  <img src={item.previewUrl} alt={item.name} className="h-full w-full object-cover" />
                ) : isVideo && item.previewUrl ? (
                  <video src={item.previewUrl} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1.5">
                    <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-2 w-full break-all text-center text-[8px] leading-tight text-muted-foreground">
                      {item.name}
                    </span>
                  </div>
                )}
              </button>

              {item.sizeBytes != null && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/50 px-0.5 py-0.5 text-center text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {formatBytes(item.sizeBytes)}
                </div>
              )}

              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  title="Remove"
                  className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          );
        })}

        {onAddMore && (!maxFiles || items.length < maxFiles) && (
          <button
            type="button"
            onClick={onAddMore}
            title="Add more files"
            className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-border bg-muted/50 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Paperclip className="h-4 w-4" />
            <span className="text-[9px]">Add</span>
          </button>
        )}

        {onAddMore && maxFiles && (
          <div className="self-end pb-1 text-[10px] text-muted-foreground">
            {items.length}/{maxFiles}
          </div>
        )}
      </div>

      {previewIndex !== null && (
        <FilePreviewDialog
          file={previewFiles[previewIndex]}
          files={previewFiles}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
  );
}
