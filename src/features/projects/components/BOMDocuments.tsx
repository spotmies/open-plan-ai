import { useRef, useState } from 'react';
import {
  FileText, Box, Cpu, ImageIcon, File, Upload, Download,
  Eye, Trash2, Plus, Loader2, AlertCircle, X,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { resolveFileUrl } from '@/utils/fileUrl';
import { FilePreviewDialog, FilePreviewTarget } from '@/components/FilePreviewDialog';
import { useBomDocuments, useUploadBomDocument, useDeleteBomDocument, BomAttachment, isImageAttachment } from '@/hooks/useBomDocuments';

// ── Icon by MIME type / extension ────────────────────────────────────
function fileIcon(doc: Pick<BomAttachment, 'mimeType' | 'fileName' | 'fileUrl'>): React.ElementType {
  if (isImageAttachment(doc)) return ImageIcon;
  if (doc.mimeType === 'application/pdf') return FileText;
  const ext = (doc.fileName || doc.fileUrl || '').split('.').pop()?.toLowerCase().split(/[?#]/)[0] ?? '';
  if (['step', 'stp', 'iges', 'igs', 'stl'].includes(ext)) return Box;
  if (['kicad_mod', 'kicad_pcb', 'lib', 'lbr'].includes(ext)) return Cpu;
  return File;
}

// Linked documents can be created without a fileName — fall back to the URL's last path segment.
function displayName(doc: Pick<BomAttachment, 'fileName' | 'fileUrl'>): string {
  if (doc.fileName) return doc.fileName;
  return doc.fileUrl?.split('/').pop()?.split(/[?#]/)[0] || 'Untitled';
}

function formatBytes(b: number | null) {
  if (b == null) return 'Linked';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Single attachment row ──────────────────────────────────────────
function AttachmentRow({
  doc,
  onDelete,
  deleting,
  onPreview,
}: {
  doc: BomAttachment;
  onDelete: () => void;
  deleting: boolean;
  onPreview: (target: FilePreviewTarget) => void;
}) {
  const Icon = fileIcon(doc);
  const viewUrl = resolveFileUrl(doc.fileUrl);

  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors',
        viewUrl && 'cursor-pointer',
      )}
      onClick={() => viewUrl && onPreview({ url: viewUrl, fileName: displayName(doc), mimeType: doc.mimeType })}
    >
      {/* Icon */}
      <div className="w-9 h-9 rounded-lg bg-primary/8 border border-primary/20 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium text-foreground truncate">{displayName(doc)}</div>
        <div className="text-[11px] text-muted-foreground">
          {formatBytes(doc.fileSize)} · {formatDate(doc.createdAt)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {viewUrl && (
          <>
            <ActionBtn
              icon={Eye}
              label="Preview"
              onClick={(e) => {
                e.stopPropagation();
                onPreview({ url: viewUrl, fileName: displayName(doc), mimeType: doc.mimeType });
              }}
            />
            {/*
            <ActionBtn
              icon={Download}
              label="Download"
              onClick={(e) => {
                e.stopPropagation();
                const a = document.createElement('a');
                a.href = viewUrl;
                a.download = displayName(doc);
                a.click();
              }}
            />
            */}
          </>
        )}
        <ActionBtn
          icon={deleting ? Loader2 : Trash2}
          label="Delete"
          danger
          disabled={deleting}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          spin={deleting}
        />
      </div>
    </div>
  );
}

function ActionBtn({
  icon: Icon, label, onClick, danger, disabled, spin,
}: {
  icon: React.ElementType;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
  disabled?: boolean;
  spin?: boolean;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center transition-colors disabled:opacity-40',
        danger
          ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
      )}
    >
      <Icon className={cn('w-3.5 h-3.5', spin && 'animate-spin')} />
    </button>
  );
}

// ── Upload row (shown during upload) ──────────────────────────────
function UploadingRow({ fileName }: { fileName: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
      <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium text-foreground truncate">{fileName}</div>
        <div className="text-[11px] text-muted-foreground">Uploading…</div>
      </div>
    </div>
  );
}

// ── Error toast ────────────────────────────────────────────────────
function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mx-4 my-2 flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
export function BOMDocuments({ nodeId }: { nodeId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<FilePreviewTarget | null>(null);

  const { data: docs, isLoading } = useBomDocuments(nodeId);
  const upload = useUploadBomDocument(nodeId);
  const remove = useDeleteBomDocument(nodeId);

  const attachments = docs ?? [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = '';

    if (file.size > 50 * 1024 * 1024) {
      setError('File is too large (max 50 MB)');
      return;
    }

    setError(null);
    setUploadingFile(file.name);
    try {
      await upload.mutateAsync(file);
    } catch {
      setError(`Failed to upload "${file.name}". Please try again.`);
    } finally {
      setUploadingFile(null);
    }
  };

  const handleDelete = async (doc: BomAttachment) => {
    setDeletingId(doc.id);
    try {
      await remove.mutateAsync(doc.id);
    } catch {
      setError(`Failed to delete "${displayName(doc)}". Please try again.`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Documents</span>
          {attachments.length > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {attachments.length}
            </span>
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!uploadingFile}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          {uploadingFile ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          Add file
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="*/*"
        />
      </div>

      {/* Error banner */}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Body */}
      {isLoading ? (
        <div>
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
              <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
              <div className="flex-1 min-w-0">
                <Skeleton className="h-3.5 w-40 mb-1.5" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="flex items-center gap-0.5">
                <Skeleton className="w-7 h-7 rounded-md" />
                <Skeleton className="w-7 h-7 rounded-md" />
                <Skeleton className="w-7 h-7 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {/* Uploading indicator + attachment list — capped to ~6 visible rows, scrolls beyond that */}
          {(uploadingFile || attachments.length > 0) && (
            <div className="max-h-[366px] overflow-y-auto">
              {uploadingFile && <UploadingRow fileName={uploadingFile} />}
              {attachments.map(doc => (
                <AttachmentRow
                  key={doc.id}
                  doc={doc}
                  onDelete={() => handleDelete(doc)}
                  deleting={deletingId === doc.id}
                  onPreview={setPreviewing}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!uploadingFile && attachments.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-8 px-4 gap-2 cursor-pointer group"
              onClick={() => fileRef.current?.click()}
            >
              <div className="w-10 h-10 rounded-full bg-muted border border-dashed border-border group-hover:border-primary/40 flex items-center justify-center transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                No documents attached.<br />Click to upload a datasheet, 3D model, or any file.
              </p>
            </div>
          )}
        </div>
      )}

      <FilePreviewDialog file={previewing} onClose={() => setPreviewing(null)} />
    </div>
  );
}
