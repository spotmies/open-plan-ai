/**
 * BOMPartSheet — centred full-size dialog for Add / Edit a BOM part.
 * Tabs: Details · Sourcing · Traceability · Documents
 * Edit mode shows version management inline.
 */
import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBomDocuments, isImageAttachment } from '@/hooks/useBomDocuments';
import { resolveFileUrl } from '@/utils/fileUrl';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Zap, Cpu, Package, Box, Monitor, Shield, Layers, ChevronsUpDown, Tag,
  CheckCircle, Clock, GitBranch, Save, Plus, X, ChevronRight, ChevronLeft,
  FileText, ImageIcon, Upload, Paperclip, AlertCircle, Link as LinkIcon,
  Check, XCircle, History, Loader2,
  FileSpreadsheet, ExternalLink,
} from 'lucide-react';
import {
  BOMNode, BOMStatus, BOMCategory, BOM_CAT_META, KNOWN_BOM_CATEGORIES, UOM_OPTIONS, SupplierEntry, CustomFieldEntry,
} from './bomData';
import { BOMStatusPill } from './BOMShared';
import { BOMRejectDialog } from './BOMRejectDialog';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { useProjectMembers } from '@/hooks/useProjectTeam';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useDecideApprovalRequest, useActiveBomApprovalRequest, useBomNodeApprovals } from '@/hooks/useBom';
import { useAuth } from '@/contexts/AuthContext';
import { TeamMember } from '@/types';

// ── Document value: either an uploaded file, a linked URL, or an existing server attachment ───────
export type DocValue =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string; fileName?: string }
  | { kind: 'existing'; id: string; url: string; fileName?: string | null };

// ── Public payload type ───────────────────────────────────────────
export interface BOMPartPayload {
  mode: 'add' | 'edit';
  pn: string;
  name: string;
  desc: string;
  category: BOMCategory;
  status: BOMStatus;
  rev: string;
  qty: number;
  uom: string;
  manufacturer: string;
  distributor: string;
  price: number;
  leadTime: number;
  mpn: string;
  suppliers: SupplierEntry[];
  owner: string;
  ownerId?: string;
  req: string[];
  // documents (uploaded file or linked URL; null = cleared, undefined = unchanged)
  docPhoto?: DocValue | null;
  // technical files support multiple attachments per category
  docDatasheet?: DocValue[];
  doc3DModel?: DocValue[];
  docFootprint?: DocValue[];
  docCustom?: DocValue[];
  customFields: CustomFieldEntry[];
  // edit-only version fields
  versionMode?: 'same' | 'new';
  newRevLabel?: string;
  changeNotes?: string;
}

interface Props {
  mode: 'add' | 'edit';
  node?: BOMNode;           // required when mode === 'edit'
  projectId: string;
  orgId: string;
  open: boolean;
  onClose: () => void;
  onSave: (payload: BOMPartPayload) => void | Promise<void>;
  resubmitMode?: boolean;   // true when editing a rejected node — save also resubmits for review
}

// ── Draft persistence (Add mode only — Edit mode already reflects saved server state) ──
// File attachments (docPhoto/techSections) can't survive JSON serialization, so they're
// intentionally excluded from the draft; everything else the user typed is restored.
interface BOMPartDraft {
  savedAt: number;
  pn: string; name: string; desc: string; category: BOMCategory; status: BOMStatus; rev: string;
  qty: string; uom: string; manufacturer: string; suppliers: SupplierEntry[];
  leadTime: string; leadTimeUnit: LeadTimeUnit; mpn: string; ownerId: string | null;
  req: string[]; customFields: CustomFieldEntry[]; activeTab: WizardTabId;
}

// ── Constants ─────────────────────────────────────────────────────
const TABS = ['details', 'sourcing', 'traceability', 'documents'] as const;
type WizardTabId = typeof TABS[number];
type TabId = WizardTabId | 'history';
// 'history' isn't part of the linear wizard flow — treat it as index -1 so Next/Back math stays well-defined.
const wizardIndex = (t: TabId) => (t === 'history' ? -1 : TABS.indexOf(t));
const MOBILE_STEP_LABEL: Record<WizardTabId, string> = {
  details: 'Details', sourcing: 'Sourcing', traceability: 'Traceability', documents: 'Documents',
};

const LETTERS = 'ABCDEFGHIJ';
const CATEGORIES: BOMCategory[] = [...KNOWN_BOM_CATEGORIES];
const CAT_ICONS: Record<BOMCategory, React.ElementType> = {
  assembly: Layers, power: Zap, control: Cpu, connector: Package,
  enclosure: Box, hmi: Monitor, safety: Shield,
};
const isKnownCategory = (cat: BOMCategory) => (CATEGORIES as string[]).includes(cat);

type LeadTimeUnit = 'days' | 'weeks' | 'months';
// BOMPartPayload.leadTime is always expressed in days downstream — these factors convert into days.
const LEAD_TIME_UNITS: { id: LeadTimeUnit; label: string; toDays: number }[] = [
  { id: 'days', label: 'Days', toDays: 1 },
  { id: 'weeks', label: 'Weeks', toDays: 7 },
  { id: 'months', label: 'Months', toDays: 30 },
];

// Pick whichever unit reproduces a stored day count cleanly, so re-opening
// the edit form shows back what the user most likely entered.
function deriveLeadTime(days: number): { value: string; unit: LeadTimeUnit } {
  if (days > 0 && days % 30 === 0) return { value: String(days / 30), unit: 'months' };
  if (days > 0 && days % 7 === 0) return { value: String(days / 7), unit: 'weeks' };
  return { value: days > 0 ? String(days) : '', unit: 'days' };
}

function nextRev(rev: string) {
  const i = LETTERS.indexOf(rev.toUpperCase());
  return i >= 0 && i < LETTERS.length - 1 ? LETTERS[i + 1] : rev;
}

// ── Small form primitives ─────────────────────────────────────────
const FL = ({ label, required, children, className }: {
  label: string; required?: boolean; children: React.ReactNode; className?: string;
}) => (
  <div className={cn('space-y-1.5', className)}>
    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
    {children}
  </div>
);

const FInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <Input {...props} className={cn('h-8 text-sm bg-muted border-border focus-visible:ring-1', props.className)} />
);

export type TechFileSection = {
  id: string;
  label: string;
  hint: string;
  accept: string;
  icon: React.ElementType;
  value: DocValue[];
};

const DEFAULT_TECH_SECTIONS: TechFileSection[] = [
  { id: 'datasheet', label: 'Datasheet', hint: 'PDF · Manufacturer datasheet', accept: '.pdf,application/pdf', icon: FileText, value: [] },
  { id: '3dmodel', label: '3D Model (STEP)', hint: '.step, .stp · CAD model file', accept: '.step,.stp', icon: Paperclip, value: [] },
  { id: 'footprint', label: 'Footprint Library', hint: '.kicad_mod, .lib · EDA footprint', accept: '.kicad_mod,.lib,.lbr', icon: Paperclip, value: [] }
];

