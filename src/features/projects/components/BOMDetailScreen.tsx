import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, GitMerge, SquarePen, ChevronRight, Factory, Hash,
  Truck, DollarSign, Tag, Clock, FileText, Box, Cpu, Image, Package,
  ChevronDown, Check, History, User, MessageSquare, Send, Trash2, Pencil,
  Plus, Boxes, FileSpreadsheet, XCircle, Loader2, ShieldCheck, Sliders, RefreshCw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BOMDocuments } from './BOMDocuments';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { BOMNode, BOMRevision, BOM_CAT_META, bomPath, bomTypeOf, bomCountAll, describeDeleteImpact, fromApiRevision, formatLeadTime, getCategoryMeta, type BOMApprovalRequestScope } from './bomData';
import { BOMStatusPill, ReqTag, PartThumb, PartImageThumb, ImageViewerModal } from './BOMShared';
import { BOMPartSheet, BOMPartPayload, DocValue } from './BOMPartSheet';
import { BOMECOSheet } from './BOMECOSheet';
import { BOMImportSubcomponentsDialog } from './BOMImportSubcomponentsDialog';
import { usePartRevisions, useCreatePart, useUpdatePart, useCreateRevision } from '@/hooks/useParts';
import { useCreateBomNode, useUpdateBomNode, useDeleteBomNode, useAddRequirement, useRemoveRequirement, useCreateApprovalRequest, useDecideApprovalRequest, useBomNodeApprovals, useBomApprovalRequests, useActiveBomApprovalRequest } from '@/hooks/useBom';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useAuth } from '@/contexts/AuthContext';
import { BOMSendForReviewModal } from './BOMSendForReviewModal';
import { BOMApprovalReviewCard } from './BOMApprovalReviewCard';
import { uploadBomDocumentFile, addBomDocumentLink, useBomDocuments, isImageAttachment } from '@/hooks/useBomDocuments';
import { useCurrency } from '@/hooks/useCurrency';
import { resolveFileUrl } from '@/utils/fileUrl';
import { useBomNotes, useAddBomNote, useUpdateBomNote, useDeleteBomNote } from '@/hooks/useBomNotes';
import { useIsMobile } from '@/hooks/use-mobile';
import { BOMDetailScreenMobile } from './BOMDetailScreenMobile';

function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

async function saveBomDocs(nodeId: string, payload: BOMPartPayload) {
  const docs = [payload.docPhoto, ...(payload.docDatasheet ?? []), ...(payload.doc3DModel ?? []), ...(payload.docFootprint ?? []), ...(payload.docCustom ?? [])].filter(Boolean) as DocValue[];
  const newDocs = docs.filter(d => d.kind !== 'existing');
  await Promise.allSettled(
    newDocs.map(d => d.kind === 'file' ? uploadBomDocumentFile(nodeId, d.file) : addBomDocumentLink(nodeId, d.url, d.fileName)),
  );
}

