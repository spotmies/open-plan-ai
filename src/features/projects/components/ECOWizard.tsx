import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  GitMerge, Check, X, Plus, ChevronDown, ChevronLeft, Lock, AlertCircle,
  Upload, FileText, Image, Box, Boxes, Package, Scissors, Search,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ECOType, ECOReason, ECOPriority, ChangeClass, EffectivityType, ImpactLevel, ECODisposition,
  ECO_TYPE_LABEL, REASON_LABEL, PRIORITY_LABEL, CHANGE_CLASS_LABEL,
  EFFECTIVITY_LABEL, IMPACT_LABEL, DISPOSITION_LABEL, CHANGE_LABEL_MAP, ChangeLabel,
  PipelineStep, PIPELINE_STAGE_DEFS, rejectionsFromSteps,
} from './ecoData';
import { ECOAvatar } from './ECOShared';
import { cn } from '@/lib/utils';
import { useCreateECO, useUpdateECO, useSubmitECO, useECODetail } from '@/hooks/useECOs';
import { useBomTree } from '@/hooks/useBom';
import { useProjectMembers } from '@/hooks/useProjectTeam';
import { useAuth } from '@/modules/auth';
import { fromApiNode, bomFlatAll, bomPath, KNOWN_BOM_CATEGORIES, BOM_CAT_META, UOM_OPTIONS, type BOMNode } from './bomData';
import { REQS } from './requirementsData';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ── BOM parameter options for Details diff rows ───────────────────────────────

const BOM_PARAM_OPTIONS: { key: string; label: string }[] = [
  { key: 'name', label: 'Part Name' },
  { key: 'desc', label: 'Description' },
  { key: 'qty', label: 'Quantity' },
  { key: 'uom', label: 'Unit of Measure' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'rev', label: 'Revision' },
  { key: 'cat', label: 'Category' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'distributor', label: 'Distributor' },
  { key: 'price', label: 'Unit Price' },
  { key: 'leadTime', label: 'Lead Time (days)' },
  { key: 'mpn', label: 'MPN' },
];

// Parameter keys whose From/To value should be constrained to the BOM's known
// option set (same lists used in BOMPartSheet.tsx's create/edit form) rather
// than free text.
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  KNOWN_BOM_CATEGORIES.map(c => [c, BOM_CAT_META[c].label]),
);
const UOM_LABELS: Record<string, string> = {};

const ECO_RECOMMENDED_PARAMS = [
  'Drawing Number',
  'Material',
  'Tolerance',
  'Surface Finish',
  'Coating / Treatment',
  'Weight (g)',
  'Operating Temperature',
  'Voltage Rating',
  'Current Rating',
  'Power Rating (W)',
  'Package Type',
  'Mounting Type',
  'Test Procedure',
  'Country of Origin',
];

const ALL_KNOWN_PARAM_LABELS = new Set([
  ...BOM_PARAM_OPTIONS.map(o => o.label),
  ...ECO_RECOMMENDED_PARAMS,
]);

// ── Searchable parameter combobox ─────────────────────────────────────────────

