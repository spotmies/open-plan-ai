// BOMDetailScreenMobile — mobile-only "Part Detail" screen.
// Rendered by BOMDetailScreen when useIsMobile() is true; desktop keeps its
// existing two-column layout untouched. All data fetching / mutations stay
// in BOMDetailScreen — this component is purely presentational, restructured
// around a sticky header, a hero card, a Specifications card, an always-visible
// Sub-components list, and an Overview / History segmented toggle.
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft, Share2, MoreHorizontal, SquarePen, RefreshCw, GitMerge, Trash2, Send,
  ChevronRight, ChevronDown, Plus, Boxes, Loader2, ShieldCheck, XCircle, Upload,
  FileText, Box, Cpu, ImageIcon, File as FileIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIChromeStore } from '@/stores/useUIChromeStore';
import { Skeleton } from '@/components/ui/skeleton';
import { FilePreviewDialog, FilePreviewTarget } from '@/components/FilePreviewDialog';
import { resolveFileUrl } from '@/utils/fileUrl';
import { BOMNode, BOMRevision, BOMApproval, BOMApprovalRequest, BOMStatus, formatLeadTime } from './bomData';
import { ReqTag, PartThumb, PartImageThumb } from './BOMShared';
import { BOMApprovalReviewCard } from './BOMApprovalReviewCard';
import { useBomNotes, useAddBomNote, useDeleteBomNote } from '@/hooks/useBomNotes';
import { useBomDocuments, useUploadBomDocument, useDeleteBomDocument, isImageAttachment, BomAttachment } from '@/hooks/useBomDocuments';

// ── Small pure helpers ──────────────────────────────────────────────
function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function statusLabel(status: BOMStatus): string {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'draft') return 'Draft';
  return 'Pending Review';
}

function formatPrice(amount: number, formatCurrency: (n: number) => string): string {
  return amount > 0 ? formatCurrency(amount) : '—';
}

// Revisions created from an ECO wizard store a pipe-delimited summary like
// "ECO: ECO-2026-019 | Change Type: design_change | Reason: performance …".
// Pull the ECO id out as a badge and split the rest into label/value lines
// for the expanded row; plain free-text (e.g. "Initial release") just falls
// through as a single unlabeled line.
function parseChanges(changes: string): { eco: string | null; lines: { label?: string; value: string }[] } {
  if (!changes) return { eco: null, lines: [] };
  const ecoMatch = changes.match(/^ECO:\s*([^|]+?)\s*(?:\||$)/i);
  const eco = ecoMatch ? ecoMatch[1].trim() : null;
  const rest = ecoMatch ? changes.slice(ecoMatch[0].length).trim() : changes;
  if (!rest) return { eco, lines: [] };
  const lines = rest.split('|').map(s => s.trim()).filter(Boolean).map(part => {
    const idx = part.indexOf(':');
    if (idx > 0 && idx < 40) return { label: part.slice(0, idx).trim(), value: part.slice(idx + 1).trim() };
    return { value: part };
  });
  return { eco, lines };
}