// ── Add Sub-component Dialog ───────────────────────────────────────
export function AddSubcomponentDialog({
  open, onClose, parentNode,
  onCreateNew, onImportExcel,
}: {
  open: boolean;
  onClose: () => void;
  parentNode: BOMNode;
  onCreateNew: () => void;
  onImportExcel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Boxes className="w-4 h-4 text-primary" />
            Add Sub-component
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Choose how you'd like to add a sub-component to <span className="font-mono text-foreground">{parentNode.pn}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-5 flex flex-col gap-3">
          <button
            onClick={() => { onClose(); onCreateNew(); }}
            className="flex items-center gap-3 p-4 rounded-lg border border-border text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">Add Manually</div>
              <div className="text-xs text-muted-foreground">Create one new part using the part details form.</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          <button
            onClick={() => { onClose(); onImportExcel(); }}
            className="flex items-center gap-3 p-4 rounded-lg border border-border text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">Import from Excel</div>
              <div className="text-xs text-muted-foreground">Bulk-add multiple parts at once from a spreadsheet.</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </div>

        <div className="px-5 py-3.5 border-t border-border flex items-center justify-end bg-card shrink-0">
          <button onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Notes ──────────────────────────────────────────────────────────

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

function NotesCard({ nodeId, currentUserId }: { nodeId: string; currentUserId: string | undefined }) {
  const { data: notes = [], isLoading } = useBomNotes(nodeId);
  const addNote = useAddBomNote(nodeId);
  const updateNote = useUpdateBomNote(nodeId);
  const deleteNote = useDeleteBomNote(nodeId);

  const [draft, setDraft] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [draft]);

  const handleAddNote = useCallback(() => {
    const content = draft.trim();
    if (!content || addNote.isPending) return;
    addNote.mutate(content, { onSuccess: () => setDraft('') });
  }, [draft, addNote]);

  const startEdit = (noteId: string, content: string) => {
    setEditId(noteId);
    setEditText(content);
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const handleSaveEdit = (noteId: string) => {
    const content = editText.trim();
    if (!content || updateNote.isPending) return;
    updateNote.mutate({ noteId, content }, { onSuccess: () => setEditId(null) });
  };

  const sortedNotes = [...notes].reverse();

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Notes</span>
          {notes.length > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {notes.length}
            </span>
          )}
        </div>
      </div>

      {/* Notes list */}
      {isLoading ? (
        <div className="px-4 py-3 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : sortedNotes.length > 0 && (
        <div className="divide-y divide-border">
          {sortedNotes.map(note => {
            const isOwn = note.author?.id === currentUserId;
            const initials = note.author?.initials ?? note.author?.name?.slice(0, 2).toUpperCase() ?? '?';
            const wasEdited = note.createdAt !== note.updatedAt;
            return (
              <div key={note.id} className="group px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-start gap-2.5">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5',
                    isOwn ? 'bg-primary' : noteAvatarColor(note.author?.id ?? note.id),
                  )}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-foreground">
                        {isOwn ? 'You' : (note.author?.name ?? 'Unknown')}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground/70">{formatRelative(note.createdAt)}</span>
                      {wasEdited && (
                        <span className="text-[10px] text-muted-foreground/50 italic">edited</span>
                      )}
                      <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isOwn && (
                          <button onClick={() => startEdit(note.id, note.content)}
                            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        {isOwn && (
                          <button onClick={() => deleteNote.mutate(note.id)}
                            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {editId === note.id ? (
                      <div className="space-y-1.5">
                        <textarea
                          ref={editRef}
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveEdit(note.id); if (e.key === 'Escape') setEditId(null); }}
                          className="w-full text-xs text-foreground bg-muted border border-border rounded-md px-2.5 py-1.5 resize-none outline-none focus:ring-1 focus:ring-primary/40 min-h-[56px]"
                        />
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={() => setEditId(null)}
                            className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded transition-colors">
                            Cancel
                          </button>
                          <button onClick={() => handleSaveEdit(note.id)}
                            className="text-[11px] font-medium text-primary hover:text-primary/80 px-2 py-0.5 rounded transition-colors">
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{note.content}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compose area */}
      <div className="px-4 py-3 border-t border-border bg-muted/20">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
            YO
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
              placeholder="Add a note… (⌘↵ to submit)"
              rows={1}
              className="w-full text-xs text-foreground bg-background border border-border rounded-lg px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50 overflow-hidden"
            />
            {draft.trim() && (
              <div className="flex items-center justify-end">
                <button onClick={handleAddNote} disabled={addNote.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {addNote.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Add Note
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface Props {
  node: BOMNode;
  rootNodes: BOMNode[];
  orgId: string;
  projectId: string;
  onBack: () => void;
  onNavigate: (id: string) => void;
  onEcoCreated?: (ecoId: string) => void;
}

// ── Small shared primitives ────────────────────────────────────────
const Field = ({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) => (
  <div className="min-w-0">
    <div className="text-[10.5px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
    <div className={`text-sm font-medium text-foreground break-words ${mono ? 'font-mono' : ''}`}>{children}</div>
  </div>
);

const Card = ({ title, action, children, noPad }: {
  title?: string; action?: React.ReactNode; children: React.ReactNode; noPad?: boolean;
}) => (
  <div className="bg-card border border-border rounded-xl overflow-hidden">
    {title && (
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {action}
      </div>
    )}
    <div className={noPad ? '' : 'p-4'}>{children}</div>
  </div>
);

const ICON_MAP: Record<string, React.ElementType> = {
  Factory, Hash, Truck, DollarSign, Tag, Clock, FileText, Box, Cpu, Image, Package, User,
};

// ── Version toggle popover ─────────────────────────────────────────
function RevisionToggle({
  revHistory,
  activeIdx,
  onChange,
}: {
  revHistory: BOMRevision[];
  activeIdx: number;
  onChange: (idx: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const { formatCurrency } = useCurrency();
  const active = revHistory[activeIdx];
  const isLatest = revHistory.length === 0 || activeIdx === revHistory.length - 1;

  if (!active) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border cursor-pointer transition-colors',
            isLatest
              ? 'bg-muted text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              : 'bg-amber-500/10 text-amber-600 border-amber-300/40 hover:border-amber-400'
          )}
        >
          Rev {active.rev}
          {!isLatest && <span className="text-[9px] uppercase tracking-wide ml-0.5">historical</span>}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border">
          <p className="text-xs font-semibold text-foreground">Revision history</p>
          <p className="text-[11px] text-muted-foreground">{revHistory.length} revision{revHistory.length !== 1 ? 's' : ''} — click to view</p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {[...revHistory].reverse().map((r, ri) => {
            const origIdx = revHistory.length - 1 - ri;
            const isActive = origIdx === activeIdx;
            const isLatestRev = origIdx === revHistory.length - 1;
            return (
              <button
                key={r.rev}
                onClick={() => { onChange(origIdx); setOpen(false); }}
                className={cn(
                  'flex items-start gap-3 w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/50',
                  isActive && 'bg-primary/5'
                )}
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center shrink-0 mt-1">
                  <div className={cn(
                    'w-2 h-2 rounded-full border-2 shrink-0',
                    isActive ? 'border-primary bg-primary' : 'border-muted-foreground bg-transparent'
                  )} />
                  {ri < revHistory.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('text-xs font-mono font-semibold', isActive ? 'text-primary' : 'text-foreground')}>
                      Rev {r.rev}
                    </span>
                    {isLatestRev && (
                      <span className="text-[9px] uppercase tracking-wide px-1 py-0 rounded bg-primary/10 text-primary font-semibold">
                        latest
                      </span>
                    )}
                    {isActive && !isLatestRev && (
                      <span className="text-[9px] uppercase tracking-wide px-1 py-0 rounded bg-amber-500/10 text-amber-600 font-semibold">
                        viewing
                      </span>
                    )}
                    {isActive && <Check className="w-3 h-3 text-primary ml-auto shrink-0" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.changes}</div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {r.date} · {r.author} · {formatCurrency(r.price)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main component ─────────────────────────────────────────────────
export function BOMDetailScreen({ node: originalNode, rootNodes, orgId, projectId, onBack, onNavigate, onEcoCreated }: Props) {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // ── Uploaded documents — pull the product photo (first image attachment) ──
  const { data: nodeDocs } = useBomDocuments(originalNode.id);
  const photoUrl = useMemo(() => {
    const photo = (nodeDocs ?? []).find(isImageAttachment);
    return photo ? resolveFileUrl(photo.fileUrl) : null;
  }, [nodeDocs]);

  // ── Revision history from API ──
  const { data: apiRevisions, isLoading: revisionsLoading } = usePartRevisions(originalNode._partId);
  const revHistory = useMemo<BOMRevision[]>(
    () => (apiRevisions ?? []).map(fromApiRevision),
    [apiRevisions],
  );

  const [activeRevIdx, setActiveRevIdx] = useState(0);
  const [showEdit, setShowEdit] = useState(false);
  const [ecoOpen, setEcoOpen] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [showCreateNewSub, setShowCreateNewSub] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [showSendForReview, setShowSendForReview] = useState(false);
  const [viewingImage, setViewingImage] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Approval workflow ──
  const { data: project } = useProjectDetail(projectId);
  const projectRole = (project?.myRole || '').toLowerCase();
  const canApprove = projectRole === 'admin' || projectRole === 'maintainer';
  const isAdmin = projectRole === 'admin';
  const createApprovalRequest = useCreateApprovalRequest(projectId);
  const decideApprovalRequest = useDecideApprovalRequest(projectId);
  const { data: approvals = [], isLoading: approvalsLoading } = useBomNodeApprovals(originalNode.id);
  const { data: approvalRequests = [] } = useBomApprovalRequests(originalNode.id);
  const activeRequest = useActiveBomApprovalRequest(originalNode.id);
  const isCreatorOrOwner = !!user && (originalNode.ownerId === user.id || originalNode.createdById === user.id);
  const canSendForReview = (canApprove || isCreatorOrOwner) && !activeRequest
    && (originalNode.status === 'draft' || originalNode.status === 'pending');
  const canReviseAndResubmit = (canApprove || isCreatorOrOwner) && !activeRequest
    && originalNode.status === 'rejected';
  const isAssignedApprover = !!user && !!activeRequest && activeRequest.approvers.some(a => a.id === user.id);
  const canDecide = isAssignedApprover || isAdmin;
  const lastRequest = approvalRequests[0];
  const showRejectionBanner = !activeRequest && lastRequest?.status === 'rejected';

  // Point to latest revision whenever the node changes or revisions first load
  useEffect(() => {
    setActiveRevIdx(Math.max(0, revHistory.length - 1));
  }, [originalNode.id, revHistory.length]);

  // Scroll to top whenever the displayed node changes
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [originalNode.id]);

  // ── Mutations ──
  const createNode = useCreateBomNode(projectId);
  const updateNode = useUpdateBomNode(projectId);
  const deleteBomNode = useDeleteBomNode(projectId);
  const createPart = useCreatePart(orgId);
  const updatePart = useUpdatePart();
  const createRev = useCreateRevision();
  const addRequirement = useAddRequirement(projectId);
  const removeRequirement = useRemoveRequirement(projectId);

  const activeRev = revHistory[activeRevIdx] ?? { rev: originalNode.rev, status: originalNode.status, price: originalNode.price, leadTime: originalNode.leadTime, date: '', author: '', changes: '', customFields: originalNode.customFields } as BOMRevision;
  const isLatest = revHistory.length === 0 || activeRevIdx === revHistory.length - 1;

  // Build a synthetic "view node" that reflects the active revision's data.
  // status always comes from the BOM node (originalNode) because approve/reject only
  // update bom_nodes.status — revision records retain their creation-time status forever.
  const node: BOMNode = {
    ...originalNode,
    rev: activeRev.rev,
    status: originalNode.status,
    price: activeRev.price,
    leadTime: activeRev.leadTime,
    // Use the active revision's supplier list when available so the edit form
    // reflects the correct per-revision sourcing data; fall back to the part-level data.
    suppliers: (activeRev as BOMRevision).suppliers?.length
      ? (activeRev as BOMRevision).suppliers
      : originalNode.suppliers,
    customFields: activeRev.customFields?.length ? activeRev.customFields : originalNode.customFields,
  };

  const meta = getCategoryMeta(node.cat);
  const path = bomPath(node.id, rootNodes) ?? [node];
  const children = node.children ?? [];
  const extended = node.price * node.qty;

  const handleNewSubSaved = async (payload: BOMPartPayload) => {
    const part = await createPart.mutateAsync({
      partNumber: payload.pn,
      name: payload.name,
      description: payload.desc,
      category: payload.category,
      manufacturer: payload.manufacturer || undefined,
      distributor: payload.distributor || undefined,
      mpn: payload.mpn || undefined,
      unit: payload.uom,
      initialStatus: payload.status,
      initialRev: payload.rev,
      initialPrice: payload.price > 0 ? payload.price : undefined,
      initialLeadTimeDays: payload.leadTime > 0 ? payload.leadTime : undefined,
      initialSuppliers: payload.suppliers?.length ? payload.suppliers.map(s => ({ ...s, price: parseFloat(s.price) || 0 })) : undefined,
    });
    const node = await createNode.mutateAsync({
      partId: part.id, quantity: payload.qty, unit: payload.uom,
      status: payload.status, parentId: originalNode.id,
      ownerId: payload.ownerId ?? null,
    });
    await saveBomDocs(node.id, payload);
    setShowCreateNewSub(false);
  };

  // ── Save handler ──
  const handleSave = async (payload: BOMPartPayload) => {
    if (!originalNode._partId) return;
    if (payload.versionMode === 'new') {
      await createRev.mutateAsync({
        partId: originalNode._partId,
        dto: {
          rev: payload.newRevLabel ?? activeRev.rev,
          changes: payload.changeNotes || `Updated Rev ${activeRev.rev}`,
          status: payload.status,
          price: payload.price,
          leadTimeDays: payload.leadTime,
          suppliers: payload.suppliers?.length ? payload.suppliers.map(s => ({ ...s, price: parseFloat(s.price) || 0 })) : undefined,
        },
      });
    } else {
      // Revisions are append-only on the backend — there is no endpoint to
      // patch price/leadTime on an existing row. "Update in place" therefore
      // means inserting a new revision row under the *same* rev label, which
      // becomes the new latest revision without bumping the visible rev letter.
      const priceChanged = payload.price !== activeRev.price;
      const leadTimeChanged = payload.leadTime !== activeRev.leadTime;
      await Promise.all([
        updateNode.mutateAsync({ nodeId: originalNode.id, dto: { quantity: payload.qty, unit: payload.uom } }),
        updatePart.mutateAsync({ partId: originalNode._partId, dto: { name: payload.name, description: payload.desc, manufacturer: payload.manufacturer || undefined, distributor: payload.distributor || undefined, mpn: payload.mpn || undefined, customFields: payload.customFields } }),
        ...(priceChanged || leadTimeChanged ? [createRev.mutateAsync({
          partId: originalNode._partId,
          dto: {
            rev: activeRev.rev,
            changes: payload.changeNotes || 'Updated price / lead time',
            status: payload.status,
            price: payload.price,
            leadTimeDays: payload.leadTime,
            suppliers: payload.suppliers?.length ? payload.suppliers.map(s => ({ ...s, price: parseFloat(s.price) || 0 })) : undefined,
          },
        })] : []),
      ]);
    }
    // Upload any documents attached in the edit form
    await saveBomDocs(originalNode.id, payload);
    queryClient.invalidateQueries({ queryKey: ['bom-documents', originalNode.id] });

    // Sync requirement traceability links
    const toAdd = payload.req.filter(r => !originalNode.req.includes(r));
    const toRemove = (originalNode._reqLinks ?? []).filter(l => !payload.req.includes(l.requirementId));
    await Promise.all([
      ...toAdd.map(requirementId => addRequirement.mutateAsync({ nodeId: originalNode.id, requirementId })),
      ...toRemove.map(link => removeRequirement.mutateAsync(link.id)),
    ]);

    if (originalNode.status === 'rejected' && lastRequest) {
      try {
        await createApprovalRequest.mutateAsync({
          nodeId: originalNode.id,
          scope: lastRequest.scope,
          approverIds: lastRequest.approvers.map(a => a.id),
        });
        toast.success(`${originalNode.pn} resubmitted for review`);
      } catch (err) {
        toast.error('Saved, but failed to resubmit for review', {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    }

    setShowEdit(false);
  };

  // ── Send for review / Approve / Reject handlers ──
  const handleSendForReview = async (
    scope: BOMApprovalRequestScope,
    approverIds: string[],
    comment?: string,
  ) => {
    try {
      await createApprovalRequest.mutateAsync({ nodeId: originalNode.id, scope, approverIds, comment });
      toast.success(`${originalNode.pn} sent for review`);
    } catch (err) {
      toast.error('Failed to send part for review', {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err;
    }
  };

  const handleApprove = async (comment?: string) => {
    if (!activeRequest) return;
    try {
      await decideApprovalRequest.mutateAsync({ requestId: activeRequest.id, nodeId: originalNode.id, decision: 'approved', comment });
      toast.success(`${originalNode.pn} approved`);
    } catch (err) {
      toast.error('Failed to approve part', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleRejectConfirm = async (reason: string, comment?: string) => {
    if (!activeRequest) return;
    try {
      await decideApprovalRequest.mutateAsync({ requestId: activeRequest.id, nodeId: originalNode.id, decision: 'rejected', reason, comment });
      toast.success(`${originalNode.pn} rejected`);
    } catch (err) {
      toast.error('Failed to reject part', {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err;
    }
  };

  const handleConfirmDelete = async () => {
    try {
      const { deletedCount } = await deleteBomNode.mutateAsync(originalNode.id);
      toast.success(deletedCount > 1 ? `Deleted ${deletedCount} parts` : `${originalNode.pn} deleted`);
      setShowDeleteConfirm(false);
      onBack();
    } catch (err) {
      toast.error('Failed to delete part', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const showApprovalActions = canDecide && isLatest && !!activeRequest;

  return (
    <div className={cn('flex flex-col h-full bg-background', !isMobile && 'overflow-hidden')}>
      {isMobile ? (
        <BOMDetailScreenMobile
          node={node}
          meta={meta}
          path={path}
          children={children}
          extended={extended}
          photoUrl={photoUrl}
          formatCurrency={formatCurrency}
          revHistory={revHistory}
          revisionsLoading={revisionsLoading}
          activeRevIdx={activeRevIdx}
          onSelectRevision={setActiveRevIdx}
          isLatest={isLatest}
          approvals={approvals}
          approvalsLoading={approvalsLoading}
          activeRequest={activeRequest}
          lastRequest={lastRequest}
          showApprovalActions={showApprovalActions}
          showRejectionBanner={showRejectionBanner}
          canSendForReview={canSendForReview}
          canReviseAndResubmit={canReviseAndResubmit}
          canApprove={canApprove}
          canDecide={canDecide}
          decidePending={decideApprovalRequest.isPending}
          onApprove={handleApprove}
          onReject={handleRejectConfirm}
          currentUserId={user?.id}
          onBack={onBack}
          onNavigate={onNavigate}
          onEditPart={() => isLatest && setShowEdit(true)}
          onNewEco={() => setEcoOpen(true)}
          onDeletePart={() => setShowDeleteConfirm(true)}
          onSendForReview={() => setShowSendForReview(true)}
          onAddSubcomponent={() => setShowAddSub(true)}
          onViewImage={() => setViewingImage(true)}
        />
      ) : (
        <>
      {/* Breadcrumb */}
      <div className="px-6 pt-3 flex items-center m-2 gap-1.5 text-xs text-muted-foreground flex-wrap">
        <span className="cursor-pointer hover:text-foreground transition-colors" onClick={onBack}>BOM</span>
        <ChevronRight className="w-3 h-3" />
        {path.slice(0, -1).map((p) => (
          <span key={p.id} className="flex items-center gap-1.5">
            <span
              className="cursor-pointer hover:text-foreground transition-colors font-mono"
              onClick={() => onNavigate(p.id)}
            >
              {p.pn}
            </span>
            <ChevronRight className="w-3 h-3" />
          </span>
        ))}
        <span className="font-mono text-foreground font-medium">{node.pn}</span>
        {!isLatest && (
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-300/40">
            Viewing historical revision
          </span>
        )}
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Back button */}
        {/* <div className="px-6 pt-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 mb-3 rounded-md text-xs font-medium text-muted-foreground border border-border bg-transparent hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to BOM
          </button>
        </div> */}

        {/* Part header */}
        <div className="px-6 pb-4 flex items-start justify-between gap-5">
          <div className="flex gap-4 items-start min-w-0">
            <div className="w-16 shrink-0">
              <PartThumb cat={node.cat} size={64} radius={12} imageUrl={photoUrl} onImageClick={photoUrl ? () => setViewingImage(true) : undefined} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                <h1 className="text-xl font-semibold text-foreground">{node.name || node.pn}</h1>
                <BOMStatusPill status={node.status} />
                {/* ── Version toggle ── */}
                <RevisionToggle
                  revHistory={revHistory}
                  activeIdx={activeRevIdx}
                  onChange={setActiveRevIdx}
                />
              </div>
              <div className="text-xs font-mono text-muted-foreground mb-1">{node.pn}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1.5" style={{ color: meta.tint }}>
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: meta.tint }} />
                  {meta.label}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {canSendForReview && (
              <button
                onClick={() => setShowSendForReview(true)}
                title="Send this part for review"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium border border-border bg-card text-foreground hover:bg-muted transition-colors whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5 text-muted-foreground" /> Send for Review
              </button>
            )}
            {canReviseAndResubmit && (
              <button
                onClick={() => setShowEdit(true)}
                title="Revise this part and resubmit for review"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Revise &amp; Resubmit
              </button>
            )}
            {activeRequest && !canDecide && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap"
                style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                Awaiting review by {activeRequest.approvers.map(a => a.name).join(', ')}
              </span>
            )}
            {!canReviseAndResubmit && <button
              onClick={() => setEcoOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium border border-border bg-card text-foreground hover:bg-muted transition-colors whitespace-nowrap"
            >
              <GitMerge className="w-3.5 h-3.5 text-muted-foreground" /> New ECO
            </button>}
            {!canReviseAndResubmit && <button
              onClick={() => isLatest && setShowEdit(true)}
              disabled={!isLatest}
              title={isLatest ? 'Edit this part' : 'Switch to latest revision to edit'}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                isLatest
                  ? 'bg-foreground text-background hover:bg-foreground/90 cursor-pointer'
                  : 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-50'
              )}
            >
              <SquarePen className="w-3.5 h-3.5" /> Edit Part
            </button>}
            {canApprove && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete this part"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium border border-border bg-card hover:bg-destructive/10 hover:border-destructive/30 transition-colors whitespace-nowrap"
                style={{ color: '#DC2626' }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Part
              </button>
            )}
          </div>
        </div>

        {showRejectionBanner && (
          <div
            className="mx-6 mb-4 px-4 py-2.5 rounded-lg text-[12px] flex flex-col items-start gap-2"
            style={{ color: '#DC2626', background: '#DC262614', border: '1px solid #DC262633' }}
          >
            <div className='flex items-start gap-2'>
              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="font-semibold">Review rejected by {lastRequest?.decidedByName ?? 'an approver'}.</span>
            </div>
            <div><span>Rejection Reason:</span>{lastRequest?.reason && <span> {lastRequest.reason}</span>}</div>
            <div>Click &quot;Revise &amp; Resubmit&quot; to update the part and resubmit for review.</div>
          </div>
        )}

        {showApprovalActions && activeRequest && (
          <BOMApprovalReviewCard
            request={activeRequest}
            partLabel={node.pn}
            onApprove={handleApprove}
            onReject={handleRejectConfirm}
            isPending={decideApprovalRequest.isPending}
          />
        )}

        {/* Info row */}
        <div className="mx-6 mb-5 px-4 py-3.5 bg-card border border-border rounded-xl grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
          <Field label="Part Number" mono>{node.pn}</Field>
          <Field label="Part Name">{node.name}</Field>
          <Field label="MPN" mono>{node.mpn}</Field>
          <Field label="Manufacturer">{node.manufacturer}</Field>
          <Field label="Supplier">{node.distributor}</Field>
          <Field label="Quantity">{node.qty} {node.uom}</Field>
          {node.designators && <Field label="Designators" mono>{node.designators}</Field>}
          <Field label="Unit Price">{formatCurrency(node.price)}</Field>
          <Field label="Lead Time">{formatLeadTime(node.leadTime)}</Field>
          <Field label="BOM Level">{node.levelLabel ?? node.level}</Field>
          <Field label="Handled By">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[8px] font-bold text-primary shrink-0">
                {getInitials(node.owner)}
              </span>
              {node.owner}
            </span>
          </Field>
          {node.createdByName && (
            <Field label="Created By">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-muted border border-border flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">
                  {getInitials(node.createdByName)}
                </span>
                {node.createdByName}
              </span>
            </Field>
          )}
          {Array.isArray(node.customFields) && node.customFields.length > 0 && (
            <>
              {/* <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">Additional Fields</p> */}
              {node.customFields.map((cf, i) => (
                // <div key={i} className="flex items-center gap-3 mb-2 last:mb-0">
                //   <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                //     <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
                //   </div>
                //   <span className="text-xs text-muted-foreground flex-1">{cf.label}</span>
                //   <span className="text-sm font-medium text-foreground text-right">{cf.value}</span>
                // </div>
                <Field label={cf.label}>
                  <span className="flex items-center gap-1.5">
                    {cf.value}
                  </span>
                </Field>
              ))}
            </>
          )}
        </div>

        {/* Two-column body */}
        <div className="px-6 pb-8 grid gap-4" style={{ gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)' }}>
          {/* LEFT */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* Overview */}
            <Card title="Overview">
              <div className="flex gap-4">
                <div className="w-48 shrink-0"><PartThumb cat={node.cat} big imageUrl={photoUrl} onImageClick={photoUrl ? () => setViewingImage(true) : undefined} /></div>
                <div className="flex-1 min-w-0">
                  {node.desc && (
                    <div className="mb-3.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Description</p>
                      <p className="text-sm text-muted-foreground leading-relaxed break-words">{node.desc}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-x-4 gap-y-3.5">
                    <Field label="Extended Price">{formatCurrency(extended)}</Field>
                    <Field label="Status">
                      {node.status === 'approved' ? 'Approved' : node.status === 'draft' ? 'Draft' : 'Pending review'}
                    </Field>
                    <Field label="Revision">Rev {node.rev}</Field>
                    <Field label="Category">{meta.label}</Field>
                    <Field label="Sub-components">{children.length}</Field>
                    <Field label="Traceability links">{node.req.length}</Field>
                  </div>
                </div>
              </div>
            </Card>

            {/* Sub-components — always visible for every BOM part */}
            <Card
              title={`Sub-components (${children.length})`}
              noPad={children.length > 0}
              action={
                <button
                  onClick={() => setShowAddSub(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              }
            >
              {children.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Boxes className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">No sub-components yet</p>
                  <button
                    onClick={() => setShowAddSub(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add first sub-component
                  </button>
                </div>
              ) : (
                children.map((c, i) => (
                  <div
                    key={c.id}
                    onClick={() => onNavigate(c.id)}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                    style={{ borderBottom: i < children.length - 1 ? '1px solid var(--border)' : undefined }}
                  >
                    <PartImageThumb nodeId={c.id} cat={c.cat} size={34} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{c.name || c.desc}</div>
                      <div className="text-[11px] font-medium font-mono text-muted-foreground">{c.pn}</div>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">{c.qty} {c.uom}</span>
                    <span className="text-sm text-foreground tabular-nums w-20 text-right shrink-0">{formatCurrency(c.price)}</span>
                    <BOMStatusPill status={c.status} />
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                ))
              )}
            </Card>

            {/* Where Used — always visible */}
            <Card title="Where Used">
              {path.slice(0, -1).length === 0 ? (
                <p className="text-xs text-muted-foreground">This is the top-level assembly — not used inside any other part.</p>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {path.slice(0, -1).map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <button
                        onClick={() => onNavigate(p.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-border cursor-pointer hover:bg-accent transition-colors"
                      >
                        <span className="text-xs text-foreground">{p.name || p.desc}</span>
                        <span className="text-[11px] font-mono text-muted-foreground">{p.pn}</span>
                      </button>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  ))}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-border">
                    <span className="text-xs text-foreground font-medium">{node.name || node.desc}</span>
                    <span className="text-[11px] font-mono text-muted-foreground">{node.pn}</span>
                  </span>
                </div>
              )}
            </Card>

            {/* Requirements traceability */}
            <Card title="Requirements Traceability">
              {node.req.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requirements linked to this part.</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {node.req.map(r => <ReqTag key={r} label={r} />)}
                </div>
              )}
            </Card>

            {/* Notes */}
            <NotesCard nodeId={node.id} currentUserId={user?.id} />
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* Sourcing */}
            {/* <Card title="Sourcing">
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Manufacturer', value: node.manufacturer, icon: 'Factory' },
                  { label: 'Manufacturer PN', value: node.mpn, icon: 'Hash', mono: true },
                  { label: 'Supplier', value: node.distributor, icon: 'Truck' },
                  { label: 'Unit Price', value: formatCurrency(node.price), icon: 'DollarSign' },
                  { label: 'Extended Price', value: `${formatCurrency(extended)} · ${node.qty} ${node.uom}`, icon: 'Tag' },
                  { label: 'Lead Time', value: formatLeadTime(node.leadTime), icon: 'Clock' },
                  { label: 'Handled By', value: node.owner, icon: 'User' },
                ].map((r, i) => {
                  const Ic = ICON_MAP[r.icon] ?? Package;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                        <Ic className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-xs text-muted-foreground flex-1">{r.label}</span>
                      <span className={`text-sm font-medium text-foreground text-right whitespace-nowrap ${(r as any).mono ? 'font-mono' : ''}`}>
                        {r.value}
                      </span>
                    </div>
                  );
                })}
                {Array.isArray(node.customFields) && node.customFields.length > 0 && (
                  <>
                    <div className="border-t border-border/50 pt-2 mt-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">Additional Fields</p>
                      {node.customFields.map((cf, i) => (
                        <div key={i} className="flex items-center gap-3 mb-2 last:mb-0">
                          <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                            <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <span className="text-xs text-muted-foreground flex-1">{cf.label}</span>
                          <span className="text-sm font-medium text-foreground text-right">{cf.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card> */}

            {/* Revision History */}
            <Card
              title="Revision History"
              action={
                revisionsLoading ? (
                  <Skeleton className="h-4 w-14" />
                ) : (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <History className="w-3.5 h-3.5" />
                    {revHistory.length} rev{revHistory.length !== 1 ? 's' : ''}
                  </div>
                )
              }
            >
              {revisionsLoading ? (
                <div className="flex flex-col gap-0">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="flex items-start gap-3 py-2.5 px-2 -mx-2">
                      <div className="flex flex-col items-center shrink-0 mt-1.5">
                        <Skeleton className="w-2 h-2 rounded-full" />
                        {i < 2 && <Skeleton className="w-px flex-1 min-h-[18px] mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Skeleton className="h-3 w-12" />
                          {i === 0 && <Skeleton className="h-3.5 w-10 rounded" />}
                        </div>
                        <Skeleton className="h-3 w-full mb-1" />
                        <Skeleton className="h-2.5 w-28" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-0">
                  {[...revHistory].reverse().map((r, ri) => {
                    const origIdx = revHistory.length - 1 - ri;
                    const isActive = origIdx === activeRevIdx;
                    const isLatestRev = origIdx === revHistory.length - 1;
                    return (
                      <div key={r.rev}
                        onClick={() => setActiveRevIdx(origIdx)}
                        className={cn(
                          'flex items-start gap-3 py-2.5 px-2 rounded-lg cursor-pointer transition-colors -mx-2',
                          isActive ? 'bg-primary/5' : 'hover:bg-muted/50'
                        )}
                      >
                        {/* Timeline */}
                        <div className="flex flex-col items-center shrink-0 mt-1.5">
                          <div className={cn(
                            'w-2 h-2 rounded-full border-2 shrink-0',
                            isActive ? 'border-primary bg-primary' : 'border-muted-foreground bg-transparent'
                          )} />
                          {ri < revHistory.length - 1 && (
                            <div className="w-px bg-border flex-1 min-h-[18px] mt-1" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className={cn('text-xs font-mono font-semibold', isActive ? 'text-primary' : 'text-foreground')}>
                              Rev {r.rev}
                            </span>
                            {isLatestRev && (
                              <span className="text-[9px] uppercase tracking-wide px-1 rounded bg-primary/10 text-primary font-semibold">latest</span>
                            )}
                            {isActive && <Check className="w-3 h-3 text-primary ml-auto shrink-0" />}
                          </div>
                          <div className="text-[11.5px] text-muted-foreground leading-snug">{r.changes}</div>
                          <div className="text-[10.5px] text-muted-foreground/60 mt-0.5">
                            {r.date} · {r.author}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Approval History */}
            <Card
              title="Approval History"
              action={
                approvalsLoading ? (
                  <Skeleton className="h-4 w-14" />
                ) : (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {approvals.length} action{approvals.length !== 1 ? 's' : ''}
                  </div>
                )
              }
            >
              {activeRequest && (
                <div className="mb-3 px-2.5 py-2 rounded-md bg-muted/50 border border-border text-[11.5px] text-muted-foreground">
                  <span className="font-medium text-foreground">{activeRequest.requestedByName}</span> sent{' '}
                  {activeRequest.scope === 'subtree' ? 'this part + sub-components' : 'this part'} for review by{' '}
                  {activeRequest.approvers.map(a => a.name).join(', ')}.
                </div>
              )}
              {approvalsLoading ? (
                <div className="flex flex-col gap-0">
                  {[0, 1].map(i => (
                    <div key={i} className="flex items-start gap-3 py-2.5 px-2 -mx-2">
                      <div className="flex flex-col items-center shrink-0 mt-1.5">
                        <Skeleton className="w-2 h-2 rounded-full" />
                        {i < 1 && <Skeleton className="w-px flex-1 min-h-[18px] mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <Skeleton className="h-3 w-24 mb-1.5" />
                        <Skeleton className="h-3 w-full mb-1" />
                        <Skeleton className="h-2.5 w-28" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approval activity yet.</p>
              ) : (
                <div className="flex flex-col gap-0">
                  {approvals.map((a, i) => {
                    const color = a.action === 'approved' ? '#16A34A' : '#DC2626';
                    return (
                      <div key={a.id} className="flex items-start gap-3 py-2.5 px-2 -mx-2">
                        <div className="flex flex-col items-center shrink-0 mt-1.5">
                          <div className="w-2 h-2 rounded-full border-2 shrink-0" style={{ borderColor: color, background: color }} />
                          {i < approvals.length - 1 && <div className="w-px bg-border flex-1 min-h-[18px] mt-1" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="text-xs font-semibold" style={{ color }}>
                              {a.action === 'approved' ? 'Approved' : 'Rejected'}
                            </span>
                            <span className="text-[11px] text-muted-foreground">by {a.performedByName}</span>
                          </div>
                          {a.reason && (
                            <div className="text-[11.5px] text-foreground leading-snug">Reason: {a.reason}</div>
                          )}
                          {a.comment && (
                            <div className="text-[11.5px] text-muted-foreground leading-snug">{a.comment}</div>
                          )}
                          <div className="text-[10.5px] text-muted-foreground/60 mt-0.5">
                            {new Date(a.date).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Hierarchy */}
            <Card title="Hierarchy">
              <div className="flex flex-col">
                {path.map((p, i) => {
                  const isCur = p.id === originalNode.id;
                  const pm = getCategoryMeta(p.cat);
                  return (
                    <div key={p.id}
                      onClick={() => !isCur && onNavigate(p.id)}
                      className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg transition-colors"
                      style={{ marginLeft: i * 14, cursor: isCur ? 'default' : 'pointer', background: isCur ? 'hsl(var(--muted))' : undefined }}
                      onMouseEnter={e => { if (!isCur) (e.currentTarget as HTMLElement).style.background = 'hsl(var(--muted))'; }}
                      onMouseLeave={e => { if (!isCur) (e.currentTarget as HTMLElement).style.background = ''; }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: pm.tint }} />
                      <span className={`text-[12.5px] truncate ${isCur ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                        {p.name || p.desc}
                      </span>
                      <span className="text-[11px] font-mono shrink-0 text-muted-foreground">{p.pn}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Documents */}
            <BOMDocuments nodeId={originalNode.id} />
          </div>
        </div>
      </div>
        </>
      )}

      {/* Add Sub-component dialog */}
      <AddSubcomponentDialog
        open={showAddSub}
        onClose={() => setShowAddSub(false)}
        parentNode={node}
        onCreateNew={() => { setShowAddSub(false); setShowCreateNewSub(true); }}
        onImportExcel={() => { setShowAddSub(false); setShowImportExcel(true); }}
      />

      {/* Create New Sub-component sheet */}
      <BOMPartSheet
        mode="add"
        projectId={projectId}
        orgId={orgId}
        open={showCreateNewSub}
        onClose={() => setShowCreateNewSub(false)}
        onSave={handleNewSubSaved}
      />

      {/* Import Sub-components from Excel */}
      <BOMImportSubcomponentsDialog
        open={showImportExcel}
        onClose={() => setShowImportExcel(false)}
        parentNode={originalNode}
        projectId={projectId}
        orgId={orgId}
      />

      {/* Edit Part sheet */}
      <BOMPartSheet
        mode="edit"
        projectId={projectId}
        orgId={orgId}
        node={node}
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSave={handleSave}
        resubmitMode={originalNode.status === 'rejected'}
      />

      {/* New ECO sheet */}
      <BOMECOSheet
        open={ecoOpen}
        onClose={() => setEcoOpen(false)}
        node={node}
        projectId={projectId}
        onCreated={onEcoCreated}
      />

      {/* Send for review */}
      <BOMSendForReviewModal
        open={showSendForReview}
        projectId={projectId}
        partLabel={originalNode.pn}
        hasChildren={children.length > 0}
        onClose={() => setShowSendForReview(false)}
        onSubmit={handleSendForReview}
      />

      {/* Image viewer */}
      {viewingImage && photoUrl && (
        <ImageViewerModal src={photoUrl} onClose={() => setViewingImage(false)} />
      )}

      {/* Delete confirmation (warns about cascading sub-component deletion) */}
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleConfirmDelete}
        variant="destructive"
        confirmText={bomCountAll(node.children ?? []) > 0 ? 'Delete All' : 'Delete Part'}
        {...describeDeleteImpact(node)}
      />
    </div>
  );
}