// ── File upload row (supports multiple uploaded files and/or linked URLs) ──
interface FileRowProps {
  icon: React.ElementType;
  label: string;
  hint: string;
  accept: string;
  value: DocValue[];
  onChange: (v: DocValue[]) => void;
}
function FileRow({ icon: Icon, label, hint, accept, value, onChange }: FileRowProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onChange([...value, ...Array.from(files).map(file => ({ kind: 'file', file }) as DocValue)]);
  };
  const addUrl = () => {
    let u = urlInput.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try {
      new URL(u);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }
    onChange([...value, { kind: 'url', url: u }]);
    setUrlInput('');
    setShowUrlInput(false);
  };
  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn("rounded-lg border transition-colors", isDragging ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/30")}
    >
      <div className="flex items-center gap-3 p-3">
        <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">{label}</div>
          {value.length === 0 && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => ref.current?.click()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-border bg-background hover:bg-muted transition-colors">
            <Upload className="w-3 h-3" /> Upload
          </button>
          <button onClick={() => setShowUrlInput(s => !s)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-border bg-background hover:bg-muted transition-colors">
            <LinkIcon className="w-3 h-3" /> URL
          </button>
        </div>
        <input ref={ref} type="file" accept={accept} multiple className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
      </div>
      {value.length > 0 && (
        <div className="px-3 pb-3 -mt-1 space-y-1.5">
          {value.map((v, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/50 border border-border/50">
              {v.kind === 'file' ? (
                <>
                  <span className="text-[11px] text-primary font-medium truncate flex-1">{v.file.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    ({(v.file.size / 1024).toFixed(0)} KB)
                  </span>
                </>
              ) : v.kind === 'existing' ? (
                <>
                  <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-[11px] text-foreground/70 font-medium truncate flex-1">
                    {v.fileName || v.url.split('/').pop()?.split(/[?#]/)[0] || 'Existing file'}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">Saved</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-[11px] text-primary font-medium truncate flex-1">{v.url}</span>
                </>
              )}
              <button onClick={() => removeAt(i)}
                className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {showUrlInput && (
        <div className="px-3 pb-3 -mt-1 flex items-center gap-2">
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addUrl(); }}
            placeholder="https://example.com/file.pdf"
            className="flex-1 h-8 text-xs bg-muted border border-border rounded-md px-2.5 outline-none focus:border-primary/40 placeholder:text-muted-foreground/50"
          />
          <button
            disabled={!urlInput.trim()}
            onClick={addUrl}
            className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-foreground text-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// ── Photo upload (supports uploading a file or linking a URL) ──────
function PhotoUpload({ value, onChange }: { value: DocValue | null; onChange: (v: DocValue | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = useState('');
  const preview = value?.kind === 'file' ? URL.createObjectURL(value.file) : (value?.kind === 'url' || value?.kind === 'existing') ? value.url : null;

  const addUrl = () => {
    let u = urlInput.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try {
      new URL(u);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }
    onChange({ kind: 'url', url: u });
    setUrlInput('');
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (mode !== 'file' || value) return;
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (mode !== 'file' || value) return;
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    if (mode !== 'file' || value) return;
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onChange({ kind: 'file', file });
      } else {
        toast.error('Please upload an image file');
      }
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Product Photo
      </Label>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => { if (!value && mode === 'file') ref.current?.click(); }}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors',
          value ? 'border-primary/40 bg-primary/5' : isDragging ? 'border-primary bg-primary/10' : 'border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/30',
          !value && mode === 'file' && 'cursor-pointer',
        )}
        style={{ height: 140 }}
      >
        {preview ? (
          <>
            <img src={preview} alt="preview" className="w-full h-full object-contain rounded-xl opacity-80" />
            {(value?.kind === 'file' || value?.kind === 'existing') && (
              <div onClick={() => ref.current?.click()}
                className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30 rounded-xl cursor-pointer">
                <span className="text-xs text-white font-medium">Click to replace</span>
              </div>
            )}
          </>
        ) : mode === 'file' ? (
          <>
            <ImageIcon className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <span className="text-xs text-muted-foreground">Click to upload product photo</span>
            <span className="text-[10px] text-muted-foreground/60 mt-0.5">PNG, JPG, WEBP · max 10 MB</span>
          </>
        ) : (
          <div className="w-full px-4 flex flex-col items-center gap-2">
            <LinkIcon className="w-6 h-6 text-muted-foreground/40" />
            <div className="w-full flex items-center gap-2">
              <input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addUrl(); }}
                onClick={e => e.stopPropagation()}
                placeholder="https://example.com/photo.jpg"
                className="flex-1 h-8 text-xs bg-background border border-border rounded-md px-2.5 outline-none focus:border-primary/40 placeholder:text-muted-foreground/50"
              />
              <button
                disabled={!urlInput.trim()}
                onClick={e => { e.stopPropagation(); addUrl(); }}
                className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-foreground text-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {value ? (
          <>
            <button onClick={() => onChange(null)} className="text-[11px] text-destructive hover:underline">
              Remove photo
            </button>
            {value.kind === 'url' && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[260px]">{value.url}</span>
            )}
            {value.kind === 'existing' && value.fileName && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[260px]">{value.fileName}</span>
            )}
          </>
        ) : (
          <button onClick={() => setMode(m => m === 'file' ? 'url' : 'file')} className="text-[11px] text-muted-foreground hover:text-foreground underline">
            {mode === 'file' ? 'or paste an image URL' : 'or upload a file instead'}
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onChange({ kind: 'file', file: f }); setMode('file'); } }} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
export function BOMPartSheet({ mode, node, projectId, orgId, open, onClose, onSave, resubmitMode }: Props) {
  const isEdit = mode === 'edit';
  const isMobile = useIsMobile();

  const { user } = useAuth();
  const { data: projectMembers = [] } = useProjectMembers(projectId);
  const { data: project } = useProjectDetail(projectId);
  const projectRole = (project?.myRole || '').toLowerCase();
  const canEditStatus = projectRole === 'admin' || projectRole === 'maintainer';
  const isAdmin = projectRole === 'admin';

  const decideApprovalRequest = useDecideApprovalRequest(projectId);
  const activeRequest = useActiveBomApprovalRequest(isEdit ? node?.id : undefined);
  const isAssignedApprover = !!user && !!activeRequest && activeRequest.approvers.some(a => a.id === user.id);
  const { data: approvals = [], isLoading: approvalsLoading } = useBomNodeApprovals(isEdit ? node?.id : undefined);
  const { data: existingDocs = [], isLoading: docsLoading } = useBomDocuments(isEdit ? node?.id : undefined);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // ── Form state ──
  const [pn, setPn] = useState(node?.pn ?? '');
  const [name, setName] = useState(isEdit ? (node?.name || node?.pn || '') : (node?.name ?? ''));
  const [desc, setDesc] = useState(node?.desc ?? '');
  const [category, setCategory] = useState<BOMCategory>(node?.cat ?? 'assembly');
  const [status, setStatus] = useState<BOMStatus>(node?.status ?? 'pending');
  const [rev, setRev] = useState(node?.rev ?? 'A');
  const [qty, setQty] = useState(String(node?.qty ?? 1));
  const [uom, setUom] = useState(node?.uom ?? 'EA');
  const [manufacturer, setManufacturer] = useState(node?.manufacturer ?? '');
  const initialLeadTime = deriveLeadTime(node?.leadTime ?? 0);

  const defaultSuppliers = (): SupplierEntry[] => {
    if (node?.suppliers?.length) return node.suppliers.map(s => ({ ...s }));
    return [{ distributor: node?.distributor ?? '', price: node?.price ? String(node.price) : '', calcFromSubparts: isEdit ? node?.price === 0 : false }];
  };
  const [suppliers, setSuppliers] = useState<SupplierEntry[]>(defaultSuppliers);
  const [leadTime, setLeadTime] = useState(initialLeadTime.value);
  const [leadTimeUnit, setLeadTimeUnit] = useState<LeadTimeUnit>(initialLeadTime.unit);
  const [mpn, setMpn] = useState(node?.mpn ?? '');
  const [selectedOwner, setSelectedOwner] = useState<TeamMember | null>(null);
  const [ownerPopover, setOwnerPopover] = useState(false);
  const [req, setReq] = useState<string[]>(node?.req ?? []);
  const [activeTab, setActiveTab] = useState<TabId>('details');
  const [reqInput, setReqInput] = useState('');
  // documents
  const [docPhoto, setDocPhoto] = useState<DocValue | null>(null);
  const [techSections, setTechSections] = useState<TechFileSection[]>(DEFAULT_TECH_SECTIONS);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [docsPopulated, setDocsPopulated] = useState(false);

  const [customFields, setCustomFields] = useState<CustomFieldEntry[]>(Array.isArray(node?.customFields) ? node.customFields : []);
  const [versionMode, setVersionMode] = useState<'same' | 'new'>('same');
  const [newRevLabel, setNewRevLabel] = useState(node ? nextRev(node.rev) : 'B');
  const [changeNotes, setChangeNotes] = useState('');
  // validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Reset all form state when the dialog opens so stale data never shows.
  useEffect(() => {
    if (!open) return;
    setPn(node?.pn ?? '');
    // In edit mode, fall back to the part number when name is empty so the form
    // shows the same identifier the detail view heading displays.
    setName(isEdit ? (node?.name || node?.pn || '') : (node?.name ?? ''));
    setDesc(node?.desc ?? '');
    setCategory(node?.cat ?? 'assembly');
    setStatus(node?.status ?? 'pending');
    setRev(node?.rev ?? 'A');
    setQty(String(node?.qty ?? 1));
    setUom(node?.uom ?? 'EA');
    setManufacturer(node?.manufacturer ?? '');
    setSuppliers(
      node?.suppliers?.length
        ? node.suppliers.map(s => ({ ...s }))
        : [{ distributor: node?.distributor ?? '', price: node?.price ? String(node.price) : '', calcFromSubparts: node?.price === 0 }]
    );
    const lt = deriveLeadTime(node?.leadTime ?? 0);
    setLeadTime(lt.value);
    setLeadTimeUnit(lt.unit);
    setMpn(node?.mpn ?? '');
    setSelectedOwner(null);
    setOwnerPopover(false);
    setReq(node?.req ?? []);
    setReqInput('');
    setDocPhoto(null);
    setTechSections(DEFAULT_TECH_SECTIONS.map(s => ({ ...s, value: [] })));
    setDocsPopulated(false);
    setIsAddingSection(false);
    setNewSectionName('');
    setCustomFields(Array.isArray(node?.customFields) ? node.customFields : []);
    setVersionMode('same');
    setNewRevLabel(node ? nextRev(node.rev) : 'B');
    setChangeNotes('');
    setErrors({});
    setActiveTab('details');
  }, [open, node?.id, JSON.stringify(node?.customFields)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map the node's owner to a project member once members are loaded
  useEffect(() => {
    if (!open || selectedOwner || projectMembers.length === 0) return;
    if (isEdit && node) {
      const match = node.ownerId
        ? projectMembers.find(m => m.id === node.ownerId)
        : node.owner
          ? projectMembers.find(m => m.name === node.owner)
          : null;
      if (match) setSelectedOwner(match);
    }
  }, [open, isEdit, node, projectMembers, selectedOwner]);

  // Pre-populate Documents tab from existing server attachments (edit mode only)
  useEffect(() => {
    if (!open || !isEdit || !node?.id || docsLoading || docsPopulated) return;

    const photoDoc = existingDocs.find(isImageAttachment);
    if (photoDoc) {
      const url = resolveFileUrl(photoDoc.fileUrl);
      if (url) {
        setDocPhoto({ kind: 'existing', id: photoDoc.id, url, fileName: photoDoc.fileName });
      }
    }

    const nonImageDocs = existingDocs.filter(d => !isImageAttachment(d));
    if (nonImageDocs.length > 0) {
      setTechSections(ts => {
        const updated = ts.map(s => ({ ...s, value: [] as DocValue[] }));
        const orphans: DocValue[] = [];
        for (const doc of nonImageDocs) {
          const url = resolveFileUrl(doc.fileUrl);
          if (!url) continue;
          const entry: DocValue = { kind: 'existing', id: doc.id, url, fileName: doc.fileName };
          const ext = (doc.fileName || doc.fileUrl || '').split('.').pop()?.toLowerCase().split(/[?#]/)[0] ?? '';
          if (doc.mimeType === 'application/pdf' || ext === 'pdf') {
            updated.find(s => s.id === 'datasheet')?.value.push(entry) ?? orphans.push(entry);
          } else if (['step', 'stp', 'iges', 'igs', 'stl'].includes(ext)) {
            updated.find(s => s.id === '3dmodel')?.value.push(entry) ?? orphans.push(entry);
          } else if (['kicad_mod', 'kicad_pcb', 'lib', 'lbr'].includes(ext)) {
            updated.find(s => s.id === 'footprint')?.value.push(entry) ?? orphans.push(entry);
          } else {
            orphans.push(entry);
          }
        }
        if (orphans.length > 0) {
          return [...updated, { id: 'existing-other', label: 'Other Files', hint: 'Existing attachments', accept: '*/*', icon: Paperclip, value: orphans }];
        }
        return updated;
      });
    }

    setDocsPopulated(true);
  }, [open, isEdit, node?.id, docsLoading, existingDocs, docsPopulated]);

  // Lock background scroll while the mobile full-page flow covers the viewport.
  useEffect(() => {
    if (!isMobile || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isMobile, open]);

  const addReq = () => {
    const v = reqInput.trim().toUpperCase();
    if (v && !req.includes(v)) { setReq(r => [...r, v]); }
    setReqInput('');
  };
  const removeReq = (r: string) => setReq(rs => rs.filter(x => x !== r));

  const validateTab = (tab: WizardTabId): boolean => {
    const e: Record<string, string> = {};
    if (tab === 'details') {
      if (!isEdit && !pn.trim()) e.pn = 'Part number is required';
      if (!name.trim()) e.name = 'Part name is required';
      if (!desc.trim()) e.desc = 'Description is required';
      if (!category.trim()) e.category = !isKnownCategory(category) ? 'Please enter a custom category name' : 'Category is required';
      if (!selectedOwner && !(isEdit && node?.owner)) e.owner = 'Owner is required';
    }
    if (tab === 'sourcing') {
      if (!manufacturer.trim()) e.mfr = 'Manufacturer is required';
      if (!mpn.trim()) e.mpn = 'MPN is required';
      if (!qty.trim()) e.qty = 'Valid quantity is required';
      else if (parseFloat(qty) > 1000000) e.qty = 'Quantity must be 1,000,000 or less';
      if (!leadTime.trim() || isNaN(parseFloat(leadTime))) e.leadTime = 'Lead time is required';
      suppliers.forEach((s, i) => {
        if (!s.distributor.trim()) e[`sup_dist_${i}`] = 'Supplier name is required';
        if (!s.calcFromSubparts && (!s.price.trim() || isNaN(parseFloat(s.price)))) e[`sup_price_${i}`] = 'Unit price is required';
      });
    }
    if (tab === 'documents') {
      if (isEdit && versionMode === 'new' && !changeNotes.trim())
        e.notes = 'Change notes are required when creating a new revision';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const [checkingPn, setCheckingPn] = useState(false);

  const handleNext = async () => {
    if (activeTab === 'history') return;
    if (!validateTab(activeTab)) return;
    if (!isEdit && activeTab === 'details') {
      setCheckingPn(true);
      try {
        const res = await apiClient.get<{ exists: boolean }>(
          ENDPOINTS.PARTS.CHECK(orgId),
          { params: { partNumber: pn.trim().toUpperCase() } },
        );
        if (res.exists) {
          setErrors(e => ({ ...e, pn: `Part number '${pn.trim().toUpperCase()}' already exists` }));
          return;
        }
      } catch {
        setErrors(e => ({ ...e, pn: 'Part number already exists' }));
        return;
      } finally {
        setCheckingPn(false);
      }
    }
    setActiveTab(TABS[wizardIndex(activeTab) + 1]);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!isEdit && !pn.trim()) e.pn = 'Part number is required';
    if (!name.trim()) e.name = 'Part name is required';
    if (!desc.trim()) e.desc = 'Description is required';
    if (!category.trim()) e.category = !isKnownCategory(category) ? 'Please enter a custom category name' : 'Category is required';
    if (!manufacturer.trim()) e.mfr = 'Manufacturer is required';
    if (!mpn.trim()) e.mpn = 'MPN is required';
    if (!leadTime.trim() || isNaN(parseFloat(leadTime))) e.leadTime = 'Lead time is required';
    if (!selectedOwner && !(isEdit && node?.owner)) e.owner = 'Owner is required';
    if (isEdit && versionMode === 'new' && !changeNotes.trim()) e.notes = 'Change notes are required when creating a new revision';
    suppliers.forEach((s, i) => {
      if (!s.distributor.trim()) e[`sup_dist_${i}`] = 'Supplier name is required';
      if (!s.calcFromSubparts && (!s.price.trim() || isNaN(parseFloat(s.price)))) e[`sup_price_${i}`] = 'Unit price is required';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      await onSave({
        mode,
        pn: isEdit ? (node?.pn ?? pn) : pn.trim().toUpperCase(),
        name: name.trim(),
        desc, category: category.trim().toLowerCase(), status,
        rev: isEdit ? (versionMode === 'new' ? (newRevLabel || nextRev(node!.rev)) : node!.rev) : rev,
        qty: parseFloat(qty) || 1,
        uom,
        manufacturer,
        distributor: suppliers[0]?.distributor ?? '',
        price: suppliers[0]?.calcFromSubparts ? 0 : (parseFloat(suppliers[0]?.price ?? '') || 0),
        leadTime: (parseFloat(leadTime) || 0) * LEAD_TIME_UNITS.find(u => u.id === leadTimeUnit)!.toDays,
        mpn,
        suppliers: suppliers.map(s => ({
          distributor: s.distributor,
          price: s.calcFromSubparts ? '0' : s.price,
          calcFromSubparts: s.calcFromSubparts,
        })),
        owner: selectedOwner?.name ?? (isEdit ? node?.owner ?? '' : ''),
        ownerId: selectedOwner?.id,
        req,
        customFields: customFields.filter(f => f.label.trim()),
        docPhoto,
        docDatasheet: techSections.find(s => s.id === 'datasheet')?.value || [],
        doc3DModel: techSections.find(s => s.id === '3dmodel')?.value || [],
        docFootprint: techSections.find(s => s.id === 'footprint')?.value || [],
        docCustom: techSections.filter(s => !['datasheet', '3dmodel', 'footprint'].includes(s.id)).flatMap(s => s.value),
        versionMode: isEdit ? versionMode : undefined,
        newRevLabel: isEdit && versionMode === 'new' ? newRevLabel : undefined,
        changeNotes: isEdit ? changeNotes : undefined,
      });
      onClose();
    } catch {
      // onSave already surfaces a toast on failure; keep the dialog open so the user can retry
    } finally {
      setSaving(false);
    }
  };

  const handleApproveClick = async () => {
    if (!node || !activeRequest) return;
    try {
      await decideApprovalRequest.mutateAsync({ requestId: activeRequest.id, nodeId: node.id, decision: 'approved' });
      toast.success(`${node.pn} approved`);
      onClose();
    } catch (err) {
      toast.error('Failed to approve part', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleRejectConfirm = async (reason: string, comment?: string) => {
    if (!node || !activeRequest) return;
    try {
      await decideApprovalRequest.mutateAsync({ requestId: activeRequest.id, nodeId: node.id, decision: 'rejected', reason, comment });
      toast.success(`${node.pn} rejected`);
      onClose();
    } catch (err) {
      toast.error('Failed to reject part', {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err;
    }
  };

  // ── Mobile: full-page step flow instead of a centered dialog ──────
  if (isMobile) {
    const stepIdx = wizardIndex(activeTab);
    const onHeaderBack = () => {
      if (saving) return;
      if (activeTab === 'history') { setActiveTab('documents'); return; }
      if (stepIdx > 0) { setErrors({}); setActiveTab(TABS[stepIdx - 1]); return; }
      onClose();
    };

    return (
      <>
        {open && createPortal(
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-background flex flex-col">
            {/* Header */}
            <div className="shrink-0 border-b border-border px-4 pt-4 pb-3">
              <div className="flex items-center justify-between gap-2 mb-3">
                <button type="button" onClick={onHeaderBack} disabled={saving}
                  className="w-9 h-9 shrink-0 rounded-lg bg-muted flex items-center justify-center text-foreground disabled:opacity-50">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2 min-w-0 justify-center truncate">
                  {isEdit ? 'Edit Part' : 'Add New Part'}
                  {isEdit && node && (
                    <span className="text-xs font-mono font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                      {node.pn}
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isEdit && node && activeTab !== 'history' && (
                    <button type="button" onClick={() => setActiveTab('history')} disabled={saving} title="History"
                      className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-foreground disabled:opacity-50">
                      <History className="w-4 h-4" />
                    </button>
                  )}
                  <button type="button" onClick={onClose} disabled={saving}
                    className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-foreground disabled:opacity-50">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {isEdit
                  ? 'Update part details. Choose to overwrite the current revision or create a new one.'
                  : 'Fill in all required fields to add a new part to the Bill of Materials.'}
              </p>
            </div>

            {/* Progress */}
            {activeTab !== 'history' && (
              <div className="shrink-0 px-4 pt-3 pb-1">
                <div className="flex gap-1.5">
                  {TABS.map((t, i) => (
                    <div key={t} className={cn('h-1 flex-1 rounded-full', i <= stepIdx ? 'bg-primary' : 'bg-muted')} />
                  ))}
                </div>
                <div className="mt-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Step {stepIdx + 1} of {TABS.length} — {MOBILE_STEP_LABEL[activeTab as WizardTabId]}
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {activeTab === 'details' && (
                <div className="space-y-5">
                  <FL label="Part Number" required={!isEdit}>
                    {isEdit ? (
                      <div className="h-9 px-3 flex items-center bg-muted/50 border border-border rounded-md text-sm font-mono text-muted-foreground">
                        {node?.pn}
                      </div>
                    ) : (
                      <>
                        <FInput value={pn} onChange={e => setPn(e.target.value)}
                          placeholder="e.g. EV-PWR-020" className="h-9 font-mono uppercase" />
                        {errors.pn && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.pn}</p>}
                      </>
                    )}
                  </FL>

                  <FL label="Part Name" required>
                    <FInput value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Power Module" className="h-9" />
                    {errors.name && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.name}</p>}
                  </FL>

                  <FL label="Description" required>
                    <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief technical description of the part"
                      className="text-sm bg-muted border-border resize-none" rows={4} />
                    {errors.desc && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.desc}</p>}
                  </FL>

                  <FL label="Category" required>
                    <div className="grid grid-cols-4 gap-2">
                      {CATEGORIES.map(cat => {
                        const m = BOM_CAT_META[cat];
                        const Icon = CAT_ICONS[cat];
                        const active = category === cat;
                        return (
                          <button key={cat} type="button" onClick={() => setCategory(cat)}
                            className={cn(
                              'flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border text-center transition-colors',
                              active ? 'border-primary/60 bg-primary/5' : 'border-border hover:bg-muted/50'
                            )}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${m.tint}20` }}>
                              <Icon className="w-4 h-4" style={{ color: m.tint }} />
                            </div>
                            <span className={cn('text-[10px] font-medium leading-tight', active ? 'text-primary' : 'text-muted-foreground')}>
                              {m.label.split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                      <button type="button" onClick={() => setCategory('')}
                        className={cn(
                          'flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border text-center transition-colors',
                          !isKnownCategory(category) ? 'border-primary/60 bg-primary/5' : 'border-border hover:bg-muted/50'
                        )}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted">
                          <Tag className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className={cn('text-[10px] font-medium leading-tight', !isKnownCategory(category) ? 'text-primary' : 'text-muted-foreground')}>
                          Other
                        </span>
                      </button>
                    </div>
                    {!isKnownCategory(category) && (
                      <div className="mt-2">
                        <label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-0.5">
                          Custom category name<span className="text-destructive ml-0.5">*</span>
                        </label>
                        <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Enter a custom category"
                          className={`h-9 ${errors.category ? 'border-destructive focus-visible:ring-destructive' : ''}`} maxLength={50} />
                      </div>
                    )}
                    {errors.category && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.category}</p>}
                  </FL>

                  <FL label="Status">
                    {!isEdit ? (
                      <>
                        <div className="flex gap-2">
                          {(['approved', 'pending'] as BOMStatus[]).map(s => (
                            <button key={s} type="button" disabled={!canEditStatus}
                              onClick={() => canEditStatus && setStatus(s)}
                              title={canEditStatus ? undefined : 'Only project managers or admins can change part status'}
                              className={cn(
                                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors',
                                status === s ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground',
                                canEditStatus ? '' : 'opacity-60'
                              )}>
                              {s === 'approved'
                                ? <CheckCircle className="w-4 h-4" style={{ color: '#16A34A' }} />
                                : <Clock className="w-4 h-4" style={{ color: '#D97706' }} />}
                              {s === 'approved' ? 'Approved' : 'Pending'}
                            </button>
                          ))}
                        </div>
                        {!canEditStatus && (
                          <p className="text-[11px] text-muted-foreground mt-1.5">Only project managers or admins can change part status.</p>
                        )}
                      </>
                    ) : node?.status === 'pending' && activeRequest && (isAssignedApprover || isAdmin) ? (
                      <div className="flex gap-2">
                        <button type="button" disabled={decideApprovalRequest.isPending} onClick={handleApproveClick}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium disabled:opacity-50">
                          {decideApprovalRequest.isPending
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Check className="w-4 h-4" style={{ color: '#16A34A' }} />}
                          Approve
                        </button>
                        <button type="button" disabled={decideApprovalRequest.isPending} onClick={() => setShowRejectDialog(true)}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium disabled:opacity-50">
                          <XCircle className="w-4 h-4" style={{ color: '#DC2626' }} />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 h-9">
                        <BOMStatusPill status={node?.status ?? 'pending'} />
                        {node?.status === 'pending' && !activeRequest && (
                          <span className="text-[11px] text-muted-foreground">Not yet sent for review.</span>
                        )}
                      </div>
                    )}
                  </FL>

                  <FL label="Owner / Handled By" required>
                    <Popover open={ownerPopover} onOpenChange={setOwnerPopover}>
                      <PopoverTrigger asChild>
                        <button type="button" className={cn(
                          'w-full h-9 flex items-center gap-2 px-3 rounded-md border text-sm transition-colors bg-muted border-border',
                          errors.owner && 'border-destructive'
                        )}>
                          {selectedOwner ? (
                            <>
                              <Avatar className="h-5 w-5 shrink-0">
                                <AvatarImage src={resolveFileUrl(selectedOwner.avatar) ?? selectedOwner.avatar} alt={selectedOwner.name} />
                                <AvatarFallback className="text-[9px] bg-primary/20 text-primary">{selectedOwner.initials}</AvatarFallback>
                              </Avatar>
                              <span className="flex-1 text-left truncate">{selectedOwner.name}</span>
                            </>
                          ) : isEdit && node?.owner ? (
                            <>
                              <Avatar className="h-5 w-5 shrink-0">
                                <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                                  {node.owner.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="flex-1 text-left truncate">{node.owner}</span>
                            </>
                          ) : (
                            <span className="flex-1 text-left text-muted-foreground">Select project member…</span>
                          )}
                          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[260px]" align="start">
                        <Command>
                          <CommandInput placeholder="Search members…" />
                          <CommandList>
                            <CommandEmpty>No members found.</CommandEmpty>
                            <CommandGroup heading="Project Members">
                              {projectMembers.map(member => (
                                <CommandItem key={member.id} value={`${member.id} ${member.name}`}
                                  onSelect={() => { setSelectedOwner(member); setOwnerPopover(false); }} className="cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={resolveFileUrl(member.avatar) ?? member.avatar} alt={member.name} />
                                      <AvatarFallback className="text-[9px]">{member.initials}</AvatarFallback>
                                    </Avatar>
                                    {member.name}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {errors.owner && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.owner}</p>}
                  </FL>

                  {!isEdit && (
                    <FL label="Initial Revision">
                      <div className="flex items-center gap-3">
                        <FInput value={rev} onChange={e => setRev(e.target.value.toUpperCase().slice(0, 3))} placeholder="A" className="h-9 w-24 font-mono" />
                        <span className="text-xs text-muted-foreground">Starting revision (typically "A")</span>
                      </div>
                    </FL>
                  )}
                </div>
              )}

              {activeTab === 'sourcing' && (
                <div className="space-y-5">
                  <FL label="Manufacturer" required>
                    <FInput value={manufacturer} onChange={e => setManufacturer(e.target.value)} placeholder="e.g. Texas Instruments" className="h-9" />
                    {errors.mfr && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.mfr}</p>}
                  </FL>
                  <FL label="Manufacturer PN (MPN)" required>
                    <FInput value={mpn} onChange={e => setMpn(e.target.value)} placeholder="e.g. TI-A4B2C" className="h-9 font-mono" />
                    {errors.mpn && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.mpn}</p>}
                  </FL>

                  <FL label="Quantity" required>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setQty(q => String(Math.max(0, (parseFloat(q) || 0) - 1)))}
                        className="w-9 h-9 shrink-0 rounded-md border border-border bg-muted flex items-center justify-center text-foreground text-lg leading-none">
                        −
                      </button>
                      <FInput value={qty} onChange={e => {
                        let val = e.target.value;
                        if (['EA', 'SET', 'PCS', 'LOT', 'LIC'].includes(uom)) {
                          val = val.replace(/[^0-9]/g, '').slice(0, 10);
                        } else {
                          val = val.replace(/[^0-9.]/g, '');
                          const parts = val.split('.');
                          if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                          if (parts[0].length > 10) val = parts.length > 1 ? parts[0].slice(0, 10) + '.' + parts[1] : parts[0].slice(0, 10);
                        }
                        setQty(val);
                      }} type="text" placeholder="1" className="h-9 flex-1 text-center" maxLength={15} />
                      <button type="button" onClick={() => setQty(q => String((parseFloat(q) || 0) + 1))}
                        className="w-9 h-9 shrink-0 rounded-md border border-border bg-muted flex items-center justify-center text-foreground text-lg leading-none">
                        +
                      </button>
                    </div>
                    {errors.qty && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.qty}</p>}
                  </FL>

                  <FL label="Unit of Measure (UOM)" required>
                    <div className="flex flex-wrap gap-1.5">
                      {UOM_OPTIONS.map(u => (
                        <button key={u} type="button" onClick={() => setUom(u)}
                          className={cn('px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                            uom === u ? 'bg-primary/10 text-primary border-primary/30' : 'bg-card text-muted-foreground border-border')}>
                          {u}
                        </button>
                      ))}
                    </div>
                  </FL>

                  <FL label="Lead Time" required>
                    <div className="flex items-center gap-1.5">
                      <FInput value={leadTime} onChange={e => setLeadTime(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                        type="text" placeholder="8" className="h-9 w-16 shrink-0" maxLength={6} />
                      <div className="flex gap-1 flex-1">
                        {LEAD_TIME_UNITS.map(u => (
                          <button key={u.id} type="button" onClick={() => setLeadTimeUnit(u.id)}
                            className={cn('flex-1 h-9 rounded-md text-xs font-medium border transition-colors',
                              leadTimeUnit === u.id ? 'bg-primary/10 text-primary border-primary/30' : 'bg-card text-muted-foreground border-border')}>
                            {u.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {errors.leadTime && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.leadTime}</p>}
                  </FL>

                  <div className="space-y-3">
                    {suppliers.map((sup, i) => (
                      <div key={i} className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Supplier {i + 1}</span>
                          {suppliers.length > 1 && (
                            <button type="button" onClick={() => setSuppliers(s => s.filter((_, idx) => idx !== i))}
                              className="text-muted-foreground hover:text-destructive" title="Remove supplier">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <FL label="Supplier / Distributor" required>
                          <FInput value={sup.distributor}
                            onChange={e => setSuppliers(s => s.map((x, idx) => idx === i ? { ...x, distributor: e.target.value } : x))}
                            placeholder="e.g. Digi-Key" className="h-9" />
                          {errors[`sup_dist_${i}`] && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors[`sup_dist_${i}`]}</p>}
                        </FL>
                        <FL label="Unit Price" required>
                          <FInput value={sup.calcFromSubparts ? '0.00' : sup.price}
                            onChange={e => {
                              let val = e.target.value.replace(/[^0-9.]/g, '');
                              const parts = val.split('.');
                              if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                              if (parts[0].length > 10) val = parts.length > 1 ? parts[0].slice(0, 10) + '.' + parts[1] : parts[0].slice(0, 10);
                              setSuppliers(s => s.map((x, idx) => idx === i ? { ...x, price: val } : x));
                            }}
                            disabled={sup.calcFromSubparts} type="text" placeholder="0.00" className="h-9" maxLength={15} />
                          {errors[`sup_price_${i}`] && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors[`sup_price_${i}`]}</p>}
                          <div className="flex items-center gap-2 mt-1.5">
                            <Checkbox id={`m_calcFromSubparts_${i}`} checked={sup.calcFromSubparts}
                              onCheckedChange={c => setSuppliers(s => s.map((x, idx) => idx === i ? { ...x, calcFromSubparts: !!c } : x))} />
                            <label htmlFor={`m_calcFromSubparts_${i}`} className="text-[11px] font-medium leading-none text-muted-foreground cursor-pointer select-none">
                              Calculate from sub-parts
                            </label>
                          </div>
                        </FL>
                      </div>
                    ))}
                    <button type="button" onClick={() => setSuppliers(s => [...s, { distributor: '', price: '', calcFromSubparts: false }])}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add Supplier
                    </button>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Additional Fields</span>
                    {customFields.map((field, i) => (
                      <div key={i} className="space-y-2">
                        <FL label="Field Label">
                          <FInput value={field.label}
                            onChange={e => setCustomFields(f => f.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                            placeholder="e.g. RoHS" className="h-9" />
                        </FL>
                        <FL label="Value">
                          <div className="flex items-center gap-1.5">
                            <FInput value={field.value}
                              onChange={e => setCustomFields(f => f.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
                              placeholder="e.g. Compliant" className="h-9 flex-1" />
                            <button type="button" onClick={() => setCustomFields(f => f.filter((_, idx) => idx !== i))}
                              className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </FL>
                      </div>
                    ))}
                    <button type="button" onClick={() => setCustomFields(f => [...f, { label: '', value: '' }])}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add Field
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'traceability' && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Requirements Links</Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      Link this part to system requirements it satisfies (e.g. SYS-001, PWR-003).
                    </p>
                    <div className="flex gap-2 mb-4">
                      <Input value={reqInput} onChange={e => setReqInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addReq(); } }}
                        placeholder="e.g. SYS-001" className="h-9 text-sm bg-muted border-border font-mono flex-1 uppercase" />
                      <Button size="sm" variant="outline" className="h-9 gap-1.5 px-4 shrink-0" onClick={addReq} disabled={!reqInput.trim()}>
                        <Plus className="w-3.5 h-3.5" /> Add
                      </Button>
                    </div>
                    {req.length === 0 ? (
                      <div className="flex items-center justify-center h-28 rounded-xl border-2 border-dashed border-border bg-muted/20">
                        <p className="text-sm text-muted-foreground text-center px-4">No requirements linked yet — type above to add</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {req.map(r => (
                          <span key={r} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-muted text-foreground border-border">
                            {r}
                            <button onClick={() => removeReq(r)} className="opacity-60 hover:opacity-100 transition-opacity">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-6">
                  <PhotoUpload value={docPhoto} onChange={setDocPhoto} />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block">Technical Files</Label>
                      {!isAddingSection && (
                        <button type="button" onClick={() => setIsAddingSection(true)}
                          className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add Section
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {techSections.map((section) => (
                        <div key={section.id} className="relative group">
                          <FileRow icon={section.icon} label={section.label} hint={section.hint} accept={section.accept}
                            value={section.value} onChange={(v) => setTechSections(ts => ts.map(s => s.id === section.id ? { ...s, value: v } : s))} />
                          <button type="button" onClick={() => setTechSections(ts => ts.filter(s => s.id !== section.id))}
                            className="absolute -right-2 -top-2 bg-destructive/10 text-destructive rounded-full p-1" title="Remove Section">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {isAddingSection && (
                        <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-border bg-card">
                          <FInput value={newSectionName} onChange={e => setNewSectionName(e.target.value)}
                            placeholder="Section Name (e.g. Test Report)" className="h-8 flex-1" autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newSectionName.trim()) {
                                  setTechSections(ts => [...ts, { id: Date.now().toString(), label: newSectionName.trim(), hint: 'Custom file', accept: '*/*', icon: Paperclip, value: [] }]);
                                  setIsAddingSection(false);
                                  setNewSectionName('');
                                }
                              } else if (e.key === 'Escape') {
                                setIsAddingSection(false);
                                setNewSectionName('');
                              }
                            }} />
                          <button type="button" onClick={() => {
                            if (newSectionName.trim()) {
                              setTechSections(ts => [...ts, { id: Date.now().toString(), label: newSectionName.trim(), hint: 'Custom file', accept: '*/*', icon: Paperclip, value: [] }]);
                              setIsAddingSection(false);
                              setNewSectionName('');
                            }
                          }} className="px-3 h-8 text-xs font-medium bg-primary text-primary-foreground rounded-md">Add</button>
                          <button type="button" onClick={() => { setIsAddingSection(false); setNewSectionName(''); }}
                            className="p-1.5 text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isEdit && node && (
                    <div className="pt-2 border-t border-border">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 mt-4">
                        Save as Version
                      </div>
                      <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-background mb-2">
                        <button type="button" onClick={() => setVersionMode('same')}
                          className={cn('flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                            versionMode === 'same' ? 'bg-card border border-border shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                          Update Rev {node.rev}
                        </button>
                        <button type="button" onClick={() => setVersionMode('new')}
                          className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                            versionMode === 'new' ? 'bg-card border border-border shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                          <GitBranch className="w-3.5 h-3.5" /> New revision
                        </button>
                      </div>
                      {versionMode === 'new' ? (
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                          <span className="text-xs text-muted-foreground shrink-0">Label:</span>
                          <Input value={newRevLabel} onChange={e => setNewRevLabel(e.target.value.toUpperCase().slice(0, 3))}
                            className="h-7 text-xs font-mono w-16 bg-background" placeholder="B" />
                          <span className="text-xs text-muted-foreground">Rev {node.rev} is preserved in history.</span>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground mb-4">Overwrites Rev {node.rev} in place. No history entry is created.</div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Change notes{versionMode === 'new' && <span className="text-destructive ml-0.5">*</span>}
                        </Label>
                        <Textarea value={changeNotes} onChange={e => setChangeNotes(e.target.value)}
                          placeholder={versionMode === 'new' ? 'Describe what changed in this revision…' : 'Optional: describe the correction made…'}
                          className="text-sm bg-background border-border resize-none min-h-[60px]" rows={2} />
                        {errors.notes && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.notes}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && isEdit && node && (
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1">Approval History</Label>
                  <p className="text-xs text-muted-foreground mb-4">Full record of approve/reject actions taken on this part.</p>
                  {approvalsLoading ? (
                    <div className="flex flex-col gap-3">
                      {[0, 1].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                    </div>
                  ) : approvals.length === 0 ? (
                    <div className="flex items-center justify-center h-28 rounded-xl border-2 border-dashed border-border bg-muted/20">
                      <p className="text-sm text-muted-foreground">No approval activity yet</p>
                    </div>
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
                                <span className="text-xs font-semibold" style={{ color }}>{a.action === 'approved' ? 'Approved' : 'Rejected'}</span>
                                <span className="text-[11px] text-muted-foreground">by {a.performedByName}</span>
                              </div>
                              {a.reason && <div className="text-[11.5px] text-foreground leading-snug">Reason: {a.reason}</div>}
                              {a.comment && <div className="text-[11.5px] text-muted-foreground leading-snug">{a.comment}</div>}
                              <div className="text-[10.5px] text-muted-foreground/60 mt-0.5">{new Date(a.date).toLocaleString()}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-border px-4 py-3 flex items-center gap-3 bg-card">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
              {activeTab === 'history' ? (
                <Button className="flex-1 gap-1.5" onClick={() => setActiveTab('documents')}>Done</Button>
              ) : activeTab !== 'documents' ? (
                <Button className="flex-1 gap-1.5" onClick={handleNext} disabled={checkingPn}>
                  {checkingPn ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</> : <>Next <ChevronRight className="w-4 h-4" /></>}
                </Button>
              ) : (
                <Button className="flex-1 gap-2" disabled={saving || (isEdit && versionMode === 'new' && !changeNotes.trim())} onClick={handleSave}>
                  <Save className="w-4 h-4" />
                  {saving
                    ? 'Saving…'
                    : isEdit
                      ? resubmitMode
                        ? 'Save & Resubmit'
                        : versionMode === 'new' ? `Save as Rev ${newRevLabel || '?'}` : 'Save Changes'
                      : 'Add Part'}
                </Button>
              )}
            </div>
          </div>,
          document.body
        )}

        {/* Reject confirmation (mandatory reason) */}
        <BOMRejectDialog
          open={showRejectDialog}
          partLabel={node?.pn}
          onClose={() => setShowRejectDialog(false)}
          onConfirm={handleRejectConfirm}
        />
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose(); }}>
        <DialogContent className="max-w-[1200px] w-[92vw] p-0 gap-0 flex flex-col overflow-hidden"
          style={{ maxHeight: '90vh', minHeight: '75vh' }}>

          {/* ── Header ── */}
          <DialogHeader className="px-7 py-5 border-b border-border shrink-0">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2.5">
              {isEdit ? 'Edit Part' : 'Add New Part'}
              {isEdit && node && (
                <span className="text-sm font-mono font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                  {node.pn}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {isEdit
                ? 'Update part details. Choose to overwrite the current revision or create a new one.'
                : 'Fill in all required fields to add a new part to the Bill of Materials.'}
            </DialogDescription>
          </DialogHeader>

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabId)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <TabsList className="mx-7 mt-4 mb-0 shrink-0 bg-muted/50 h-9 w-auto self-start gap-0.5">
              <TabsTrigger value="details" className="text-xs px-4">Details</TabsTrigger>
              <TabsTrigger value="sourcing" className="text-xs px-4">Sourcing</TabsTrigger>
              <TabsTrigger value="traceability" className="text-xs px-4">Traceability</TabsTrigger>
              <TabsTrigger value="documents" className="text-xs px-4">Documents</TabsTrigger>
              {isEdit && node && (
                <TabsTrigger value="history" className="text-xs px-4 gap-1.5">
                  <History className="w-3.5 h-3.5" /> History
                </TabsTrigger>
              )}
            </TabsList>

            {/* ── DETAILS — two-column ── */}
            <TabsContent value="details" className="flex-1 overflow-y-auto px-7 py-5 mt-0 data-[state=inactive]:hidden">
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">

                {/* Left col */}
                <div className="space-y-5">
                  <FL label="Part Number" required={!isEdit}>
                    {isEdit ? (
                      <div className="h-9 px-3 flex items-center bg-muted/50 border border-border rounded-md text-sm font-mono text-muted-foreground">
                        {node?.pn}
                      </div>
                    ) : (
                      <>
                        <FInput value={pn} onChange={e => setPn(e.target.value)}
                          placeholder="e.g. EV-PWR-020" className="h-9 font-mono uppercase" />
                        {errors.pn && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.pn}</p>}
                      </>
                    )}
                  </FL>

                  <FL label="Part Name" required>
                    <FInput value={name} onChange={e => setName(e.target.value)}
                      placeholder="e.g. Power Module" className="h-9" />
                    {errors.name && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.name}</p>}
                  </FL>

                  <FL label="Description" required>
                    <Textarea value={desc} onChange={e => setDesc(e.target.value)}
                      placeholder="Brief technical description of the part"
                      className="text-sm bg-muted border-border resize-none" rows={4} />
                    {errors.desc && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.desc}</p>}
                  </FL>
                </div>

                {/* Right col */}
                <div className="space-y-5">
                  <FL label="Status">
                    {!isEdit ? (
                      <>
                        <div className="flex gap-2">
                          {(['approved', 'pending'] as BOMStatus[]).map(s => (
                            <button key={s} type="button" disabled={!canEditStatus}
                              onClick={() => canEditStatus && setStatus(s)}
                              title={canEditStatus ? undefined : 'Only project managers or admins can change part status'}
                              className={cn(
                                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors',
                                status === s ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted',
                                canEditStatus ? 'cursor-pointer' : 'cursor-not-allowed opacity-60 hover:bg-card'
                              )}>
                              {s === 'approved'
                                ? <CheckCircle className="w-4 h-4" style={{ color: '#16A34A' }} />
                                : <Clock className="w-4 h-4" style={{ color: '#D97706' }} />}
                              {s === 'approved' ? 'Approved' : 'Pending'}
                            </button>
                          ))}
                        </div>
                        {!canEditStatus && (
                          <p className="text-[11px] text-muted-foreground mt-1.5">Only project managers or admins can change part status.</p>
                        )}
                      </>
                    ) : node?.status === 'pending' && activeRequest && (isAssignedApprover || isAdmin) ? (
                      <div className="flex gap-2">
                        <button type="button" disabled={decideApprovalRequest.isPending}
                          onClick={handleApproveClick}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          {decideApprovalRequest.isPending
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Check className="w-4 h-4" style={{ color: '#16A34A' }} />}
                          Approve
                        </button>
                        <button type="button" disabled={decideApprovalRequest.isPending}
                          onClick={() => setShowRejectDialog(true)}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          <XCircle className="w-4 h-4" style={{ color: '#DC2626' }} />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 h-9">
                        <BOMStatusPill status={node?.status ?? 'pending'} />
                        {node?.status === 'pending' && !activeRequest && (
                          <span className="text-[11px] text-muted-foreground">Not yet sent for review.</span>
                        )}
                      </div>
                    )}
                  </FL>

                  <FL label="Owner / Handled By" required>
                    <Popover open={ownerPopover} onOpenChange={setOwnerPopover}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            'w-full h-9 flex items-center gap-2 px-3 rounded-md border text-sm transition-colors bg-muted border-border hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                            errors.owner && 'border-destructive'
                          )}
                        >
                          {selectedOwner ? (
                            <>
                              <Avatar className="h-5 w-5 shrink-0">
                                <AvatarImage src={resolveFileUrl(selectedOwner.avatar) ?? selectedOwner.avatar} alt={selectedOwner.name} />
                                <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                                  {selectedOwner.initials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="flex-1 text-left truncate">{selectedOwner.name}</span>
                            </>
                          ) : isEdit && node?.owner ? (
                            <>
                              <Avatar className="h-5 w-5 shrink-0">
                                <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                                  {node.owner.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="flex-1 text-left truncate">{node.owner}</span>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-left text-muted-foreground">Select project member…</span>
                            </>
                          )}
                          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[260px]" align="start">
                        <Command>
                          <CommandInput placeholder="Search members…" />
                          <CommandList>
                            <CommandEmpty>No members found.</CommandEmpty>
                            <CommandGroup heading="Project Members">
                              {projectMembers.map(member => (
                                <CommandItem
                                  key={member.id}
                                  value={`${member.id} ${member.name}`}
                                  onSelect={() => {
                                    setSelectedOwner(member);
                                    setOwnerPopover(false);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={resolveFileUrl(member.avatar) ?? member.avatar} alt={member.name} />
                                      <AvatarFallback className="text-[9px]">
                                        {member.initials}
                                      </AvatarFallback>
                                    </Avatar>
                                    {member.name}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {errors.owner && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.owner}</p>}
                  </FL>

                  {!isEdit && (
                    <FL label="Initial Revision">
                      <div className="flex items-center gap-3">
                        <FInput value={rev} onChange={e => setRev(e.target.value.toUpperCase().slice(0, 3))}
                          placeholder="A" className="h-9 w-24 font-mono" />
                        <span className="text-xs text-muted-foreground">Starting revision (typically "A")</span>
                      </div>
                    </FL>
                  )}
                </div>

                {/* Category — full width */}
                <FL label="Category" required className="col-span-2">
                  <div className="grid grid-cols-8 gap-2">
                    {CATEGORIES.map(cat => {
                      const m = BOM_CAT_META[cat];
                      const Icon = CAT_ICONS[cat];
                      const active = category === cat;
                      return (
                        <button key={cat} onClick={() => setCategory(cat)}
                          className={cn(
                            'flex flex-col items-center gap-2 py-3 px-2 rounded-xl border text-center cursor-pointer transition-all',
                            active ? 'border-primary/60 bg-primary/5 shadow-sm' : 'border-border hover:bg-muted/50 hover:border-muted-foreground/30'
                          )}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: `${m.tint}20` }}>
                            <Icon className="w-4.5 h-4.5" style={{ color: m.tint, width: 18, height: 18 }} />
                          </div>
                          <span className={cn('text-[11px] font-medium leading-tight', active ? 'text-primary' : 'text-muted-foreground')}>
                            {m.label.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                    <button onClick={() => setCategory('')}
                      className={cn(
                        'flex flex-col items-center gap-2 py-3 px-2 rounded-xl border text-center cursor-pointer transition-all',
                        !isKnownCategory(category) ? 'border-primary/60 bg-primary/5 shadow-sm' : 'border-border hover:bg-muted/50 hover:border-muted-foreground/30'
                      )}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted">
                        <Tag className="w-4.5 h-4.5 text-muted-foreground" style={{ width: 18, height: 18 }} />
                      </div>
                      <span className={cn('text-[11px] font-medium leading-tight', !isKnownCategory(category) ? 'text-primary' : 'text-muted-foreground')}>
                        Other
                      </span>
                    </button>
                  </div>
                  {!isKnownCategory(category) && (
                    <div className="mt-2">
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-0.5">
                        Custom category name<span className="text-destructive ml-0.5">*</span>
                      </label>
                      <Input
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        placeholder="Enter a custom category"
                        className={`h-9 ${errors.category ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        maxLength={50}
                        autoFocus
                      />
                    </div>
                  )}
                  {errors.category && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.category}</p>}
                </FL>
              </div>
            </TabsContent>

            {/* ── SOURCING ── */}
            <TabsContent value="sourcing" className="flex-1 overflow-y-auto px-7 py-5 mt-0 data-[state=inactive]:hidden">
              <div className="space-y-5">

                {/* MPN · Quantity · UOM */}
                <div className="grid gap-y-2 grid-cols-3 gap-x-6">
                  {/* Manufacturer */}
                  <FL label="Manufacturer" required>
                    <FInput value={manufacturer} onChange={e => setManufacturer(e.target.value)}
                      placeholder="e.g. Texas Instruments" className="h-9" />
                    {errors.mfr && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.mfr}</p>}
                  </FL>
                  <FL label="Manufacturer PN (MPN)" required>
                    <FInput value={mpn} onChange={e => setMpn(e.target.value)}
                      placeholder="e.g. TI-A4B2C" className="h-9 font-mono" />
                    {errors.mpn && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.mpn}</p>}
                  </FL>
                  <FL label="Quantity" required>
                    <FInput value={qty} onChange={e => {
                      let val = e.target.value;
                      if (['EA', 'SET', 'PCS', 'LOT', 'LIC'].includes(uom)) {
                        val = val.replace(/[^0-9]/g, '').slice(0, 10);
                      } else {
                        val = val.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                        if (parts[0].length > 10) val = parts.length > 1 ? parts[0].slice(0, 10) + '.' + parts[1] : parts[0].slice(0, 10);
                      }
                      setQty(val);
                    }}
                      type="text" placeholder="1" className="h-9" maxLength={15} />
                    {errors.qty && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.qty}</p>}
                  </FL>
                <FL label="Unit of Measure (UOM)" required>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {UOM_OPTIONS.map(u => (
                      <button key={u} onClick={() => setUom(u)}
                        className={cn(
                          'px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer transition-colors',
                          uom === u ? 'bg-primary/10 text-primary border-primary/30' : 'bg-card text-muted-foreground border-border hover:bg-muted'
                        )}>
                        {u}
                      </button>
                    ))}
                  </div>
                </FL>
                 {/* Lead Time */}
                <FL label="Lead Time" required>
                  <div className="flex gap-1.5">
                    <FInput value={leadTime} onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                      setLeadTime(val);
                    }}
                      type="text" placeholder="8" className="h-9 flex-1" maxLength={6} />
                    <div className="flex gap-1 shrink-0">
                      {LEAD_TIME_UNITS.map(u => (
                        <button key={u.id} onClick={() => setLeadTimeUnit(u.id)}
                          className={cn(
                            'px-2.5 h-9 rounded-md text-xs font-medium border cursor-pointer transition-colors',
                            leadTimeUnit === u.id ? 'bg-primary/10 text-primary border-primary/30' : 'bg-card text-muted-foreground border-border hover:bg-muted'
                          )}>
                          {u.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {errors.leadTime && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.leadTime}</p>}
                </FL>
                </div>

                {/* Dynamic supplier list */}
                <div className="space-y-3">
                  {suppliers.map((sup, i) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Supplier {i + 1}
                        </span>
                        {suppliers.length > 1 && (
                          <button
                            onClick={() => setSuppliers(s => s.filter((_, idx) => idx !== i))}
                            className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                            title="Remove supplier"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <FL label="Supplier / Distributor" required>
                          <FInput
                            value={sup.distributor}
                            onChange={e => setSuppliers(s => s.map((x, idx) => idx === i ? { ...x, distributor: e.target.value } : x))}
                            placeholder="e.g. Digi-Key" className="h-9" />
                          {errors[`sup_dist_${i}`] && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors[`sup_dist_${i}`]}</p>}
                        </FL>
                        <FL label="Unit Price" required>
                          <FInput
                            value={sup.calcFromSubparts ? '0.00' : sup.price}
                            onChange={e => {
                              let val = e.target.value.replace(/[^0-9.]/g, '');
                              const parts = val.split('.');
                              if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                              if (parts[0].length > 10) val = parts.length > 1 ? parts[0].slice(0, 10) + '.' + parts[1] : parts[0].slice(0, 10);
                              setSuppliers(s => s.map((x, idx) => idx === i ? { ...x, price: val } : x));
                            }}
                            disabled={sup.calcFromSubparts}
                            type="text" placeholder="0.00" className="h-9" maxLength={15} />
                          {errors[`sup_price_${i}`] && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors[`sup_price_${i}`]}</p>}
                          <div className="flex items-center gap-2 mt-1.5">
                            <Checkbox
                              id={`calcFromSubparts_${i}`}
                              checked={sup.calcFromSubparts}
                              onCheckedChange={c => setSuppliers(s => s.map((x, idx) => idx === i ? { ...x, calcFromSubparts: !!c } : x))}
                            />
                            <label htmlFor={`calcFromSubparts_${i}`} className="text-[11px] font-medium leading-none text-muted-foreground cursor-pointer select-none">
                              Calculate from sub-parts
                            </label>
                          </div>
                        </FL>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setSuppliers(s => [...s, { distributor: '', price: '', calcFromSubparts: false }])}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Supplier
                  </button>
                </div>

                {/* Additional Fields */}
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Additional Fields</span>
                  {customFields.map((field, i) => (
                    <div key={i} className="grid grid-cols-2 gap-x-4">
                      <FL label="Field Label">
                        <FInput
                          value={field.label}
                          onChange={e => setCustomFields(f => f.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                          placeholder="e.g. RoHS"
                          className="h-9"
                        />
                      </FL>
                      <FL label="Value">
                        <div className="flex items-center gap-1.5">
                          <FInput
                            value={field.value}
                            onChange={e => setCustomFields(f => f.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
                            placeholder="e.g. Compliant"
                            className="h-9 flex-1"
                          />
                          <button
                            onClick={() => setCustomFields(f => f.filter((_, idx) => idx !== i))}
                            className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </FL>
                    </div>
                  ))}
                  <button
                    onClick={() => setCustomFields(f => [...f, { label: '', value: '' }])}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Field
                  </button>
                </div>
              </div>
            </TabsContent>

            {/* ── TRACEABILITY ── */}
            <TabsContent value="traceability" className="flex-1 overflow-y-auto px-7 py-5 mt-0 data-[state=inactive]:hidden">
              <div className="max-w-xl space-y-4">
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Requirements Links</Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Link this part to system requirements it satisfies (e.g. SYS-001, PWR-003).
                  </p>
                  <div className="flex gap-2 mb-4">
                    <Input value={reqInput} onChange={e => setReqInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addReq(); } }}
                      placeholder="e.g. SYS-001"
                      className="h-9 text-sm bg-muted border-border font-mono flex-1 uppercase" />
                    <Button size="sm" variant="outline" className="h-9 gap-1.5 px-4 shrink-0" onClick={addReq}
                      disabled={!reqInput.trim()}>
                      <Plus className="w-3.5 h-3.5" /> Add
                    </Button>
                  </div>
                  {req.length === 0 ? (
                    <div className="flex items-center justify-center h-28 rounded-xl border-2 border-dashed border-border bg-muted/20">
                      <p className="text-sm text-muted-foreground">No requirements linked yet — type above to add</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {req.map(r => (
                        <span key={r} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-muted text-foreground border-border">
                          {r}
                          <button onClick={() => removeReq(r)} className="opacity-60 hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── DOCUMENTS — 2-column ── */}
            <TabsContent value="documents" className="flex-1 overflow-y-auto px-7 py-5 mt-0 data-[state=inactive]:hidden">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <PhotoUpload value={docPhoto} onChange={setDocPhoto} />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block">
                      Technical Files
                    </Label>
                    {!isAddingSection && (
                      <button type="button" onClick={() => setIsAddingSection(true)}
                        className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add Section
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {techSections.map((section) => (
                      <div key={section.id} className="relative group">
                        <FileRow icon={section.icon} label={section.label} hint={section.hint}
                          accept={section.accept} value={section.value}
                          onChange={(v) => setTechSections(ts => ts.map(s => s.id === section.id ? { ...s, value: v } : s))} />
                        <button type="button" onClick={() => setTechSections(ts => ts.filter(s => s.id !== section.id))}
                          className="absolute -right-2 -top-2 bg-destructive/10 text-destructive rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove Section">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {isAddingSection && (
                      <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-border bg-card">
                        <FInput
                          value={newSectionName}
                          onChange={e => setNewSectionName(e.target.value)}
                          placeholder="Section Name (e.g. Test Report)"
                          className="h-8 flex-1"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (newSectionName.trim()) {
                                setTechSections(ts => [...ts, { id: Date.now().toString(), label: newSectionName.trim(), hint: 'Custom file', accept: '*/*', icon: Paperclip, value: [] }]);
                                setIsAddingSection(false);
                                setNewSectionName('');
                              }
                            } else if (e.key === 'Escape') {
                              setIsAddingSection(false);
                              setNewSectionName('');
                            }
                          }}
                        />
                        <button type="button" onClick={() => {
                          if (newSectionName.trim()) {
                            setTechSections(ts => [...ts, { id: Date.now().toString(), label: newSectionName.trim(), hint: 'Custom file', accept: '*/*', icon: Paperclip, value: [] }]);
                            setIsAddingSection(false);
                            setNewSectionName('');
                          }
                        }} className="px-3 h-8 text-xs font-medium bg-primary text-primary-foreground rounded-md">Add</button>
                        <button type="button" onClick={() => { setIsAddingSection(false); setNewSectionName(''); }}
                          className="p-1.5 text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── HISTORY — approval audit trail (edit mode only) ── */}
            {isEdit && node && (
              <TabsContent value="history" className="flex-1 overflow-y-auto px-7 py-5 mt-0 data-[state=inactive]:hidden">
                <div className="max-w-xl">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1">
                    Approval History
                  </Label>
                  <p className="text-xs text-muted-foreground mb-4">
                    Full record of approve/reject actions taken on this part.
                  </p>
                  {approvalsLoading ? (
                    <div className="flex flex-col gap-3">
                      {[0, 1].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                    </div>
                  ) : approvals.length === 0 ? (
                    <div className="flex items-center justify-center h-28 rounded-xl border-2 border-dashed border-border bg-muted/20">
                      <p className="text-sm text-muted-foreground">No approval activity yet</p>
                    </div>
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
                </div>
              </TabsContent>
            )}
          </Tabs>

          {/* ── Version section (Edit only, last tab only) ── */}
          {isEdit && node && activeTab === 'documents' && (
            <div className="px-7 pt-5 pb-4 border-t border-border bg-muted/20 shrink-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Save as Version
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-background mb-2">
                <button type="button" onClick={() => setVersionMode('same')}
                  className={cn('flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    versionMode === 'same' ? 'bg-card border border-border shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  Update Rev {node.rev}
                </button>
                <button type="button" onClick={() => setVersionMode('new')}
                  className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    versionMode === 'new' ? 'bg-card border border-border shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  <GitBranch className="w-3.5 h-3.5" />
                  New revision
                </button>
              </div>

              {versionMode === 'new' ? (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-muted-foreground shrink-0">Label:</span>
                  <Input value={newRevLabel}
                    onChange={e => setNewRevLabel(e.target.value.toUpperCase().slice(0, 3))}
                    className="h-7 text-xs font-mono w-16 bg-background" placeholder="B" />
                  <span className="text-xs text-muted-foreground">Rev {node.rev} is preserved in history.</span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground mb-4">Overwrites Rev {node.rev} in place. No history entry is created.</div>
              )}
              {/* Change notes */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Change notes{versionMode === 'new' && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                <Textarea value={changeNotes} onChange={e => setChangeNotes(e.target.value)}
                  placeholder={versionMode === 'new' ? 'Describe what changed in this revision…' : 'Optional: describe the correction made…'}
                  className="text-sm bg-background border-border resize-none min-h-[60px]" rows={2} />
                {errors.notes && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" />{errors.notes}</p>}
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="px-7 py-4 border-t border-border flex items-center justify-between gap-4 shrink-0 bg-card">
            <div className="text-sm text-muted-foreground">
              {activeTab === 'history'
                ? <span className="text-xs text-muted-foreground">Approval and rejection history for this part</span>
                : activeTab === 'documents'
                  ? isEdit
                    ? versionMode === 'new'
                      ? <span>Will create <span className="font-mono font-medium text-foreground">Rev {newRevLabel || '?'}</span> — Rev {node?.rev} preserved in history</span>
                      : <span>Will overwrite <span className="font-mono font-medium text-foreground">Rev {node?.rev}</span> in place</span>
                    : 'New part will be added to the Bill of Materials'
                  : <span className="text-xs text-muted-foreground">Step {wizardIndex(activeTab) + 1} of {TABS.length}</span>}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="default" className="px-5" onClick={onClose} disabled={saving}>Cancel</Button>
              {(activeTab === 'history' || wizardIndex(activeTab) > 0) && (
                <Button variant="outline" size="default" className="gap-1.5 px-4" disabled={saving}
                  onClick={() => { setErrors({}); setActiveTab(activeTab === 'history' ? 'documents' : TABS[wizardIndex(activeTab) - 1]); }}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
              )}
              {activeTab === 'history' ? null : activeTab !== 'documents' ? (
                <Button size="default" className="gap-1.5 px-5" onClick={handleNext} disabled={checkingPn}>
                  {checkingPn ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</> : <>Next <ChevronRight className="w-4 h-4" /></>}
                </Button>
              ) : (
                <Button size="default" className="gap-2 px-6"
                  disabled={saving || (isEdit && versionMode === 'new' && !changeNotes.trim())}
                  onClick={handleSave}>
                  <Save className="w-4 h-4" />
                  {saving
                    ? 'Saving…'
                    : isEdit
                      ? resubmitMode
                        ? 'Save & Resubmit'
                        : versionMode === 'new' ? `Save as Rev ${newRevLabel || '?'}` : 'Save Changes'
                      : 'Add Part'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject confirmation (mandatory reason) */}
      <BOMRejectDialog
        open={showRejectDialog}
        partLabel={node?.pn}
        onClose={() => setShowRejectDialog(false)}
        onConfirm={handleRejectConfirm}
      />
    </>
  );
}