const NOTE_AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
];
function noteAvatarColor(authorId: string) {
  let h = 0;
  for (let i = 0; i < authorId.length; i++) h = (h * 31 + authorId.charCodeAt(i)) >>> 0;
  return NOTE_AVATAR_COLORS[h % NOTE_AVATAR_COLORS.length];
}
function formatRelative(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 5) return 'Just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fileIcon(doc: Pick<BomAttachment, 'mimeType' | 'fileName' | 'fileUrl'>): React.ElementType {
  if (isImageAttachment(doc)) return ImageIcon;
  if (doc.mimeType === 'application/pdf') return FileText;
  const ext = (doc.fileName || doc.fileUrl || '').split('.').pop()?.toLowerCase().split(/[?#]/)[0] ?? '';
  if (['step', 'stp', 'iges', 'igs', 'stl'].includes(ext)) return Box;
  if (['kicad_mod', 'kicad_pcb', 'lib', 'lbr'].includes(ext)) return Cpu;
  return FileIcon;
}
function docDisplayName(doc: Pick<BomAttachment, 'fileName' | 'fileUrl'>): string {
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

// ── Small presentational primitives ─────────────────────────────────
function Section({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-4 mt-4">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
        {action}
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function CountBadge({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-muted-foreground shrink-0">{children}</span>;
}

function AddChip({ onClick, label = 'Add' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-border text-muted-foreground active:bg-muted transition-colors shrink-0"
    >
      <Plus className="w-3 h-3" /> {label}
    </button>
  );
}

function SpecField({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1">{label}</div>
      <div className={cn('text-[13.5px] font-semibold text-foreground break-words tracking-tight', mono && 'font-mono')}>{children}</div>
    </div>
  );
}

// Solid, high-contrast status pill for mobile — deliberately darker/richer
// than the soft translucent BOMStatusPill used on desktop, since a low-opacity
// tint reads poorly against the hero photo.
const MOBILE_STATUS_STYLE: Record<BOMStatus, { bg: string; label: string }> = {
  approved: { bg: '#15803D', label: 'Approved' },
  rejected: { bg: '#B91C1C', label: 'Rejected' },
  draft: { bg: '#475569', label: 'Draft' },
  pending: { bg: '#B45309', label: 'Pending Review' },
};
function MobileStatusPill({ status }: { status: BOMStatus }) {
  const s = MOBILE_STATUS_STYLE[status] ?? MOBILE_STATUS_STYLE.pending;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold text-white shadow-sm" style={{ background: s.bg }}>
      {s.label}
    </span>
  );
}

function PersonTag({ name, muted }: { name?: string | null; muted?: boolean }) {
  if (!name) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn(
        'w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 border',
        muted ? 'bg-muted border-border text-muted-foreground' : 'bg-primary/20 border-primary/30 text-primary'
      )}>
        {getInitials(name)}
      </span>
      {name}
    </span>
  );
}

// ── Revision History row (tap to select + expand; selection drives the
// Specifications/Overview cards above, same activeRevIdx as desktop) ──
function RevisionRow({ r, isActive, isLatestRev, onSelect }: {
  r: BOMRevision; isActive: boolean; isLatestRev: boolean; onSelect: () => void;
}) {
  const { eco, lines } = parseChanges(r.changes);
  return (
    <div className="px-4 py-3">
      <button onClick={onSelect} className="w-full flex items-center gap-2 text-left">
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', isActive ? 'bg-primary' : 'bg-muted-foreground/40')} />
        <span className="text-[13.5px] font-mono font-semibold text-foreground shrink-0">Rev {r.rev}</span>
        {isLatestRev && (
          <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-bold shrink-0"
            style={{ background: 'rgba(21,128,61,0.16)', color: '#15803D' }}>
            Latest
          </span>
        )}
        {eco && <span className="text-[11px] font-mono font-medium text-primary truncate">{eco}</span>}
        <span className="ml-auto text-[11px] text-muted-foreground shrink-0 tabular-nums">{r.date || '—'}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform', isActive && 'rotate-180')} />
      </button>
      {isActive && (
        <div className="mt-2 ml-3.5 pl-3 border-l border-border space-y-1">
          {lines.length > 0 ? lines.map((l, i) => (
            <div key={i} className="text-[11.5px] text-muted-foreground leading-relaxed">
              {l.label && <span className="text-foreground/80 font-medium">{l.label}: </span>}
              {l.value}
            </div>
          )) : (
            <div className="text-[11.5px] text-muted-foreground">No additional details.</div>
          )}
          <div className="text-[10.5px] text-muted-foreground/60 pt-0.5">By {r.author || 'Unknown'}</div>
        </div>
      )}
    </div>
  );
}

// ── Notes ──────────────────────────────────────────────────────────
function NotesSection({ nodeId, currentUserId }: { nodeId: string; currentUserId: string | undefined }) {
  const { data: notes = [], isLoading } = useBomNotes(nodeId);
  const addNote = useAddBomNote(nodeId);
  const deleteNote = useDeleteBomNote(nodeId);
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [draft]);

  const handleAdd = () => {
    const content = draft.trim();
    if (!content || addNote.isPending) return;
    addNote.mutate(content, { onSuccess: () => setDraft('') });
  };

  const sortedNotes = [...notes].reverse();

  return (
    <Section label="Notes" action={notes.length > 0 ? <CountBadge>{notes.length}</CountBadge> : undefined}>
      {isLoading ? (
        <div className="px-4 py-3.5"><Skeleton className="h-9 w-full" /></div>
      ) : sortedNotes.length > 0 && (
        <div className="divide-y divide-border">
          {sortedNotes.map(note => {
            const isOwn = note.author?.id === currentUserId;
            const initials = note.author?.initials ?? getInitials(note.author?.name);
            return (
              <div key={note.id} className="flex items-start gap-2.5 px-4 py-3">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5',
                  isOwn ? 'bg-primary' : noteAvatarColor(note.author?.id ?? note.id),
                )}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-foreground">{isOwn ? 'You' : (note.author?.name ?? 'Unknown')}</span>
                    <span className="text-[10.5px] text-muted-foreground/70">{formatRelative(note.createdAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">{note.content}</p>
                </div>
                {isOwn && (
                  <button onClick={() => deleteNote.mutate(note.id)}
                    className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground active:text-destructive active:bg-destructive/10 transition-colors shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className={cn('px-4 py-3 flex items-center gap-2', sortedNotes.length > 0 && 'border-t border-border')}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd(); }}
          placeholder="Add a note..."
          rows={1}
          className="flex-1 min-w-0 text-xs text-foreground bg-muted border border-border rounded-lg px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50 overflow-hidden"
        />
        <button onClick={handleAdd} disabled={!draft.trim() || addNote.isPending}
          className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground active:bg-primary/90 transition-colors disabled:opacity-50 shrink-0">
          {addNote.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ADD'}
        </button>
      </div>
    </Section>
  );
}

// ── Documents ──────────────────────────────────────────────────────
function DocumentsSection({ nodeId }: { nodeId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: docs, isLoading } = useBomDocuments(nodeId);
  const upload = useUploadBomDocument(nodeId);
  const remove = useDeleteBomDocument(nodeId);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<FilePreviewTarget | null>(null);

  const attachments = docs ?? [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File is too large (max 50 MB)');
      return;
    }
    setUploadingFile(file.name);
    try {
      await upload.mutateAsync(file);
    } catch {
      toast.error(`Failed to upload "${file.name}". Please try again.`);
    } finally {
      setUploadingFile(null);
    }
  };

  const handleDelete = async (doc: BomAttachment) => {
    setDeletingId(doc.id);
    try {
      await remove.mutateAsync(doc.id);
    } catch {
      toast.error(`Failed to delete "${docDisplayName(doc)}". Please try again.`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Section
      label="Documents"
      action={
        <div className="flex items-center gap-2">
          <CountBadge>{attachments.length}</CountBadge>
          <button onClick={() => fileRef.current?.click()} disabled={!!uploadingFile}
            className="w-6 h-6 rounded-md flex items-center justify-center border border-border text-muted-foreground active:bg-muted transition-colors disabled:opacity-50 shrink-0">
            {uploadingFile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          </button>
        </div>
      }
    >
      <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} accept="*/*" />
      {isLoading ? (
        <div className="px-4 py-3.5 space-y-3">
          {[0, 1].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : attachments.length === 0 && !uploadingFile ? (
        <button onClick={() => fileRef.current?.click()} className="w-full flex flex-col items-center justify-center py-7 px-4 gap-2 active:bg-muted/30 transition-colors">
          <div className="w-10 h-10 rounded-full bg-muted border border-dashed border-border flex items-center justify-center">
            <Upload className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground text-center">No documents attached.</p>
        </button>
      ) : (
        <div className="divide-y divide-border">
          {uploadingFile && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium text-foreground truncate">{uploadingFile}</div>
                <div className="text-[11px] text-muted-foreground">Uploading…</div>
              </div>
            </div>
          )}
          {attachments.map(doc => {
            const Icon = fileIcon(doc);
            const viewUrl = resolveFileUrl(doc.fileUrl);
            const deleting = deletingId === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => viewUrl && setPreviewing({ url: viewUrl, fileName: docDisplayName(doc), mimeType: doc.mimeType })}
                className={cn('flex items-center gap-3 px-4 py-3', viewUrl && 'cursor-pointer active:bg-muted/30')}
              >
                <div className="w-9 h-9 rounded-lg bg-primary/8 border border-primary/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-foreground truncate">{docDisplayName(doc)}</div>
                  <div className="text-[11px] text-muted-foreground">{formatBytes(doc.fileSize)} · {formatDate(doc.createdAt)}</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(doc); }}
                  disabled={deleting}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground active:text-destructive active:bg-destructive/10 transition-colors disabled:opacity-40 shrink-0"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
      <FilePreviewDialog file={previewing} onClose={() => setPreviewing(null)} />
    </Section>
  );
}

// ── Overflow action sheet (bottom sheet — matches MobileBottomNav's hand-rolled pattern) ──
function PartActionSheet({
  open, onClose, partLabel, showSendForReview, showNewEco, showDelete,
  onSendForReview, onNewEco, onDelete,
}: {
  open: boolean;
  onClose: () => void;
  partLabel: string;
  showSendForReview: boolean;
  showNewEco: boolean;
  showDelete: boolean;
  onSendForReview: () => void;
  onNewEco: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div
        className={cn('fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity', open ? 'opacity-100' : 'opacity-0 pointer-events-none')}
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed left-0 right-0 bottom-0 z-50 bg-background border-t border-border rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full pointer-events-none',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground truncate">{partLabel}</p>
        </div>
        <div className="py-2">
          {showSendForReview && (
            <button onClick={onSendForReview} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/50 transition-colors">
              <Send className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Send for Review</span>
            </button>
          )}
          {showNewEco && (
            <button onClick={onNewEco} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/50 transition-colors">
              <GitMerge className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">New ECO</span>
            </button>
          )}
          {showDelete && (
            <button onClick={onDelete} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-destructive/10 transition-colors">
              <Trash2 className="w-4 h-4" style={{ color: '#DC2626' }} />
              <span className="text-sm font-medium" style={{ color: '#DC2626' }}>Delete Part</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────
interface Props {
  node: BOMNode;
  meta: { tint: string; label: string; iconName: string };
  path: BOMNode[];
  children: BOMNode[];
  extended: number;
  photoUrl: string | null;
  formatCurrency: (amount: number) => string;

  revHistory: BOMRevision[];
  revisionsLoading: boolean;
  activeRevIdx: number;
  onSelectRevision: (idx: number) => void;
  isLatest: boolean;

  approvals: BOMApproval[];
  approvalsLoading: boolean;
  activeRequest: BOMApprovalRequest | null;
  lastRequest: BOMApprovalRequest | undefined;
  showApprovalActions: boolean;
  showRejectionBanner: boolean;
  canSendForReview: boolean;
  canReviseAndResubmit: boolean;
  canApprove: boolean;
  canDecide: boolean;
  decidePending: boolean;
  onApprove: (comment?: string) => Promise<void> | void;
  onReject: (reason: string, comment?: string) => Promise<void> | void;

  currentUserId: string | undefined;

  onBack: () => void;
  onNavigate: (id: string) => void;
  onEditPart: () => void;
  onNewEco: () => void;
  onDeletePart: () => void;
  onSendForReview: () => void;
  onAddSubcomponent: () => void;
  onViewImage: () => void;
}

export function BOMDetailScreenMobile({
  node, meta, path, children, extended, photoUrl, formatCurrency,
  revHistory, revisionsLoading, activeRevIdx, onSelectRevision, isLatest,
  approvals, approvalsLoading, activeRequest, lastRequest, showApprovalActions, showRejectionBanner,
  canSendForReview, canReviseAndResubmit, canApprove, canDecide, decidePending, onApprove, onReject,
  currentUserId, onBack, onNavigate, onEditPart, onNewEco, onDeletePart, onSendForReview, onAddSubcomponent, onViewImage,
}: Props) {
  const [tab, setTab] = useState<'overview' | 'history'>('overview');
  const [actionsOpen, setActionsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setTab('overview');
  }, [node.id]);

  // Hide the global top app bar for the duration this full-screen mobile
  // detail view is mounted — it duplicates the back/title/actions this
  // screen already provides in its own header below.
  useEffect(() => {
    useUIChromeStore.getState().setHideAppHeader(true);
    return () => useUIChromeStore.getState().setHideAppHeader(false);
  }, []);

  const parentPath = path.slice(0, -1);
  const showAwaitingBadge = !!activeRequest && !canDecide;
  const showOverflowSendForReview = canSendForReview;
  const showOverflowNewEco = !canReviseAndResubmit;
  const showOverflowDelete = canApprove;
  const hasOverflowItems = showOverflowSendForReview || showOverflowNewEco || showOverflowDelete;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <div className="flex flex-col bg-background">
      {/* Header — sticky so it stays pinned to the top while the page scrolls
          on mobile. No ancestor here has a bounded height (the real scroll
          container is the ambient AppLayout <main>), so this wrapper must not
          use `overflow-hidden`/`h-full` — that would create a closer
          "scrollport" than <main> and break `sticky` positioning below.
          A sticky element rests flush against its scroll ancestor's PADDING
          edge, not its border edge — so with `top-0` it always leaves a
          permanent gap the size of <main>'s `p-4` padding, revealing scrolled
          content underneath. `-top-4` (== -1rem == -p-4) shifts the stick
          threshold up into that padding so it lands flush with the true top. */}
      <div className="sticky -top-4 z-20 flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0 bg-background">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack}
            className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-foreground active:bg-muted/70 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[15px] font-bold text-foreground truncate">Part Detail</h1>
        </div>
        <button onClick={handleShare}
          className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-foreground active:bg-muted/70 transition-colors">
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Hero — image and identity enclosed together in one bordered card */}
        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="relative">
              <PartThumb cat={node.cat} big height={200} radius={0} bordered={false} imageUrl={photoUrl} onImageClick={photoUrl ? onViewImage : undefined} />
              <div className="absolute top-3 right-3"><MobileStatusPill status={node.status} /></div>
            </div>

            <div className="p-4">
              <div className="text-[12.5px] font-mono font-semibold text-primary">{node.pn}</div>
              <h2 className="text-[19px] font-bold tracking-tight text-foreground leading-snug mt-0.5">{node.name || node.pn}</h2>
              <div className="text-xs text-muted-foreground mt-1">
                BOM {node.levelLabel ?? node.level} · Rev {node.rev}
              </div>
              {!isLatest && (
                <span className="inline-flex items-center mt-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-300/40">
                  Viewing historical revision
                </span>
              )}
              {showAwaitingBadge && activeRequest && (
                <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md text-[11px] font-medium"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706', border: '1px solid rgba(245,158,11,0.2)' }}>
                  Awaiting review by {activeRequest.approvers.map(a => a.name).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Action row */}
          <div className="mt-3.5 flex items-center gap-2">
            {canReviseAndResubmit ? (
              <button onClick={onEditPart}
                className="flex-1 h-11 rounded-xl bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2 active:opacity-90 transition-opacity">
                <RefreshCw className="w-4 h-4" /> Revise &amp; Resubmit
              </button>
            ) : (
              <button onClick={() => isLatest && onEditPart()} disabled={!isLatest}
                className={cn(
                  'flex-1 h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors',
                  isLatest ? 'bg-foreground text-background active:bg-foreground/90' : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed',
                )}>
                <SquarePen className="w-4 h-4" /> Edit Part
              </button>
            )}
            {hasOverflowItems && (
              <button onClick={() => setActionsOpen(true)}
                className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0 text-foreground active:bg-muted/70 transition-colors">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {showRejectionBanner && (
          <div className="mx-4 mt-4 px-4 py-2.5 rounded-lg text-[12px] flex flex-col items-start gap-1.5"
            style={{ color: '#DC2626', background: '#DC262614', border: '1px solid #DC262633' }}>
            <div className="flex items-start gap-2">
              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="font-semibold">Review rejected by {lastRequest?.decidedByName ?? 'an approver'}.</span>
            </div>
            {lastRequest?.reason && <div><span>Rejection Reason:</span> {lastRequest.reason}</div>}
            <div>Tap &quot;Revise &amp; Resubmit&quot; to update the part and resubmit for review.</div>
          </div>
        )}

        {showApprovalActions && activeRequest && (
          <BOMApprovalReviewCard
            request={activeRequest}
            partLabel={node.pn}
            onApprove={onApprove}
            onReject={onReject}
            isPending={decidePending}
            className="mx-4 mt-4 mb-0"
          />
        )}

        {/* Specifications */}
        <Section label="Specifications">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 p-4">
            <SpecField label="Part Number" mono>{node.pn}</SpecField>
            <SpecField label="Part Name">{node.name}</SpecField>
            <SpecField label="MPN" mono>{node.mpn}</SpecField>
            <SpecField label="Manufacturer">{node.manufacturer}</SpecField>
            <SpecField label="Supplier">{node.distributor}</SpecField>
            <SpecField label="Quantity">{node.qty} {node.uom}</SpecField>
            <SpecField label="Unit Price">{formatPrice(node.price, formatCurrency)}</SpecField>
            <SpecField label="Lead Time">{formatLeadTime(node.leadTime)}</SpecField>
            <SpecField label="BOM Level">{node.levelLabel ?? node.level}</SpecField>
            <SpecField label="Handled By"><PersonTag name={node.owner} /></SpecField>
            {node.createdByName && (
              <SpecField label="Created By"><PersonTag name={node.createdByName} muted /></SpecField>
            )}
            {Array.isArray(node.customFields) && node.customFields.map((cf, i) => (
              <SpecField key={i} label={cf.label}>{cf.value}</SpecField>
            ))}
          </div>
        </Section>

        {/* Sub-components — always visible, same as desktop */}
        <Section label={`Sub-components (${children.length})`} action={<AddChip onClick={onAddSubcomponent} />}>
          {children.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-7 gap-2 px-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Boxes className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">No sub-components yet</p>
              <button onClick={onAddSubcomponent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-dashed border-primary/40 text-primary active:bg-primary/5 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add first sub-component
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {children.map(c => (
                <button key={c.id} onClick={() => onNavigate(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/40 transition-colors">
                  <PartImageThumb nodeId={c.id} cat={c.cat} size={42} radius={11} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-mono font-semibold text-primary">{c.pn}</div>
                    <div className="text-sm font-medium text-foreground truncate">{c.name || c.desc}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{c.qty} {c.uom} · {formatCurrency(c.price)}</div>
                  </div>
                  <MobileStatusPill status={c.status} />
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Overview | History segmented toggle */}
        <div className="px-4 mt-4 mb-1">
          <div className="flex bg-border rounded-lg p-1 gap-1">
            <button onClick={() => setTab('overview')}
              className={cn('flex-1 h-8 rounded-md text-[13px] font-bold transition-colors',
                tab === 'overview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}>
              Overview
            </button>
            <button onClick={() => setTab('history')}
              className={cn('flex-1 h-8 rounded-md text-[13px] font-bold transition-colors',
                tab === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}>
              History
            </button>
          </div>
        </div>

        {tab === 'overview' ? (
          <>
            <Section label="Overview">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 p-4">
                <SpecField label="Description">{node.desc || '—'}</SpecField>
                <SpecField label="Extended Price">{formatPrice(extended, formatCurrency)}</SpecField>
                <SpecField label="Status">{statusLabel(node.status)}</SpecField>
                <SpecField label="Revision">Rev {node.rev}</SpecField>
                <SpecField label="Category">{meta.label}</SpecField>
                <SpecField label="Sub-components">{children.length}</SpecField>
                <SpecField label="Traceability Links">{node.req.length}</SpecField>
              </div>
            </Section>

            <Section label="Where Used">
              {parentPath.length === 0 ? (
                <p className="text-xs text-muted-foreground px-4 py-3.5">
                  This is the top-level assembly — not used inside any other part.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {parentPath.map(p => (
                    <button key={p.id} onClick={() => onNavigate(p.id)}
                      className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left active:bg-muted/40 transition-colors">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-0.5">Used in</div>
                        <div className="text-sm font-medium text-foreground truncate">{p.name || p.desc}</div>
                        <div className="text-[11px] font-mono text-primary">{p.pn}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </Section>

            <Section label="Requirements Traceability">
              {node.req.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 py-3.5">No requirements linked to this part.</p>
              ) : (
                <div className="flex flex-wrap gap-2 px-4 py-3.5">
                  {node.req.map(r => <ReqTag key={r} label={r} />)}
                </div>
              )}
            </Section>

            <NotesSection nodeId={node.id} currentUserId={currentUserId} />
          </>
        ) : (
          <>
            <Section
              label="Revision History"
              action={revisionsLoading ? <Skeleton className="h-3.5 w-14" /> : <CountBadge>{revHistory.length} rev{revHistory.length !== 1 ? 's' : ''}</CountBadge>}
            >
              {revisionsLoading ? (
                <div className="px-4 py-3.5 space-y-3">
                  {[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {[...revHistory].reverse().map((r, ri) => {
                    const origIdx = revHistory.length - 1 - ri;
                    return (
                      <RevisionRow
                        key={r.id}
                        r={r}
                        isLatestRev={origIdx === revHistory.length - 1}
                        isActive={origIdx === activeRevIdx}
                        onSelect={() => onSelectRevision(origIdx)}
                      />
                    );
                  })}
                </div>
              )}
            </Section>

            <Section
              label="Approval History"
              action={approvalsLoading ? <Skeleton className="h-3.5 w-14" /> : <CountBadge>{approvals.length} action{approvals.length !== 1 ? 's' : ''}</CountBadge>}
            >
              {activeRequest && (
                <div className="mx-4 mt-3.5 px-2.5 py-2 rounded-md bg-muted/50 border border-border text-[11.5px] text-muted-foreground">
                  <span className="font-medium text-foreground">{activeRequest.requestedByName}</span> sent{' '}
                  {activeRequest.scope === 'subtree' ? 'this part + sub-components' : 'this part'} for review by{' '}
                  {activeRequest.approvers.map(a => a.name).join(', ')}.
                </div>
              )}
              {approvalsLoading ? (
                <div className="px-4 py-3.5 space-y-3">
                  {[0, 1].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 py-3.5">No approval activity yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {approvals.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                        {getInitials(a.performedByName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{a.performedByName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {a.action === 'approved' ? 'Approved' : 'Rejected'} · {new Date(a.date).toLocaleDateString()}
                        </div>
                        {a.reason && <div className="text-[11px] text-foreground/80 mt-0.5">Reason: {a.reason}</div>}
                        {a.comment && <div className="text-[11px] text-muted-foreground mt-0.5">{a.comment}</div>}
                      </div>
                      {a.action === 'approved'
                        ? <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: '#16A34A' }} />
                        : <XCircle className="w-4 h-4 shrink-0" style={{ color: '#DC2626' }} />}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section label="Hierarchy">
              <div className="flex flex-wrap items-center gap-1.5 px-4 py-3.5">
                {path.map((p, i) => {
                  const isCur = p.id === node.id;
                  return (
                    <span key={p.id} className="flex items-center gap-1.5">
                      <button
                        onClick={() => !isCur && onNavigate(p.id)}
                        disabled={isCur}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors',
                          isCur ? 'border-primary/50 text-primary bg-primary/5 font-semibold' : 'border-border text-muted-foreground bg-muted active:bg-accent',
                        )}>
                        {p.pn}
                      </button>
                      {i < path.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                    </span>
                  );
                })}
              </div>
            </Section>

            <DocumentsSection nodeId={node.id} />
          </>
        )}

        <div className="h-6" />
      </div>

      <PartActionSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        partLabel={`${node.pn} · ${node.name || node.pn}`}
        showSendForReview={showOverflowSendForReview}
        showNewEco={showOverflowNewEco}
        showDelete={showOverflowDelete}
        onSendForReview={() => { setActionsOpen(false); onSendForReview(); }}
        onNewEco={() => { setActionsOpen(false); onNewEco(); }}
        onDelete={() => { setActionsOpen(false); onDeletePart(); }}
      />
    </div>
  );
}