function ParamCombobox({
  value,
  onChange,
  onSelectOther,
  firstSelectedNode,
  usedParams,
}: {
  value: string;
  onChange: (label: string, autoFrom: string) => void;
  onSelectOther: (initialValue?: string) => void;
  firstSelectedNode: BOMNode | null;
  usedParams: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedLabel = value || 'Select parameter';
  const trimmedSearch = search.trim();
  const hasKnownMatch = trimmedSearch !== '' && [...BOM_PARAM_OPTIONS.map(o => o.label), ...ECO_RECOMMENDED_PARAMS]
    .some(label => label.toLowerCase().includes(trimmedSearch.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center justify-between gap-1 flex-[1.2] bg-muted/40 border border-border rounded-md text-foreground text-[13px] px-3 py-2 outline-none focus:border-primary/40 cursor-pointer font-[inherit] min-w-0"
          style={{ color: value ? undefined : 'hsl(var(--muted-foreground))' }}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[260px] z-[300]" align="start">
        <Command>
          <CommandInput
            placeholder="Search parameters…"
            value={search}
            onValueChange={setSearch}
            onKeyDown={e => {
              // No known field matches the typed text — Enter commits it as a
              // custom parameter instead of doing nothing (the "Other…" item
              // itself gets filtered out of the list in this case, so Enter
              // is otherwise the only way to proceed without clearing the box).
              if (e.key === 'Enter' && trimmedSearch !== '' && !hasKnownMatch) {
                e.preventDefault();
                e.stopPropagation();
                onSelectOther(trimmedSearch);
                setOpen(false);
              }
            }}
          />
          <CommandList>
            <CommandEmpty>No match — use Other to enter custom.</CommandEmpty>
            <CommandGroup heading="BOM Fields">
              {BOM_PARAM_OPTIONS.map(o => (
                <CommandItem
                  key={o.key}
                  value={o.label}
                  disabled={usedParams.has(o.label) && value !== o.label}
                  onSelect={() => {
                    const autoFrom = o.key === 'rev'
                      ? ''
                      : firstSelectedNode
                        ? String(firstSelectedNode[o.key as keyof BOMNode] ?? '')
                        : '';
                    onChange(o.label, autoFrom);
                    setOpen(false);
                  }}
                >
                  {value === o.label && <Check className="w-3.5 h-3.5 mr-1.5 shrink-0" />}
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Recommended">
              {ECO_RECOMMENDED_PARAMS.map(p => (
                <CommandItem
                  key={p}
                  value={p}
                  disabled={usedParams.has(p) && value !== p}
                  onSelect={() => {
                    onChange(p, '');
                    setOpen(false);
                  }}
                >
                  {value === p && <Check className="w-3.5 h-3.5 mr-1.5 shrink-0" />}
                  {p}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Custom" forceMount>
              <CommandItem
                value="other"
                forceMount
                onSelect={() => {
                  onSelectOther(hasKnownMatch ? undefined : trimmedSearch || undefined);
                  setOpen(false);
                }}
              >
                Other…
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Attachment file type helper ───────────────────────────────────────────────

function fileKind(name: string) {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (ext === 'pdf') return { Icon: FileText, color: '#DC2626', tag: 'PDF' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return { Icon: Image, color: '#9333EA', tag: ext.toUpperCase() };
  if (['step', 'stp', 'iges', 'igs', 'sldprt', 'sldasm', 'dwg', 'dxf', '3mf', 'stl'].includes(ext))
    return { Icon: Box, color: '#0891B2', tag: 'CAD' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { Icon: Boxes, color: '#16A34A', tag: 'SHEET' };
  if (['zip', 'rar', '7z'].includes(ext)) return { Icon: Package, color: '#D97706', tag: 'ZIP' };
  return { Icon: FileText, color: '#6B7280', tag: ext ? ext.toUpperCase() : 'FILE' };
}

function fmtSize(b: number) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

// `<input type="date">` only accepts a strict "YYYY-MM-DD" value — any other
// format (legacy free-text entries, alternate separators) is silently ignored
// by the browser and renders blank. Normalize whatever was saved so a
// previously-entered date always redisplays when reopening the ECO.
function toDateInputValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

// ── Shared field label ────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-0.5">
      {children}
      {required && <span style={{ color: '#DC2626' }}>*</span>}
    </div>
  );
}

// ── Shared select ─────────────────────────────────────────────────────────────

function EcoSelect<T extends string>({
  value, onChange, options, labels,
}: {
  value: T;
  onChange: (v: T) => void;
  options: T[];
  labels: Record<string, string>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="w-full bg-muted/40 border border-border rounded-md text-foreground text-[13px] pl-3 pr-8 py-2 outline-none focus:border-primary/40 cursor-pointer appearance-none font-[inherit]"
      >
        {options.map(o => (
          <option key={o} value={o} className="bg-card">{labels[o] ?? o}</option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
    </div>
  );
}

const ECO_SELECT_CLS = 'w-full bg-muted/40 border border-border rounded-md text-foreground text-[13px] pl-3 pr-8 py-2 outline-none focus:border-primary/40 cursor-pointer appearance-none font-[inherit]';

const CUSTOM_SENTINEL = '__custom__';

function EcoSelectWithCustom({
  value, onChange, options, labels,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels: Record<string, string>;
}) {
  const isCustom = !!value && !options.includes(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === CUSTOM_SENTINEL) {
      setEditing(true);
      setDraft('');
    } else {
      onChange(e.target.value);
    }
  }

  function commit() {
    const v = draft.trim();
    if (v) onChange(v);
    setEditing(false);
    setDraft('');
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <select
          value={isCustom ? CUSTOM_SENTINEL : value}
          onChange={handleSelectChange}
          className={ECO_SELECT_CLS}
        >
          {options.map(o => (
            <option key={o} value={o} className="bg-card">{labels[o] ?? o}</option>
          ))}
          {isCustom && (
            <option value={CUSTOM_SENTINEL} className="bg-card">{value}</option>
          )}
          <option value={CUSTOM_SENTINEL} disabled={false} className="bg-card text-muted-foreground">
            {isCustom ? '✎ Edit custom…' : '+ Custom…'}
          </option>
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
      </div>
      {editing && (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setEditing(false); setDraft(''); }
          }}
          placeholder="Type custom option and press Enter…"
          className={inputCls}
        />
      )}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-muted/40 border border-border rounded-md text-foreground text-[13px] px-3 py-2 outline-none focus:border-primary/40 placeholder:text-muted-foreground/50 font-[inherit]';

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ['Basics', 'Items', 'Details', 'Impact', 'Approval'];

function Stepper({ step, maxStepReached, onStepClick }: { step: number; maxStepReached: number; onStepClick: (i: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-y-3 gap-x-1 sm:flex sm:gap-1">
      {STEPS.map((s, i) => {
        const locked = i > maxStepReached;
        return (
          <div
            key={s}
            onClick={() => !locked && onStepClick(i)}
            className={cn('pb-2.5 sm:flex-1', locked ? 'cursor-not-allowed' : 'cursor-pointer')}
          >
            <div className="flex items-center gap-2 mb-2 sm:gap-1.5 sm:mb-1.5" style={{ opacity: locked ? 0.45 : 1 }}>
              <div
                className="w-7 h-7 sm:w-5 sm:h-5 rounded-full shrink-0 flex items-center justify-center text-[13px] sm:text-[11px] font-semibold"
                style={{
                  background: i < step ? 'hsl(var(--primary))' : i === step ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                  color: i <= step ? 'hsl(var(--primary-foreground))' : undefined,
                  border: i > step ? '1px solid hsl(var(--border))' : 'none',
                }}
              >
                {i < step ? <Check className="w-4 h-4 sm:w-3 sm:h-3 text-white" strokeWidth={3} /> : i + 1}
              </div>
              <span
                className="text-[14px] sm:text-[12px] whitespace-nowrap"
                style={{ fontWeight: i === step ? 600 : 500 }}
              >
                {s}
              </span>
            </div>
            <div
              className="h-1 sm:h-0.5 rounded"
              style={{ background: i <= step ? 'hsl(var(--primary))' : 'hsl(var(--border))' }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Wizard state types ────────────────────────────────────────────────────────

type ECOScope = 'BOM_PART' | 'REQUIREMENT';

interface BasicsState {
  title: string; description: string;
  type: ECOType | string; typeOther: string;
  priority: ECOPriority; reason: ECOReason | string; reasonOther: string;
  changeClass: ChangeClass;
  ecr: string;
  effType: EffectivityType; effValue: string;
  scope: ECOScope;
}

interface ReqItemState {
  key: string;
  title: string;
  status: string;
  category: string;
}

interface ItemState {
  pn: string; desc: string; impact: ImpactLevel;
  disp: ECODisposition; whereUsed: string[];
  partId: string; nodeId: string;
  revFrom: string; revTo: string;
}

interface DiffRowState {
  param: string; from: string; to: string; cls: ChangeLabel;
  paramIsCustom?: boolean;
}

interface AttachmentState { name: string; size: number; file: File }

interface ImpactState {
  schedule: ImpactLevel; recert: boolean; firmware: boolean;
  unitCostDelta: string; oneTimeCost: string; certNotes: string;
}

interface PipelineStepWizard extends PipelineStep {
  justification: string;
  isCustom?: boolean;
}

// ── Draft persistence (create mode only — editing an existing ECO already reflects
// saved server state). Attachments are excluded: actual File objects can't survive
// JSON serialization, so restoring their metadata alone would be misleading.
interface ECODraft {
  savedAt: number;
  basics: BasicsState;
  items: ItemState[];
  reqItems: ReqItemState[];
  diffRows: DiffRowState[];
  impact: ImpactState;
  pipeline: PipelineStepWizard[];
  step: number;
  maxStepReached: number;
}

// ── ECOWizard ─────────────────────────────────────────────────────────────────

export function ECOWizard({
  projectId,
  ecoId,
  isRework,
  onClose,
}: {
  projectId: string;
  ecoId?: string;
  isRework?: boolean;
  onClose: (result?: { saved: boolean; ecoId?: string }) => void;
}) {
  const isEdit = !!ecoId;
  const isMobile = useIsMobile();
  const createMutation = useCreateECO(projectId);
  const updateMutation = useUpdateECO(projectId, ecoId ?? '');
  const submitMutation = useSubmitECO(projectId, ecoId ?? '');
  const { data: editDetail, isLoading: editLoading } = useECODetail(isEdit ? projectId : undefined, ecoId);
  const reworkRejection = useMemo(
    () => (isRework && editDetail ? rejectionsFromSteps(editDetail.steps).at(-1) ?? null : null),
    [isRework, editDetail],
  );

  const [seeded, setSeeded] = useState(false);
  const [step, setStep] = useState(0);
  const [maxStepReached, setMaxStepReached] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmClose, setConfirmClose] = useState(false);

  // Step 1 — Basics
  const [basics, setBasics] = useState<BasicsState>({
    title: '', description: '',
    type: 'DESIGN_CHANGE', typeOther: '',
    priority: 'MEDIUM',
    reason: 'PERFORMANCE', reasonOther: '',
    changeClass: 'II',
    ecr: '',
    effType: 'DATE', effValue: '',
    scope: 'BOM_PART',
  });

  // Step 2 — Affected items (real BOM parts for this project)
  const { data: bomTree } = useBomTree(projectId);
  const bomRootNodes = useMemo(() => (bomTree?.roots ?? []).map(r => fromApiNode(r)), [bomTree]);
  const bomPool = useMemo(
    () => bomFlatAll(bomRootNodes).map(n => ({
      pn: n.pn,
      desc: n.desc,
      rev: n.rev,
      partId: n._partId ?? '',
      nodeId: n.id,
      whereUsed: (bomPath(n.id, bomRootNodes) ?? []).slice(0, -1).map(a => `${a.pn} ${a.desc}`),
    })),
    [bomRootNodes],
  );

  const [items, setItems] = useState<ItemState[]>([]);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [partSearch, setPartSearch] = useState('');
  const [reqItems, setReqItems] = useState<ReqItemState[]>([]);
  const [reqPickerOpen, setReqPickerOpen] = useState(false);

  // Selecting a part auto-populates Rev From from its current BOM revision;
  // Rev To is left for the user to fill in once the target rev is known.
  const addItem = (p: typeof bomPool[number]) => {
    setItems(prev =>
      prev.find(x => x.pn === p.pn)
        ? prev
        : [...prev, {
          pn: p.pn, desc: p.desc, impact: 'MEDIUM', disp: 'REWORK', whereUsed: p.whereUsed,
          partId: p.partId, nodeId: p.nodeId,
          revFrom: p.rev, revTo: '',
        }],
    );
    setPickerOpen(false);
    setPartSearch('');
  };

  const filteredBomPool = useMemo(
    () => bomPool.filter(p => {
      const q = partSearch.trim().toLowerCase();
      return !q || p.pn.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q);
    }),
    [bomPool, partSearch],
  );

  // Step 3 — Diff rows + attachments
  const [diffRows, setDiffRows] = useState<DiffRowState[]>([{ param: '', from: '', to: '', cls: 'MODIFIED' }]);
  const [attachments, setAttachments] = useState<AttachmentState[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pre-populate all steps from the fetched ECO detail (edit mode only)
  useEffect(() => {
    if (!editDetail || seeded) return;
    const d = editDetail;
    setBasics({
      title: d.title,
      description: d.description ?? '',
      type: (d.type?.toUpperCase() ?? 'DESIGN_CHANGE') as ECOType,
      typeOther: d.typeOther ?? '',
      priority: (d.priority?.toUpperCase() ?? 'MEDIUM') as ECOPriority,
      reason: (d.reason?.toUpperCase() ?? 'PERFORMANCE') as ECOReason,
      reasonOther: d.reasonOther ?? '',
      changeClass: (d.changeClass ?? 'II') as ChangeClass,
      ecr: d.originatingEcr ?? '',
      effType: (d.effectivityType?.toUpperCase() ?? 'DATE') as EffectivityType,
      effValue: d.effectivityValue ?? '',
      scope: 'BOM_PART',
    });
    setItems(
      d.parts.map(p => ({
        pn: p.partNumber,
        desc: p.description,
        impact: (p.impactLevel?.toUpperCase() ?? 'MEDIUM') as ImpactLevel,
        disp: (p.disposition?.toUpperCase() ?? 'REWORK') as ECODisposition,
        revFrom: p.revFrom ?? '',
        revTo: p.revTo ?? '',
        partId: p.partId,
        nodeId: p.bomNodeId ?? '',
        whereUsed: (p.whereUsedPaths ?? []).map(path => path.join(' › ')),
      })),
    );
    setDiffRows(
      d.diffRows.length > 0
        ? d.diffRows
          .slice()
          .sort((a, b) => a.order - b.order)
          .map(r => {
            const isKnown = ALL_KNOWN_PARAM_LABELS.has(r.parameter ?? '');
            return {
              param: r.parameter,
              from: r.fromValue ?? '',
              to: r.toValue ?? '',
              cls: (r.changeLabel?.toUpperCase() ?? 'MODIFIED') as ChangeLabel,
              paramIsCustom: !!r.parameter && !isKnown,
            };
          })
        : [{ param: '', from: '', to: '', cls: 'MODIFIED' }],
    );
    setImpact({
      schedule: (d.scheduleImpact?.toUpperCase() ?? 'MEDIUM') as ImpactLevel,
      recert: d.requiresRecertification ?? false,
      firmware: d.firmwareCoupling ?? false,
      unitCostDelta: d.unitCostDelta != null ? String(parseFloat(d.unitCostDelta.toFixed(6))) : '',
      oneTimeCost: d.oneTimeCost != null ? String(parseFloat(d.oneTimeCost.toFixed(6))) : '',
      certNotes: d.certNotes ?? '',
    });
    if (d.steps?.length) {
      setPipeline(
        d.steps
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s, i) => ({
            order: i,
            stage: s.stage,
            stageLabel: s.stageLabel ?? s.stage,
            approverId: s.approverUserId ?? null,
            name: s.approverName ?? '',
            role: s.approverRole ?? '',
            optional: s.isOptional,
            optionalReason: s.optionalReason ?? '',
            justification: s.justification ?? '',
          })),
      );
    }
    setMaxStepReached(4);
    setSeeded(true);
  }, [editDetail, seeded]);

  // Lock background scroll while the mobile full-page flow covers the viewport.
  useEffect(() => {
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isMobile]);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const next = Array.from(fileList).map(f => ({ name: f.name, size: f.size, file: f }));
    setAttachments(prev => {
      const names = new Set(prev.map(a => a.name));
      return [...prev, ...next.filter(f => !names.has(f.name))];
    });
  };

  const [impact, setImpact] = useState<ImpactState>({
    schedule: 'MEDIUM', recert: false, firmware: false,
    unitCostDelta: '', oneTimeCost: '', certNotes: '',
  });

  // Step 5 — Pipeline (approvers are real project members, picked by the user)
  const { user: currentUser } = useAuth();
  const { data: projectMembers = [] } = useProjectMembers(projectId);

  const defaultOrder = useMemo(() => {
    const m: Record<string, number> = {};
    PIPELINE_STAGE_DEFS.forEach((s, i) => { m[s.stage] = i; });
    return m;
  }, []);

  const [pipeline, setPipeline] = useState<PipelineStepWizard[]>(
    PIPELINE_STAGE_DEFS.map(s => ({ ...s, justification: s.optionalReason ?? '' })),
  );

  // Whether the user has entered anything worth confirming before a discard-on-close.
  const isDirty = !!(
    basics.title.trim() || basics.description.trim() || basics.ecr.trim() || basics.effValue.trim() ||
    items.length > 0 || reqItems.length > 0 || attachments.length > 0 ||
    diffRows.some(r => r.param || r.from || r.to) ||
    impact.certNotes.trim() || impact.unitCostDelta.trim() || impact.oneTimeCost.trim()
  );

  // Auto-fill Originator slot with the current user once members load
  useEffect(() => {
    if (!currentUser || projectMembers.length === 0) return;
    const me = projectMembers.find(m => m.id === currentUser.id);
    if (!me) return;
    setPipeline(pl => pl.map((x, i) =>
      i === 0 && !x.approverId
        ? { ...x, approverId: me.id, name: me.name, role: me.role ?? '' }
        : x,
    ));
  }, [currentUser, projectMembers]);

  const assignApprover = (idx: number, memberId: string) => {
    const member = projectMembers.find(m => m.id === memberId);
    setPipeline(pl => pl.map((x, i) => (
      i === idx ? { ...x, approverId: member?.id ?? null, name: member?.name ?? '', role: member?.role ?? '' } : x
    )));
  };

  // Lock QA & Final Approval for Class I
  const lockStage = (stage: string) =>
    basics.changeClass === 'I' && (stage === 'Quality Assurance' || stage === 'Final Approval');

  const stageMoved = (p: PipelineStep, idx: number) =>
    defaultOrder[p.stage] !== undefined && defaultOrder[p.stage] !== idx;

  const pipelineMissingApprover = pipeline.some(p => !p.approverId);
  const pipelineMissingStageName = pipeline.some(p => p.isCustom && !p.stage.trim());
  const pipelineMissingJustification = pipeline.some((p, idx) => (p.optional || stageMoved(p, idx)) && !(p.justification ?? '').trim());
  const pipelineValid = pipeline.length >= 2 && !pipelineMissingApprover && !pipelineMissingStageName && !pipelineMissingJustification;



  const activeMutation = isEdit ? updateMutation : createMutation;
  const savePending = activeMutation.isPending || (isRework && submitMutation.isPending);
  const canSubmit = !savePending && (isRework || pipelineValid);

  // Auto-fill "From" in Details when scope is BOM_PART
  const firstSelectedNode = useMemo(() => {
    if (items.length === 0) return null;
    return bomFlatAll(bomRootNodes).find(n => n.id === items[0].nodeId) ?? null;
  }, [items, bomRootNodes]);

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0 && !basics.title.trim()) e.title = 'Title is required';
    if (s === 0 && basics.type === 'OTHER' && !basics.typeOther.trim()) e.typeOther = 'Describe the change type';
    if (s === 0 && basics.reason === 'OTHER' && !basics.reasonOther.trim()) e.reasonOther = 'Describe the reason';
    if (s === 1) {
      if (basics.scope === 'BOM_PART' && items.length < 1) e.items = 'At least 1 affected part is required';
      if (basics.scope === 'BOM_PART' && items.length > 0 && items.some(it => !it.revTo.trim())) e.revTo = 'Rev To is required for all parts';
      if (basics.scope === 'REQUIREMENT' && reqItems.length < 1) e.items = 'At least 1 affected requirement is required';
    }
    if (s === 2 && !diffRows.some(r => r.param.trim())) e.details = 'At least 1 parameter is required';
    if (s === 2) {
      const paramNames = diffRows.map(r => r.param.trim()).filter(Boolean);
      if (paramNames.length !== new Set(paramNames).size) e.details = 'Each parameter must be unique — remove the duplicate rows';
    }
    if (s === 3) {
      const MAX_COST = 99999999.9999;
      if (impact.unitCostDelta.trim()) {
        const v = parseFloat(impact.unitCostDelta);
        if (isNaN(v)) e.unitCostDelta = 'Enter a valid number (e.g. -4.55)';
        else if (Math.abs(v) > MAX_COST) e.unitCostDelta = `Must be within ±${MAX_COST.toLocaleString()}`;
      }
      if (impact.oneTimeCost.trim()) {
        const v = parseFloat(impact.oneTimeCost);
        if (isNaN(v)) e.oneTimeCost = 'Enter a valid number';
        else if (v < 0) e.oneTimeCost = 'Cost must be 0 or greater';
        else if (v > MAX_COST) e.oneTimeCost = `Must be ${MAX_COST.toLocaleString()} or less`;
      }
      if ((impact.recert || impact.firmware) && !impact.certNotes.trim()) {
        e.certNotes = impact.recert
          ? 'Specify the certification type required (e.g. CE, UL, ISO)'
          : 'Describe the firmware/software dependency';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setErrors({});
    const next = step + 1;
    setStep(next);
    setMaxStepReached(m => Math.max(m, next));
  };

  const handleStepClick = (i: number) => {
    for (let s = step; s < i; s++) {
      if (!validateStep(s)) return;
    }
    setErrors({});
    setStep(i);
    setMaxStepReached(m => Math.max(m, i));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const basePayload = {
      title: basics.title,
      description: basics.description || null,
      type: basics.type.toLowerCase(),
      typeOther: basics.type === 'OTHER' ? basics.typeOther.trim() : null,
      reason: basics.reason.toLowerCase(),
      reasonOther: basics.reason === 'OTHER' ? basics.reasonOther.trim() : null,
      priority: basics.priority.toLowerCase(),
      changeClass: basics.changeClass,
      effectivityType: basics.effType.toLowerCase(),
      effectivityValue: basics.effValue || null,
      originatingEcr: basics.ecr || null,
      revFrom: items[0]?.revFrom || null,
      revTo: items[0]?.revTo || null,
      scheduleImpact: impact.schedule.toLowerCase(),
      requiresRecertification: impact.recert,
      firmwareCoupling: impact.firmware,
      certNotes: (impact.recert || impact.firmware) ? impact.certNotes.trim() : null,
      unitCostDelta: impact.unitCostDelta ? parseFloat(impact.unitCostDelta) : null,
      oneTimeCost: impact.oneTimeCost ? parseFloat(impact.oneTimeCost) : null,
      parts: items.map(it => ({
        partId: it.partId,
        bomNodeId: it.nodeId || null,
        revFrom: it.revFrom || null,
        revTo: it.revTo || null,
        impactLevel: it.impact.toLowerCase(),
        disposition: it.disp.toLowerCase(),
      })),
      diffRows: diffRows
        .filter(r => r.param.trim() !== '')
        .map((r, i) => ({
          order: i,
          parameter: r.param,
          fromValue: r.from || null,
          toValue: r.to || null,
          changeLabel: r.cls.toLowerCase(),
        })),
    };
    // Pipeline steps are locked during rework — resubmit() reactivates the
    // rejected step server-side, so the field must be omitted, not just unchanged.
    const payload = isRework ? basePayload : {
      ...basePayload,
      pipelineSteps: pipeline.map((p, i) => ({
        order: i + 1,
        stage: p.stage,
        stageLabel: p.stage,
        approverUserId: p.approverId || null,
        approverName: p.name || null,
        approverRole: p.role || null,
        isOptional: p.optional ?? false,
        optionalReason: p.optionalReason || null,
        justification: p.justification || null,
      })),
    };
    try {
      const saved = await activeMutation.mutateAsync(payload);
      if (isRework) {
        await submitMutation.mutateAsync();
        toast.success('ECO revised and resubmitted');
      } else {
        toast.success(isEdit ? 'ECO updated' : 'ECO created');
      }
      onClose({ saved: true, ecoId: isEdit ? undefined : saved?.id });
    } catch (err) {
      toast.error(isRework ? 'Failed to resubmit ECO' : isEdit ? 'Failed to update ECO' : 'Failed to create ECO', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const upItem = <K extends keyof ItemState>(idx: number, key: K, val: ItemState[K]) =>
    setItems(prev => prev.map((x, i) => (i === idx ? { ...x, [key]: val } : x)));

  const upRow = <K extends keyof DiffRowState>(idx: number, key: K, val: DiffRowState[K]) =>
    setDiffRows(prev => prev.map((x, i) => (i === idx ? { ...x, [key]: val } : x)));

  // ── Step content ──────────────────────────────────────────────────────────

  const StepBasics = (
    <div className="flex flex-col gap-3.5">
      <div>
        <FieldLabel required>Title</FieldLabel>
        <input
          value={basics.title}
          onChange={e => {
            setBasics({ ...basics, title: e.target.value });
            if (errors.title) setErrors(({ title: _title, ...rest }) => rest);
          }}
          placeholder="e.g. Motor Housing Redesign"
          className={cn(inputCls, errors.title && 'border-destructive')}
        />
        {errors.title && (
          <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3" />{errors.title}
          </p>
        )}
      </div>
      <div>
        <FieldLabel>Description</FieldLabel>
        <textarea
          value={basics.description}
          onChange={e => setBasics({ ...basics, description: e.target.value })}
          placeholder="Short summary of the change intent"
          className={cn(inputCls, 'h-16 resize-none')}
        />
      </div>
      {/* <div>
        <FieldLabel required>Scope</FieldLabel>
        <div className="flex bg-muted/40 border border-border rounded-md p-0.5 w-fit">
          {(['BOM_PART', 'REQUIREMENT'] as ECOScope[]).map(s => (
            <button
              key={s}
              onClick={() => {
                setBasics({ ...basics, scope: s });
                setItems([]);
                setReqItems([]);
                setDiffRows([{ param: '', from: '', to: '', cls: 'MODIFIED' }]);
              }}
              className="px-3 py-1.5 rounded text-[12px] font-semibold transition-colors font-[inherit]"
              style={{
                background: basics.scope === s ? 'hsl(var(--primary))' : 'transparent',
                color: basics.scope === s ? 'hsl(var(--primary-foreground))' : undefined,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {s === 'BOM_PART' ? 'BOM Part' : 'Requirement'}
            </button>
          ))}
        </div>
      </div> */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel required>Change Type</FieldLabel>
          <EcoSelect value={basics.type as ECOType} onChange={v => setBasics({ ...basics, type: v })} options={Object.keys(ECO_TYPE_LABEL) as ECOType[]} labels={ECO_TYPE_LABEL} />
          {basics.type === 'OTHER' && (
            <>
              <input
                value={basics.typeOther}
                onChange={e => {
                  setBasics({ ...basics, typeOther: e.target.value });
                  if (errors.typeOther) setErrors(({ typeOther: _typeOther, ...rest }) => rest);
                }}
                placeholder="Describe the change type…"
                className={cn(inputCls, 'mt-1.5', errors.typeOther && 'border-destructive')}
              />
              {errors.typeOther && (
                <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />{errors.typeOther}
                </p>
              )}
            </>
          )}
        </div>
        <div>
          <FieldLabel required>Reason Code</FieldLabel>
          <EcoSelect value={basics.reason as ECOReason} onChange={v => setBasics({ ...basics, reason: v })} options={Object.keys(REASON_LABEL) as ECOReason[]} labels={REASON_LABEL} />
          {basics.reason === 'OTHER' && (
            <>
              <input
                value={basics.reasonOther}
                onChange={e => {
                  setBasics({ ...basics, reasonOther: e.target.value });
                  if (errors.reasonOther) setErrors(({ reasonOther: _reasonOther, ...rest }) => rest);
                }}
                placeholder="Describe the reason…"
                className={cn(inputCls, 'mt-1.5', errors.reasonOther && 'border-destructive')}
              />
              {errors.reasonOther && (
                <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />{errors.reasonOther}
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel required>Priority</FieldLabel>
          <EcoSelect value={basics.priority} onChange={v => setBasics({ ...basics, priority: v })} options={Object.keys(PRIORITY_LABEL) as ECOPriority[]} labels={PRIORITY_LABEL} />
        </div>
        <div>
          <FieldLabel required>Change Classification</FieldLabel>
          <EcoSelect value={basics.changeClass} onChange={v => setBasics({ ...basics, changeClass: v })} options={Object.keys(CHANGE_CLASS_LABEL) as ChangeClass[]} labels={CHANGE_CLASS_LABEL} />
        </div>
      </div>
      {basics.changeClass === 'I' && (
        <div className="flex items-center gap-1.5 text-[11px] -mt-1" style={{ color: '#DC2626' }}>
          <Lock className="w-3 h-3" />
          Class I locks QA &amp; Final Approval as mandatory in the pipeline.
        </div>
      )}
      <div>
        <FieldLabel>Originating ECR</FieldLabel>
        <input value={basics.ecr} onChange={e => setBasics({ ...basics, ecr: e.target.value })} placeholder="ECR-2026-088 (optional)" className={inputCls} />
      </div>
      {/* Effectivity */}
      <div>
        <FieldLabel>Effectivity (Cut-in)</FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex bg-muted/40 border border-border rounded-md p-0.5 shrink-0 self-start sm:self-auto">
            {(['DATE', 'SERIAL', 'LOT'] as EffectivityType[]).map(t => (
              <button
                key={t}
                onClick={() => setBasics({ ...basics, effType: t, effValue: '' })}
                className="px-2.5 py-1.5 rounded text-[12px] font-semibold transition-colors font-[inherit]"
                style={{
                  background: basics.effType === t ? 'hsl(var(--primary))' : 'transparent',
                  color: basics.effType === t ? 'hsl(var(--primary-foreground))' : undefined,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t === 'DATE' ? 'Date' : t === 'SERIAL' ? 'S/N break' : 'Lot break'}
              </button>
            ))}
          </div>
          <input
            type={basics.effType === 'DATE' ? 'date' : 'text'}
            value={basics.effType === 'DATE' ? toDateInputValue(basics.effValue) : basics.effValue}
            onChange={e => setBasics({ ...basics, effValue: e.target.value })}
            placeholder={
              basics.effType === 'SERIAL' ? 'Effective from S/N EVC-1450'
                : basics.effType === 'LOT' ? 'Effective from Lot 2026-W18'
                  : undefined
            }
            className={cn(inputCls, 'flex-1')}
          />
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
          <Scissors className="w-2.5 h-2.5" />
          Manufacturing enforces this cut-in point when the ECN releases.
        </div>
      </div>
    </div>
  );

  const StepItemsBomPart = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-muted-foreground">
          {items.length === 0 ? 'Select parts to be affected by this ECO' : '1 affected part · where-used auto-rolls up from BOM'}
        </div>
        {items.length === 0 && !pickerOpen && (
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors font-[inherit]"
          >
            <Plus className="w-3 h-3" />
            Add part
          </button>
        )}
      </div>
      {pickerOpen && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/20">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={partSearch}
              onChange={e => setPartSearch(e.target.value)}
              placeholder="Search by part number or description…"
              className="flex-1 bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-muted-foreground font-[inherit]"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {bomPool.length === 0 ? (
              <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">
                No parts in this project's BOM yet.
              </div>
            ) : filteredBomPool.length === 0 ? (
              <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">
                No parts match "{partSearch}".
              </div>
            ) : (
              filteredBomPool.map(p => (
                <div
                  key={p.pn}
                  onClick={() => addItem(p)}
                  className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 last:border-0 cursor-pointer hover:bg-accent/30 transition-colors"
                >
                  <div>
                    <span className="text-[12px] font-mono font-semibold text-foreground">{p.pn}</span>
                    <span className="text-[12px] text-muted-foreground ml-2.5">{p.desc}</span>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {items.length === 0 && !pickerOpen && (
        <div
          className="py-7 text-center border border-dashed rounded-lg text-[12px]"
          style={{
            borderColor: errors.items ? '#DC2626' : 'hsl(var(--border))',
            color: errors.items ? '#DC2626' : 'hsl(var(--muted-foreground))',
          }}
        >
          {errors.items ?? 'No parts yet — at least one is required to submit.'}
        </div>
      )}
      {items.map((it, idx) => (
        <div key={it.pn} className="border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[12px] font-mono font-semibold text-foreground">{it.pn}</span>
              <span className="text-[12px] text-muted-foreground ml-2">{it.desc}</span>
            </div>
            <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <FieldLabel>Rev From</FieldLabel>
              <input value={it.revFrom} disabled className={cn(inputCls, 'font-mono text-center cursor-not-allowed opacity-70')} />
            </div>
            <div className="flex-1">
              <FieldLabel required>Rev To</FieldLabel>
              <input
                value={it.revTo}
                onChange={e => upItem(idx, 'revTo', e.target.value)}
                placeholder="e.g. B"
                maxLength={3}
                className={cn(inputCls, 'font-mono text-center', errors.revTo && !it.revTo.trim() && 'border-destructive')}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <EcoSelect value={it.impact} onChange={v => upItem(idx, 'impact', v)} options={Object.keys(IMPACT_LABEL) as ImpactLevel[]} labels={IMPACT_LABEL} />
            </div>
            <div className="flex-[1.4]">
              <EcoSelect value={it.disp} onChange={v => upItem(idx, 'disp', v)} options={Object.keys(DISPOSITION_LABEL) as ECODisposition[]} labels={DISPOSITION_LABEL} />
            </div>
          </div>
          {it.whereUsed.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              {it.whereUsed.map(w => (
                <span key={w} className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50 border border-dashed border-border">{w}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const StepItemsRequirement = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-muted-foreground">
          {reqItems.length} affected requirement{reqItems.length !== 1 ? 's' : ''}
        </div>
        <button
          onClick={() => setReqPickerOpen(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors font-[inherit]"
        >
          <Plus className="w-3 h-3" />
          Add requirement
        </button>
      </div>
      {reqPickerOpen && (
        <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
          {REQS.length === 0 ? (
            <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">
              No requirements in this project yet.
            </div>
          ) : (
            REQS.filter(r => !reqItems.find(ri => ri.key === r.key)).map(r => (
              <div
                key={r.key}
                onClick={() => {
                  setReqItems(prev => [...prev, { key: r.key, title: r.title, status: r.status, category: r.category }]);
                  setReqPickerOpen(false);
                }}
                className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 last:border-0 cursor-pointer hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-mono font-semibold text-foreground shrink-0">{r.key}</span>
                  <span className="text-[12px] text-muted-foreground truncate">{r.title}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 border border-border shrink-0 ml-2">{r.status}</span>
              </div>
            ))
          )}
        </div>
      )}
      {reqItems.length === 0 && !reqPickerOpen && (
        <div
          className="py-7 text-center border border-dashed rounded-lg text-[12px]"
          style={{
            borderColor: errors.items ? '#DC2626' : 'hsl(var(--border))',
            color: errors.items ? '#DC2626' : 'hsl(var(--muted-foreground))',
          }}
        >
          {errors.items ?? 'No requirements yet — at least one is required to submit.'}
        </div>
      )}
      {reqItems.map((ri, idx) => (
        <div key={ri.key} className="border border-border rounded-lg p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-mono font-semibold text-foreground shrink-0">{ri.key}</span>
            <span className="text-[12px] text-foreground truncate">{ri.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 border border-border">{ri.status}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 border border-border">{ri.category}</span>
            <button onClick={() => setReqItems(reqItems.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-foreground transition-colors ml-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const StepItems = basics.scope === 'REQUIREMENT' ? StepItemsRequirement : StepItemsBomPart;

  const StepDetails = (
    <div className="flex flex-col gap-3">
      {/* Diff rows */}
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-muted-foreground">
          Field-level diff · {diffRows.length} row{diffRows.length !== 1 ? 's' : ''}
        </div>
        <button
          onClick={() => setDiffRows(r => [...r, { param: '', from: '', to: '', cls: 'MODIFIED' }])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors font-[inherit]"
        >
          <Plus className="w-3 h-3" />
          Add row
        </button>
      </div>
      {diffRows.length > 0 && (
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
          <div className="flex gap-2 sm:contents">
            <div className="flex-1 sm:flex-[1.2]">Parameter</div>
            <div className="flex-1">From</div>
          </div>
          <div className="hidden sm:contents">
            <div className="flex-1">To</div>
            <div className="w-32">Class</div>
            <div className="w-5" />
          </div>
        </div>
      )}
      {diffRows.map((r, idx) => {
        const paramField = basics.scope === 'BOM_PART' && items.length > 0 ? (
          r.paramIsCustom ? (
            <input
              autoFocus
              value={r.param}
              onChange={e => setDiffRows(prev => prev.map((x, i) => i === idx ? { ...x, param: e.target.value } : x))}
              onKeyDown={e => {
                if (e.key === 'Escape') setDiffRows(prev => prev.map((x, i) => i === idx ? { ...x, param: '', paramIsCustom: false } : x));
              }}
              placeholder="Type parameter name…"
              className={cn(inputCls, 'flex-[1.2]')}
            />
          ) : (() => {
            const usedParams = new Set(diffRows.filter((_, i) => i !== idx).map(x => x.param).filter(Boolean));
            return (
              <ParamCombobox
                value={r.param}
                usedParams={usedParams}
                firstSelectedNode={firstSelectedNode}
                onChange={(label, autoFrom) => {
                  setDiffRows(prev => prev.map((x, i) => i === idx ? { ...x, param: label, from: autoFrom, paramIsCustom: false } : x));
                }}
                onSelectOther={(initialValue) => {
                  setDiffRows(prev => prev.map((x, i) => i === idx ? { ...x, param: initialValue ?? '', paramIsCustom: true } : x));
                }}
              />
            );
          })()
        ) : (
          <input value={r.param} onChange={e => upRow(idx, 'param', e.target.value)} placeholder="Parameter" className={cn(inputCls, 'flex-[1.2]')} />
        );

        const paramKey = BOM_PARAM_OPTIONS.find(o => o.label === r.param)?.key;
        const knownOptions = paramKey === 'uom'
          ? { options: UOM_OPTIONS as readonly string[], labels: UOM_LABELS }
          : paramKey === 'cat'
            ? { options: KNOWN_BOM_CATEGORIES as readonly string[], labels: CATEGORY_LABELS }
            : null;

        const fromField = knownOptions ? (
          <div className="flex-1">
            <EcoSelectWithCustom value={r.from} onChange={v => upRow(idx, 'from', v)} options={[...knownOptions.options]} labels={knownOptions.labels} />
          </div>
        ) : (
          <input value={r.from} onChange={e => upRow(idx, 'from', e.target.value)} placeholder="from" {...(r.param === 'Revision' ? { maxLength: 3 } : {})} className={cn(inputCls, 'flex-1')} />
        );

        const toField = knownOptions ? (
          <div className="flex-1">
            <EcoSelectWithCustom value={r.to} onChange={v => upRow(idx, 'to', v)} options={[...knownOptions.options]} labels={knownOptions.labels} />
          </div>
        ) : (
          <input value={r.to} onChange={e => upRow(idx, 'to', e.target.value)} placeholder="to" {...(r.param === 'Revision' ? { maxLength: 3 } : {})} className={cn(inputCls, 'flex-1')} />
        );

        return (
          <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex gap-2 sm:contents">
              {paramField}
              {fromField}
            </div>
            <div className="flex flex-col gap-1 sm:contents">
              <div className="flex gap-2 sm:hidden text-[10px] text-muted-foreground uppercase tracking-wider">
                <div className="flex-1">To</div>
                <div className="flex-1">Class</div>
              </div>
              <div className="flex gap-2 items-center sm:contents">
                {toField}
                <div className="w-32">
                  <EcoSelect value={r.cls} onChange={v => upRow(idx, 'cls', v)} options={Object.keys(CHANGE_LABEL_MAP) as ChangeLabel[]} labels={CHANGE_LABEL_MAP} />
                </div>
                <button onClick={() => setDiffRows(d => d.filter((_, i) => i !== idx))} className="w-5 text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {errors.details && (
        <p className="text-[11px] text-destructive flex items-center gap-1 -mt-1">
          <AlertCircle className="w-3 h-3 shrink-0" />{errors.details}
        </p>
      )}
      {diffRows.length === 0 && (
        <div className="py-6 text-center border border-dashed border-border rounded-lg text-[12px] text-muted-foreground">
          Add the parameters that change between revisions.
        </div>
      )}

      {/* Attachments */}
      <div className="mt-2 pt-4 border-t border-border">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground mb-2.5">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          Attachments
          <span className="text-muted-foreground font-normal">· {attachments.length}</span>
        </div>
        <input
          ref={fileRef} type="file" multiple
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
          className="hidden"
        />
        <div
          onClick={() => fileRef.current?.click()}
          onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
          onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          className="flex flex-col items-center gap-1.5 p-5 rounded-lg border-2 border-dashed cursor-pointer transition-all"
          style={{
            borderColor: dragOver ? 'hsl(var(--primary))' : 'hsl(var(--border))',
            background: dragOver ? 'hsl(var(--primary)/0.05)' : 'hsl(var(--muted)/0.3)',
          }}
        >
          <Upload className="w-5 h-5" style={{ color: dragOver ? 'hsl(var(--primary))' : undefined }} />
          <div className="text-[12px] text-muted-foreground text-center">
            <span className="text-primary font-semibold">Click to upload</span>
          </div>
          <div className="text-[10px] text-muted-foreground">Drawings, CAD (STEP/SLDPRT), PDFs, test reports, photos</div>
        </div>
        {attachments.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2.5">
            {attachments.map((a, idx) => {
              const k = fileKind(a.name);
              return (
                <div
                  key={a.name}
                  onClick={() => { const url = URL.createObjectURL(a.file); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60000); }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/40 border border-border cursor-pointer hover:bg-muted/60 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: k.color + '22', border: `1px solid ${k.color}44` }}
                  >
                    <k.Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-foreground truncate">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground">{k.tag} · {fmtSize(a.size)}</div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setAttachments(prev => prev.filter((_, i) => i !== idx)); }}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const StepImpact = (
    <div className="flex flex-col gap-3.5">
      <div>
        <FieldLabel required>Schedule Impact</FieldLabel>
        <EcoSelect value={impact.schedule} onChange={v => setImpact({ ...impact, schedule: v })} options={Object.keys(IMPACT_LABEL) as ImpactLevel[]} labels={IMPACT_LABEL} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Unit Cost Δ ($/unit)</FieldLabel>
          <input
            value={impact.unitCostDelta}
            inputMode="decimal"
            onChange={e => { const v = e.target.value; if (/^[+-]?\d{0,8}(\.\d{0,4})?$/.test(v)) { setImpact({ ...impact, unitCostDelta: v }); if (errors.unitCostDelta) setErrors(({ unitCostDelta: _, ...rest }) => rest); } }}
            onBlur={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) setImpact(s => ({ ...s, unitCostDelta: String(parseFloat(n.toFixed(4))) })); }}
            placeholder="+4.55"
            className={cn(inputCls, errors.unitCostDelta && 'border-destructive')}
          />
          {errors.unitCostDelta && (
            <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />{errors.unitCostDelta}
            </p>
          )}
        </div>
        <div>
          <FieldLabel>One-Time Cost ($)</FieldLabel>
          <input
            value={impact.oneTimeCost}
            inputMode="decimal"
            onChange={e => { const v = e.target.value; if (/^\d{0,8}(\.\d{0,4})?$/.test(v)) { setImpact({ ...impact, oneTimeCost: v }); if (errors.oneTimeCost) setErrors(({ oneTimeCost: _, ...rest }) => rest); } }}
            onBlur={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) setImpact(s => ({ ...s, oneTimeCost: String(parseFloat(n.toFixed(4))) })); }}
            placeholder="12400"
            className={cn(inputCls, errors.oneTimeCost && 'border-destructive')}
          />
          {errors.oneTimeCost && (
            <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />{errors.oneTimeCost}
            </p>
          )}
        </div>
      </div>
      {([
        ['recert', 'Requires Recertification', 'CE / UL / ISO re-test needed'],
        ['firmware', 'Firmware Coupling', 'SW/FW dependency exists'],
      ] as [keyof ImpactState, string, string][]).map(([k, label, sub]) => (
        <div
          key={k}
          onClick={() => setImpact(prev => ({ ...prev, [k]: !prev[k] }))}
          className="flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-all"
          style={{
            borderColor: 'hsl(var(--border))',
            background: impact[k] ? 'rgba(245,158,11,0.06)' : 'transparent',
          }}
        >
          <div>
            <div className="text-[13px] font-medium text-foreground">{label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
          </div>
          <div
            className="w-9 h-5 rounded-full relative transition-all shrink-0"
            style={{
              background: impact[k] ? '#F59E0B' : 'hsl(var(--muted))',
              border: `1px solid ${impact[k] ? '#F59E0B' : 'hsl(var(--border))'}`,
            }}
          >
            <div
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
              style={{ left: impact[k] ? '18px' : '2px' }}
            />
          </div>
        </div>
      ))}
      {(impact.recert || impact.firmware) && (
        <div>
          <FieldLabel required>
            {impact.recert && impact.firmware
              ? 'Certification Type & Firmware Dependency'
              : impact.recert
                ? 'Certification Type Required'
                : 'Firmware Dependency Details'}
          </FieldLabel>
          <textarea
            value={impact.certNotes}
            onChange={e => { setImpact({ ...impact, certNotes: e.target.value }); if (errors.certNotes) setErrors(({ certNotes: _certNotes, ...rest }) => rest); }}
            placeholder={
              impact.recert && impact.firmware
                ? 'e.g. CE / UL re-test scope, and the SW/FW dependency this change introduces'
                : impact.recert
                  ? 'e.g. CE LVD, UL 60950, ISO 13485 re-test scope'
                  : 'e.g. requires firmware v2.3+ to support the new sensor'
            }
            className={cn(inputCls, 'h-16 resize-none', errors.certNotes && 'border-destructive')}
          />
          {errors.certNotes && (
            <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />{errors.certNotes}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const StepApproval = (
    <div className={cn('flex flex-col gap-2.5', isRework && 'opacity-60 pointer-events-none')}>
      {isRework && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
          style={{ color: '#DC2626', background: '#DC262614', border: '1px solid #DC262633' }}
        >
          <Lock className="w-3 h-3 shrink-0" />
          Pipeline locked during rework — resubmitting automatically reactivates the step that rejected this ECO.
        </div>
      )}
      <div className="text-[13px] text-muted-foreground mb-1">
        Ordered sign-off pipeline · assign a project member to each stage · reorder with arrows · mark stages optional. Any change to the default requires a justification.
      </div>
      {projectMembers.length === 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
          style={{ color: '#F59E0B', background: '#F59E0B14', border: '1px solid #F59E0B33' }}
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          No project members found — add members to the project team before assigning approvers.
        </div>
      )}
      {basics.changeClass === 'I' && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
          style={{ color: '#DC2626', background: '#DC262614', border: '1px solid #DC262633' }}
        >
          <Lock className="w-3 h-3 shrink-0" />
          Class I — Safety/Regulatory: QA and Final Approval are locked as mandatory and cannot be removed.
        </div>
      )}
      {pipeline.length < 2 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
          style={{ color: '#DC2626', background: '#DC262614', border: '1px solid #DC262633' }}
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          At least one approver besides the Originator is required — this ECO can&apos;t be submitted with nobody to review it.
        </div>
      )}
      {!isRework && pipelineMissingApprover && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
          style={{ color: '#DC2626', background: '#DC262614', border: '1px solid #DC262633' }}
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          Assign an approver to every stage before submitting.
        </div>
      )}
      {!isRework && pipelineMissingStageName && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
          style={{ color: '#DC2626', background: '#DC262614', border: '1px solid #DC262633' }}
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          Give every custom stage a name before submitting.
        </div>
      )}
      {!isRework && pipelineMissingJustification && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
          style={{ color: '#DC2626', background: '#DC262614', border: '1px solid #DC262633' }}
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          Add a justification for every optional or reordered stage before submitting.
        </div>
      )}
      {pipeline.map((p, idx) => {
        const locked = !p.isCustom && lockStage(p.stage);
        const removalLocked = locked || pipeline.length <= 2;
        const moved = stageMoved(p, idx);
        const needsReason = p.optional || moved;
        return (
          <div
            key={idx}
            className="border rounded-lg px-3 py-2.5"
            style={{ borderColor: needsReason ? '#F59E0B55' : 'hsl(var(--border))' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-muted-foreground w-5">{idx + 1}</span>
              <ECOAvatar name={p.name || '?'} size={26} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                  {p.isCustom ? (
                    <input
                      value={p.stage}
                      onChange={e => setPipeline(pl => pl.map((x, i) => i === idx ? { ...x, stage: e.target.value } : x))}
                      placeholder="Stage name…"
                      className={inputCls}
                      style={{ fontSize: 13, fontWeight: 600, padding: '1px 6px', width: 160, borderColor: p.stage.trim() ? undefined : '#F59E0B88' }}
                    />
                  ) : p.stage}
                  {moved && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ color: '#F59E0B', background: '#F59E0B1f', border: '1px solid #F59E0B33' }}
                    >
                      reordered
                    </span>
                  )}
                </div>
                <div className="relative mt-0.5 w-full max-w-[240px]">
                  <select
                    value={p.approverId ?? ''}
                    onChange={e => assignApprover(idx, e.target.value)}
                    className="w-full bg-muted/40 border rounded-md text-foreground text-[11px] pl-2 pr-7 py-1 outline-none focus:border-primary/40 cursor-pointer appearance-none font-[inherit]"
                    style={{ borderColor: p.approverId ? 'hsl(var(--border))' : '#F59E0B88' }}
                  >
                    <option value="" disabled className="bg-card">Select approver…</option>
                    {projectMembers.map(m => (
                      <option key={m.id} value={m.id} className="bg-card">{m.name} · {m.role}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-muted-foreground pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              {locked ? (
                <span
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold shrink-0"
                  style={{ background: '#DC262614', color: '#DC2626', border: '1px solid #DC262633' }}
                >
                  <Lock className="w-2.5 h-2.5" />
                  Required
                </span>
              ) : (
                <button
                  onClick={() => setPipeline(pl => pl.map((x, i) => i === idx ? { ...x, optional: !x.optional } : x))}
                  className="px-2 py-1 rounded-full text-[10px] font-semibold transition-colors font-[inherit]"
                  style={{
                    background: p.optional ? '#F59E0B1a' : 'hsl(var(--muted))',
                    color: p.optional ? '#F59E0B' : undefined,
                    border: `1px solid ${p.optional ? '#F59E0B44' : 'hsl(var(--border))'}`,
                    cursor: 'pointer',
                  }}
                >
                  {p.optional ? 'Optional' : 'Required'}
                </button>
              )}
              <div className="flex flex-col gap-0.5">
                <button
                  disabled={idx === 0}
                  onClick={() => setPipeline(pl => { const n = [...pl];[n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; return n; })}
                  className="disabled:opacity-30 cursor-pointer disabled:cursor-default"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                >
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground rotate-180" />
                </button>
                <button
                  disabled={idx === pipeline.length - 1}
                  onClick={() => setPipeline(pl => { const n = [...pl];[n[idx + 1], n[idx]] = [n[idx], n[idx + 1]]; return n; })}
                  className="disabled:opacity-30 cursor-pointer disabled:cursor-default"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                >
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              {removalLocked ? (
                <div className="w-4 flex justify-center" title={locked ? undefined : 'At least one non-Originator approver is required'}>
                  <Lock className="w-3 h-3 text-muted-foreground/50" />
                </div>
              ) : (
                <button
                  onClick={() => setPipeline(pl => pl.filter((_, i) => i !== idx))}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {needsReason && (
              <div className="mt-2.5 pt-2.5 border-t border-dashed border-border/60">
                <div
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider mb-1.5"
                  style={{ color: '#F59E0B' }}
                >
                  <AlertCircle className="w-3 h-3" />
                  {p.optional ? 'Why optional' : 'Why reordered'} — justification required
                </div>
                <input
                  value={p.justification ?? ''}
                  onChange={e => setPipeline(pl => pl.map((x, i) => i === idx ? { ...x, justification: e.target.value } : x))}
                  placeholder={p.optional ? `e.g. ${p.stage} waived — low geometric risk` : 'e.g. moved Final ahead of QA per program waiver'}
                  className={inputCls}
                  style={{
                    borderColor: (p.justification ?? '').trim() ? undefined : '#F59E0B88',
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
      <button
        onClick={() => setPipeline(pl => [
          ...pl,
          { order: pl.length, stage: '', name: '', role: '', approverId: null, optional: false, justification: '', isCustom: true },
        ])}
        className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors w-fit font-[inherit]"
        style={{ background: 'none', border: '1px dashed hsl(var(--border))', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
      >
        <Plus className="w-3.5 h-3.5" />
        Add stage
      </button>
      {basics.priority === 'LOW' && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <AlertCircle className="w-3 h-3" style={{ color: '#F59E0B' }} />
          Low priority — optional stages may be auto-skipped at submit.
        </div>
      )}
      {basics.priority === 'CRITICAL' && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <AlertCircle className="w-3 h-3" style={{ color: '#DC2626' }} />
          Critical — full pipeline incl. QA + final is enforced.
        </div>
      )}
    </div>
  );

  const stepContent = [StepBasics, StepItems, StepDetails, StepImpact, StepApproval][step];

  if (isEdit && editLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
        <div className="w-[680px] max-w-full flex items-center justify-center bg-card border border-border rounded-xl shadow-2xl h-48">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <svg className="animate-spin w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Loading ECO…</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Mobile: full-page step flow instead of a centered dialog ──────
  if (isMobile) {
    const onHeaderBack = () => {
      if (savePending) return;
      if (step > 0) { setErrors({}); setStep(step - 1); return; }
      onClose();
    };

    return createPortal(
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-2 mb-3">
            <button type="button" onClick={onHeaderBack} disabled={savePending}
              className="w-9 h-9 shrink-0 rounded-lg bg-muted flex items-center justify-center text-foreground disabled:opacity-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold text-foreground min-w-0 truncate text-center">
              {isRework ? 'Revise & Resubmit' : isEdit ? 'Edit Engineering Change Order' : 'New Engineering Change Order'}
            </h2>
            <button type="button" onClick={() => onClose()} disabled={savePending}
              className="w-9 h-9 shrink-0 rounded-lg bg-muted flex items-center justify-center text-foreground disabled:opacity-50">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isRework ? 'Rework · resubmitting reactivates the rejected approval step' : 'Draft · eco_number assigned on save'}
          </p>
        </div>

        {/* Progress */}
        <div className="shrink-0 px-4 pt-3 pb-1">
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-muted')} />
            ))}
          </div>
          <div className="mt-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isRework && reworkRejection && (
            <div
              className="flex items-start gap-3 p-3 rounded-lg mb-4"
              style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.22)' }}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#f97316' }} />
              <div>
                <div className="text-[12px] font-semibold text-foreground">
                  Rejected at {reworkRejection.stage} · {reworkRejection.when}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {reworkRejection.by}: "{reworkRejection.reason}"
                </div>
              </div>
            </div>
          )}
          {stepContent}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-4 py-3 flex items-center gap-3 bg-card">
          <button type="button" onClick={() => onClose()} disabled={savePending}
            className="flex-1 px-4 py-2.5 rounded-md text-[13px] font-medium bg-muted/50 text-foreground border border-border hover:bg-accent/50 transition-colors font-[inherit] disabled:opacity-50">
            Cancel
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={handleNext}
              className="flex-1 px-4 py-2.5 rounded-md text-[13px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors font-[inherit]">
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-[13px] font-semibold transition-colors font-[inherit]',
                canSubmit
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground cursor-default',
              )}
            >
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
              {savePending ? 'Saving…' : isRework ? 'Revise & Resubmit' : isEdit ? 'Save Changes' : 'Save Draft'}
            </button>
          )}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-center justify-center p-6',
        // Suppress this backdrop while the discard-confirm AlertDialog is open — it renders
        // its own full-screen overlay, and stacking both compounds into a near-solid black screen.
        confirmClose ? '' : 'bg-black/60 backdrop-blur-sm',
      )}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-[680px] max-w-full flex flex-col bg-card border border-border rounded-xl shadow-2xl"
        style={{ height: 'min(640px, 90vh)' }}
      >
        {/* Header + stepper */}
        <div className="px-5 pt-4 pb-0 border-b border-border">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <GitMerge className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-foreground">
                  {isRework ? 'Revise & Resubmit' : isEdit ? 'Edit Engineering Change Order' : 'New Engineering Change Order'}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {isRework ? 'Rework · resubmitting reactivates the rejected approval step' : 'Draft · eco_number assigned on save'}
                </div>
              </div>
            </div>
            <button
              onClick={() => (isDirty ? setConfirmClose(true) : onClose())}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <Stepper step={step} maxStepReached={maxStepReached} onStepClick={handleStepClick} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isRework && reworkRejection && (
            <div
              className="flex items-start gap-3 p-3 rounded-lg mb-4"
              style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.22)' }}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#f97316' }} />
              <div>
                <div className="text-[12px] font-semibold text-foreground">
                  Rejected at {reworkRejection.stage} · {reworkRejection.when}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {reworkRejection.by}: "{reworkRejection.reason}"
                </div>
              </div>
            </div>
          )}
          {stepContent}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-between">
          <div className="text-[11px] flex items-center gap-1.5">
            <span className="text-muted-foreground">
              {isRework ? 'Ready to resubmit for review' : 'Ready to save draft'}
            </span>
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => { setErrors({}); setStep(step - 1); }}
                className="px-4 py-2 rounded-md text-[13px] font-medium bg-muted/50 text-foreground border border-border hover:bg-accent/50 transition-colors font-[inherit]"
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="px-4 py-2 rounded-md text-[13px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors font-[inherit]"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-semibold transition-colors font-[inherit]',
                  canSubmit
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground cursor-default',
                )}
              >
                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                {savePending ? 'Saving…' : isRework ? 'Revise & Resubmit' : isEdit ? 'Save Changes' : 'Save Draft'}
              </button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent className="z-[300]">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this ECO?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Closing now will discard them. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => onClose()}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
