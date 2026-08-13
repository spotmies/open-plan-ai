import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Layers, Search, Filter, List, LayoutGrid, Share2,
  CheckCircle, Clock, DollarSign, ChevronRight, ChevronDown, Hash, X, User, Plus, Check, Download, ExternalLink,
  FileSpreadsheet, PenLine, Trash2, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useBomTree, useCreateBomNode, useDecideApprovalRequest, useDeleteBomNode, useAddRequirement, useProjectApprovalRequests } from '@/hooks/useBom';
import { useCreatePart } from '@/hooks/useParts';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useAuth } from '@/contexts/AuthContext';
import { uploadBomDocumentFile, addBomDocumentLink } from '@/hooks/useBomDocuments';
import { bomService } from '@/services/bom.service';
import { downloadBomCsv } from '@/features/reports/utils/exportUtils';
import { createBomWorkbook, downloadExcelFile } from '@/utils/excelExport';
import type { BOMApprovalRequest } from './bomData';

async function saveBomDocs(nodeId: string, payload: BOMPartPayload) {
  const docs = [payload.docPhoto, ...(payload.docDatasheet ?? []), ...(payload.doc3DModel ?? []), ...(payload.docFootprint ?? []), ...(payload.docCustom ?? [])].filter(Boolean) as DocValue[];
  await Promise.allSettled(
    docs.map(d => d.kind === 'file' ? uploadBomDocumentFile(nodeId, d.file) : addBomDocumentLink(nodeId, d.url, d.fileName ?? undefined)),
  );
}

// New parts can only be added as 'approved' or 'pending' (see BOMPartSheet's
// add-mode status toggle); narrow to what useCreateBomNode's DTO accepts.
function toNodeStatus(status: BOMStatus): 'approved' | 'pending' | 'draft' {
  return status === 'rejected' ? 'pending' : status;
}

function softTint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Owner initials helper (shared with detail screen)
function ownerInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}
const OWNER_COLORS = [
  '#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2', '#EA580C', '#4F46E5',
];
function ownerColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return OWNER_COLORS[Math.abs(h) % OWNER_COLORS.length];
}
function OwnerBadge({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  const sz = size === 'xs' ? 'w-4 h-4 text-[8px]' : 'w-5 h-5 text-[9px]';
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 w-full">
      <span className={`${sz} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
        style={{ background: ownerColor(name) }}>
        {ownerInitials(name)}
      </span>
      <span className="text-xs text-muted-foreground truncate min-w-0">{name}</span>
    </span>
  );
}
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  BOMNode, BOMFilters, BOMStatus, EMPTY_FILTERS,
  getCategoryMeta,
  bomFlatAll, bomFlatten, bomFind,
  bomFilterTree, bomFlattenInclude, bomTypeOf,
  fromApiNode, applyPriceRollup, assignLevelLabels, formatLeadTime,
  describeDeleteImpact,
} from './bomData';
import { BOMStatusPill, ReqTag, PartImageThumb } from './BOMShared';
import { BOMDetailScreen, AddSubcomponentDialog } from './BOMDetailScreen';
import { BOMMapView } from './BOMMapView';
import { BOMPartSheet, BOMPartPayload, DocValue } from './BOMPartSheet';
import { BOMRejectDialog } from './BOMRejectDialog';
import { BOMImportSubcomponentsDialog } from './BOMImportSubcomponentsDialog';
import { useCurrency } from '@/hooks/useCurrency';

// ── Skeletons ──────────────────────────────────────────────────────
function StatCardSkeleton() {
  return (
    <div className="bg-card rounded-lg p-2.5 flex-1 min-w-[140px] border border-border flex items-center gap-2.5">
      <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-10 mb-1.5" />
        <Skeleton className="h-2.5 w-20" />
      </div>
    </div>
  );
}

function ListRowSkeleton({ level = 0 }: { level?: number }) {
  return (
    <div className="flex items-center px-6 border-b border-border" style={{ minWidth: 1200, height: 46 }}>
      <div style={{ flexBasis: 74, flexShrink: 0 }} className="flex items-center">
        <Skeleton className="h-3 w-6" style={{ marginLeft: level * 16 }} />
      </div>
      <div className="flex-1 min-w-0 px-2 flex items-center gap-2.5">
        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-2.5 w-20 mb-1.5" />
          <Skeleton className="h-3.5 w-48" />
        </div>
      </div>
      <div style={{ flexBasis: 50, flexShrink: 0 }} className="px-2 flex justify-end"><Skeleton className="h-3.5 w-6" /></div>
      <div style={{ flexBasis: 50, flexShrink: 0 }} className="px-2"><Skeleton className="h-3 w-8" /></div>
      <div style={{ flexBasis: 140, flexShrink: 0 }} className="px-2"><Skeleton className="h-3 w-20" /></div>
      <div style={{ flexBasis: 90, flexShrink: 0 }} className="px-2 flex justify-end"><Skeleton className="h-3.5 w-14" /></div>
      <div style={{ flexBasis: 74, flexShrink: 0 }} className="px-2"><Skeleton className="h-3 w-10" /></div>
      <div style={{ flexBasis: 50, flexShrink: 0 }} className="px-2"><Skeleton className="h-5 w-8 rounded" /></div>
      <div style={{ flexBasis: 92, flexShrink: 0 }} className="px-2"><Skeleton className="h-5 w-16 rounded-full" /></div>
      <div style={{ flexBasis: 140, flexShrink: 0 }} className="px-2 flex items-center gap-1.5">
        <Skeleton className="w-5 h-5 rounded-full shrink-0" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div style={{ flexBasis: 170, flexShrink: 0 }} className="px-2"><Skeleton className="h-5 w-16 rounded-full" /></div>
      <div style={{ flexBasis: 110, flexShrink: 0 }} />
    </div>
  );
}

function MobileListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
      <Skeleton className="w-[44px] h-[44px] rounded-[10px] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-12 shrink-0" />
        </div>
        <Skeleton className="h-2.5 w-24 mb-2" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-2.5 w-10" />
        </div>
      </div>
    </div>
  );
}

const SKELETON_LEVELS = [0, 0, 1, 1, 2, 0, 1, 2];

function BOMViewSkeleton() {
  return (
    <div className="flex flex-col h-full px-6 overflow-hidden bg-background" style={{ height: 'calc(100vh - 140px)' }}>
      <div className="shrink-0 py-4">
        <div className="flex gap-2.5 md:gap-3 flex-wrap mb-4">
          {[0, 1, 2, 3].map(i => <StatCardSkeleton key={i} />)}
        </div>
        {/* Toolbar skeleton — desktop/tablet */}
        <div className="hidden md:flex items-center gap-2.5 pb-0">
          <Skeleton className="h-8 w-72 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <div className="flex-1" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <div className="w-px h-5 bg-border" />
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>
        {/* Toolbar skeleton — mobile */}
        <div className="flex md:hidden items-center gap-2 pb-0">
          <Skeleton className="w-8 h-8 rounded-md shrink-0" />
          <Skeleton className="h-7 w-16 rounded-md" />
          <div className="flex-1" />
          <Skeleton className="w-8 h-8 rounded-md shrink-0" />
          <Skeleton className="w-8 h-8 rounded-md shrink-0" />
          <Skeleton className="w-8 h-8 rounded-md shrink-0" />
        </div>
      </div>
      {/* Table skeleton — desktop/tablet only */}
      <div className="hidden md:flex md:flex-col md:flex-1 overflow-hidden">
        {/* Table header — real so column names are visible */}
        <div className="flex items-center px-6 border-b border-t border-border bg-muted/40" style={{ minWidth: 1200 }}>
          {HEADERS.map((c, i) => (
            <div key={c.key}
              style={{ flexBasis: c.w ?? 'auto', flexGrow: c.w ? 0 : 1, flexShrink: c.w ? 0 : 1 }}
              className={cn('py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider select-none',
                i === 0 ? 'pl-0 pr-2' : 'px-2'
              )}>
              {c.label}
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-hidden border-t-0" style={{ minWidth: 1200 }}>
          {SKELETON_LEVELS.map((level, i) => <ListRowSkeleton key={i} level={level} />)}
        </div>
      </div>
      {/* Card skeleton — mobile only */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden border-t border-border">
        {SKELETON_LEVELS.map((_, i) => <MobileListRowSkeleton key={i} />)}
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, iconColor, accent }: {
  label: string; value: string; icon: React.ElementType;
  iconColor: string; accent?: boolean;
}) {
  return (
    <div className={cn('bg-card rounded-lg px-3.5 py-2.5 flex-1 min-w-[140px] border flex items-center gap-2.5', accent ? 'border-primary/25' : 'border-border')}>
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: softTint(iconColor, 0.12) }}
      >
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold leading-tight truncate" style={{ color: accent ? iconColor : undefined }}>
          {value}
        </span>
        <span className="block text-[11px] text-muted-foreground truncate">{label}</span>
      </span>
    </div>
  );
}

// ── Filter drawer ──────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-4 border-b border-border">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{title}</div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap border transition-colors',
        active
          ? 'bg-primary/10 text-primary border-primary/30'
          : 'bg-card text-muted-foreground border-border hover:bg-muted'
      )}
    >
      {children}
    </button>
  );
}

function RangeInput({ value, onChange, placeholder, prefix }: {
  value: string; onChange: (v: string) => void; placeholder: string; prefix?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-muted border border-border rounded-md px-2.5 py-1.5 flex-1 min-w-0">
      {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
      <input
        type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onWheel={e => e.currentTarget.blur()}
        className="bg-transparent border-none outline-none text-foreground text-xs w-full"
      />
    </div>
  );
}

function FilterDrawer({ open, filters, setFilters, onClose, facets, currencySymbol }: {
  open: boolean; filters: BOMFilters;
  setFilters: React.Dispatch<React.SetStateAction<BOMFilters>>;
  onClose: () => void;
  facets: { units: string[]; manufacturers: string[]; suppliers: string[]; owners: string[] };
  currencySymbol: string;
}) {
  const [draft, setDraft] = useState<BOMFilters>({ ...filters });
  const [customMfrs, setCustomMfrs] = useState<string[]>([]);
  const [customSuppliers, setCustomSuppliers] = useState<string[]>([]);
  const [mfrInput, setMfrInput] = useState('');
  const [supplierInput, setSupplierInput] = useState('');
  const [showMfrInput, setShowMfrInput] = useState(false);
  const [showSupplierInput, setShowSupplierInput] = useState(false);

  // Sync draft to committed filters each time the drawer opens
  useEffect(() => { if (open) setDraft({ ...filters }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const toggle = (key: 'units' | 'suppliers' | 'manufacturers' | 'statuses' | 'owners', val: string) =>
    setDraft(f => ({
      ...f,
      [key]: (f[key] as string[]).includes(val)
        ? (f[key] as string[]).filter(x => x !== val)
        : [...(f[key] as string[]), val],
    }));
  const set = <K extends keyof BOMFilters>(key: K, val: BOMFilters[K]) =>
    setDraft(f => ({ ...f, [key]: val }));

  const addCustomMfr = () => {
    const v = mfrInput.trim();
    if (!v) return;
    if (!customMfrs.includes(v)) setCustomMfrs(m => [...m, v]);
    setDraft(f => ({
      ...f,
      manufacturers: f.manufacturers.includes(v) ? f.manufacturers : [...f.manufacturers, v],
    }));
    setMfrInput('');
    setShowMfrInput(false);
  };

  const addCustomSupplier = () => {
    const v = supplierInput.trim();
    if (!v) return;
    if (!customSuppliers.includes(v)) setCustomSuppliers(s => [...s, v]);
    setDraft(f => ({
      ...f,
      suppliers: f.suppliers.includes(v) ? f.suppliers : [...f.suppliers, v],
    }));
    setSupplierInput('');
    setShowSupplierInput(false);
  };


  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" />
      <div className="fixed top-0 right-0 bottom-0 w-[352px] bg-card border-l border-border z-[61] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Filters</span>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Section title="Type of BOM">
            <div className="flex bg-muted border border-border rounded-lg p-0.5 gap-0.5">
              {([['all', 'All BOM'], ['top', 'Top Level'], ['catalog', 'Catalog']] as const).map(([id, label]) => (
                <button key={id} onClick={() => set('bomType', id)}
                  className={cn('flex-1 py-1.5 rounded-md text-xs font-medium cursor-pointer border-none transition-colors',
                    draft.bomType === id ? 'bg-foreground text-background' : 'bg-transparent text-muted-foreground hover:text-foreground')}>
                  {label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Status">
            <div className="flex gap-2 flex-wrap">
              {(['approved', 'pending', 'rejected'] as const).map(s => (
                <Chip key={s} active={draft.statuses.includes(s)} onClick={() => toggle('statuses', s)}>
                  {s === 'approved' ? 'Approved' : s === 'pending' ? 'Pending' : 'Rejected'}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title={`Unit Price (${currencySymbol})`}>
            <div className="flex items-center gap-2">
              <RangeInput value={draft.priceMin} onChange={v => set('priceMin', v)} placeholder="Min" prefix={currencySymbol} />
              <span className="text-muted-foreground text-xs">–</span>
              <RangeInput value={draft.priceMax} onChange={v => set('priceMax', v)} placeholder="Max" prefix={currencySymbol} />
            </div>
          </Section>

          <Section title="Lead Time (days)">
            <div className="flex items-center gap-2">
              <RangeInput value={draft.leadMin} onChange={v => set('leadMin', v)} placeholder="Min" />
              <span className="text-muted-foreground text-xs">–</span>
              <RangeInput value={draft.leadMax} onChange={v => set('leadMax', v)} placeholder="Max" />
            </div>
          </Section>

          <Section title="Units (UOM)">
            <div className="flex gap-2 flex-wrap">
              {facets.units.map(u => <Chip key={u} active={draft.units.includes(u)} onClick={() => toggle('units', u)}>{u}</Chip>)}
            </div>
          </Section>

          <Section title="Manufacturer">
            <div className="flex gap-2 flex-wrap">
              {[...facets.manufacturers, ...customMfrs.filter(c => !facets.manufacturers.includes(c))].map(m => (
                <Chip key={m} active={draft.manufacturers.includes(m)} onClick={() => toggle('manufacturers', m)}>{m}</Chip>
              ))}
              {showMfrInput ? (
                <div className="flex items-center gap-1 bg-muted border border-primary/40 rounded-md px-2 py-0.5">
                  <input
                    autoFocus
                    value={mfrInput}
                    onChange={e => setMfrInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCustomMfr(); if (e.key === 'Escape') { setShowMfrInput(false); setMfrInput(''); } }}
                    placeholder="Type name…"
                    className="bg-transparent border-none outline-none text-xs text-foreground w-24 placeholder:text-muted-foreground"
                  />
                  <button onClick={addCustomMfr} className="text-primary hover:text-primary/80 text-xs font-semibold">Add</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowMfrInput(true)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center gap-1"
                >
                  <span className="text-base leading-none">+</span> Add
                </button>
              )}
            </div>
          </Section>

          <Section title="Supplier / Distributor">
            <div className="flex gap-2 flex-wrap">
              {[...facets.suppliers, ...customSuppliers.filter(c => !facets.suppliers.includes(c))].map(s => (
                <Chip key={s} active={draft.suppliers.includes(s)} onClick={() => toggle('suppliers', s)}>{s}</Chip>
              ))}
              {showSupplierInput ? (
                <div className="flex items-center gap-1 bg-muted border border-primary/40 rounded-md px-2 py-0.5">
                  <input
                    autoFocus
                    value={supplierInput}
                    onChange={e => setSupplierInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCustomSupplier(); if (e.key === 'Escape') { setShowSupplierInput(false); setSupplierInput(''); } }}
                    placeholder="Type name…"
                    className="bg-transparent border-none outline-none text-xs text-foreground w-24 placeholder:text-muted-foreground"
                  />
                  <button onClick={addCustomSupplier} className="text-primary hover:text-primary/80 text-xs font-semibold">Add</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSupplierInput(true)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center gap-1"
                >
                  <span className="text-base leading-none">+</span> Add
                </button>
              )}
            </div>
          </Section>

          <Section title="Owner / Handled By">
            <div className="flex gap-2 flex-wrap">
              {facets.owners.map(o => (
                <Chip key={o} active={draft.owners.includes(o)} onClick={() => toggle('owners', o)}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                      style={{ background: ownerColor(o) }}>
                      {ownerInitials(o)}
                    </span>
                    {o.split(' ')[0]}
                  </span>
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Manufacturer Part Number (MPN)">
            <div className="flex items-center gap-2 bg-muted border border-border rounded-md px-2.5 py-1.5">
              <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                value={draft.mpn} onChange={e => set('mpn', e.target.value)}
                placeholder="e.g. INF-4A29C"
                className="bg-transparent border-none outline-none text-foreground text-xs w-full font-mono"
              />
            </div>
          </Section>
        </div>

        <div className="flex gap-2.5 px-4 py-3.5 border-t border-border">
          <Button variant="outline" className="flex-1" onClick={() => { setDraft({ ...EMPTY_FILTERS }); setFilters({ ...EMPTY_FILTERS }); onClose(); }}>Clear all</Button>
          <Button className="flex-1" onClick={() => { setFilters(draft); onClose(); }}>Show results</Button>
        </div>
      </div>
    </>
  );
}

// ── List view ──────────────────────────────────────────────────────
const HEADERS = [
  { key: 'level', label: 'Level', w: 74 },
  { key: 'part', label: 'Part', w: null },
  { key: 'qty', label: 'Qty', w: 50 },
  { key: 'uom', label: 'UOM', w: 50 },
  { key: 'mfr', label: 'Manufacturer', w: 140 },
  { key: 'price', label: 'Unit Price', w: 90 },
  { key: 'lead', label: 'Lead', w: 74 },
  { key: 'rev', label: 'Rev', w: 50 },
  { key: 'status', label: 'Status', w: 92 },
  { key: 'owner', label: 'Owner', w: 140 },
  { key: 'supplier', label: 'Supplier', w: 170 },
  { key: 'act', label: 'Action', w: 110 },
] as const;

function ListView({
  rows, expanded, toggle, filtersActive, onOpen, onAddSub, onDeleteRequest, totalCount, formatCurrency,
  canDecideRow, onApprove, onReject, approvingId,
}: {
  rows: BOMNode[];
  expanded: Record<string, boolean>;
  toggle: (id: string) => void;
  filtersActive: boolean;
  onOpen: (id: string) => void;
  onAddSub: (node: BOMNode) => void;
  onDeleteRequest: (node: BOMNode) => void;
  totalCount: number;
  formatCurrency: (n: number) => string;
  canDecideRow: (nodeId: string) => boolean;
  onApprove: (node: BOMNode) => void;
  onReject: (node: BOMNode) => void;
  approvingId: string | null;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const rowH = 46;

  return (
    <div className="hidden md:block flex-1 overflow-y-auto overflow-x-auto border-t border-border">
      {/* Header */}
      <div className="flex items-center px-6 border-b border-border bg-background sticky top-0 z-10" style={{ minWidth: 1200 }}>
        {HEADERS.map((c, i) => (
          <div key={c.key}
            style={{ flexBasis: c.w ?? 'auto', flexGrow: c.w ? 0 : 1, flexShrink: c.w ? 0 : 1 }}
            className={cn('py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider select-none',
              i === 0 ? 'pl-0 pr-2' : 'px-2',
              (c.key === 'qty' || c.key === 'price') && 'text-right'
            )}>
            {c.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ minWidth: 1200 }}>
        {rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Search className="w-7 h-7 mx-auto mb-3 opacity-30" />
            <div className="text-sm">No parts match your filters</div>
          </div>
        ) : rows.map(row => {
          const hasChildren = !!(row.children?.length);
          const isHovered = hovered === row.id;
          const isExp = filtersActive ? true : !!expanded[row.id];

          return (
            <div key={row.id}
              onMouseEnter={() => setHovered(row.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onOpen(row.id)}
              className="flex items-center px-6 border-b border-border cursor-pointer transition-colors"
              style={{
                height: rowH,
                background: isHovered ? 'hsl(var(--card))' : row.status === 'pending' ? 'rgba(245,158,11,0.03)' : 'transparent',
              }}
            >
              {/* Level */}
              <div style={{ flexBasis: 74, flexShrink: 0 }} className="flex items-center">
                <span
                  onClick={e => { e.stopPropagation(); if (hasChildren && !filtersActive) toggle(row.id); }}
                  className="inline-flex items-center p-0.5"
                  style={{ marginLeft: filtersActive ? 0 : row.level * 16, cursor: hasChildren && !filtersActive ? 'pointer' : 'default', flexShrink: 0 }}
                >
                  {hasChildren && !filtersActive ? (
                    <span className="inline-flex transition-transform" style={{ transform: isExp ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                      <ChevronDown className="w-3 h-3" />
                    </span>
                  ) : <span className="w-3 inline-block" />}
                </span>
                <span className={cn('text-xs font-semibold ml-0.5 tabular-nums',
                  row.level === 0 ? 'text-foreground' : row.level === 1 ? 'text-muted-foreground' : 'text-muted-foreground/60'
                )}>
                  {row.levelLabel ?? row.level}
                </span>
              </div>

              {/* Part */}
              <div className="flex-1 min-w-0 px-2 flex items-center gap-2.5">
                <PartImageThumb nodeId={row.id} cat={row.cat} size={32} hoverZoom />
                <div className="flex-1 min-w-0">
                  <span className={cn('text-sm block truncate',
                    row.level === 0 ? 'font-semibold text-foreground' : row.level === 1 ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}>
                    {row.name || row.desc}
                  </span>
                  <span className="text-xs font-medium font-mono block truncate text-muted-foreground">{row.pn}</span>
                </div>
              </div>

              {/* Qty */}
              <div style={{ flexBasis: 50, flexShrink: 0 }} className="px-2 text-sm text-foreground text-right tabular-nums">{row.qty}</div>
              {/* UOM */}
              <div style={{ flexBasis: 50, flexShrink: 0 }} className="px-2 text-xs text-muted-foreground">{row.uom}</div>
              {/* Manufacturer */}
              <div style={{ flexBasis: 140, flexShrink: 0 }} className="px-2 text-xs text-muted-foreground truncate">{row.manufacturer}</div>
              {/* Price */}
              <div style={{ flexBasis: 90, flexShrink: 0 }} className="px-2 text-sm text-foreground text-right tabular-nums">{formatCurrency(row.price)}</div>
              {/* Lead */}
              <div style={{ flexBasis: 74, flexShrink: 0 }} className="px-2 text-xs text-muted-foreground tabular-nums">{formatLeadTime(row.leadTime)}</div>
              {/* Rev */}
              <div style={{ flexBasis: 50, flexShrink: 0 }} className="px-2">
                <span className="text-[11px] font-semibold text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">{row.rev}</span>
              </div>
              {/* Status */}
              <div style={{ flexBasis: 92, flexShrink: 0 }} className="px-2"><BOMStatusPill status={row.status} /></div>
              {/* Owner */}
              <div style={{ flexBasis: 140, flexShrink: 0 }} className="px-2 min-w-0 overflow-hidden">
                <OwnerBadge name={row.owner} />
              </div>
              {/* Supplier */}
              <div style={{ flexBasis: 170, flexShrink: 0 }} className="px-2 text-xs text-muted-foreground truncate">
                {row.distributor || <span className="text-[11px]">—</span>}
              </div>
              {/* Actions */}
              <div style={{ flexBasis: 110, flexShrink: 0 }} className={cn('flex items-center justify-end gap-1 transition-opacity', isHovered ? 'opacity-100' : 'opacity-0')}>
                {row.status === 'pending' && canDecideRow(row.id) && (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); onApprove(row); }}
                      disabled={approvingId === row.id}
                      title="Approve part"
                      className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" style={{ color: '#16A34A' }} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); onReject(row); }}
                      disabled={approvingId === row.id}
                      title="Reject part"
                      className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                    </button>
                  </>
                )}
                <button
                  onClick={e => { e.stopPropagation(); onAddSub(row); }}
                  title="Add sub-component"
                  className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDeleteRequest(row); }}
                  title="Delete part"
                  className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                </button>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {rows.length > 0 && (
        <div className="px-6 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground" style={{ minWidth: 1200 }}>
          <span>Showing {rows.length} of {totalCount} total parts</span>
          <span>Last updated 23-Apr-2026 · Rev C approved by Engineering</span>
        </div>
      )}
    </div>
  );
}

// ── Mobile-only status pill (short label, matches the mobile design spec) ──
const MOBILE_STATUS_STYLE: Record<BOMStatus, { bg: string; color: string; label: string }> = {
  approved: { bg: 'rgba(34,197,94,0.12)', color: '#16A34A', label: 'Approved' },
  pending:  { bg: 'rgba(245,158,11,0.14)', color: '#D97706', label: 'Pending' },
  rejected: { bg: 'rgba(220,38,38,0.12)', color: '#DC2626', label: 'Rejected' },
  draft:    { bg: 'rgba(100,116,139,0.12)', color: '#64748B', label: 'Draft' },
};
function MobileStatusPill({ status }: { status: BOMStatus }) {
  const s = MOBILE_STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-semibold whitespace-nowrap shrink-0"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

// ── Mobile list view (stacked cards, no horizontal scroll) ─────────
// Shows only what matters at a glance — icon, PN, name, qty/rev,
// status. Everything else (mfr, lead, price, owner, supplier,
// approve/reject/add/delete actions) lives one tap away in BOMDetailScreen.
function MobileListView({
  rows, expanded, toggle, filtersActive, onOpen, totalCount,
}: {
  rows: BOMNode[];
  expanded: Record<string, boolean>;
  toggle: (id: string) => void;
  filtersActive: boolean;
  onOpen: (id: string) => void;
  totalCount: number;
}) {
  return (
    <div className="flex md:hidden flex-1 flex-col overflow-y-auto border-t border-border">
      {rows.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Search className="w-7 h-7 mx-auto mb-3 opacity-30" />
          <div className="text-sm">No parts match your filters</div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map(row => {
            const hasChildren = !!(row.children?.length);
            const isExp = filtersActive ? true : !!expanded[row.id];
            const indent = filtersActive ? 0 : Math.min(row.level, 4) * 16;

            return (
              <div
                key={row.id}
                onClick={() => onOpen(row.id)}
                className="flex items-center gap-3 px-4 py-3 active:bg-muted/40 transition-colors cursor-pointer"
              >
                {/* Level label — mirrors the desktop LEVEL column */}
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums" style={{ width: 26 }}>
                  {row.levelLabel ?? row.level}
                </span>

                {/* Expand toggle (only for parents) / hierarchy indent */}
                <span className="shrink-0 flex items-center justify-center" style={{ width: 16, marginLeft: indent }}>
                  {hasChildren && !filtersActive ? (
                    <button
                      onClick={e => { e.stopPropagation(); toggle(row.id); }}
                      className="inline-flex items-center justify-center w-6 h-6 -m-1 text-muted-foreground"
                    >
                      <span className="inline-flex transition-transform" style={{ transform: isExp ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  ) : null}
                </span>

                <PartImageThumb nodeId={row.id} cat={row.cat} size={44} radius={12} />

                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-primary truncate leading-tight">{row.pn}</div>
                  <div className={cn('text-[14.5px] leading-snug truncate mt-0.5',
                    row.level === 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'
                  )}>
                    {row.name || row.desc}
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-1 truncate">
                    Qty {row.qty} {row.uom} · Rev {row.rev}
                  </div>
                </div>

                <MobileStatusPill status={row.status} />
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <div className="px-4 py-3.5 text-center text-[11px] text-muted-foreground border-t border-border">
          Showing {rows.length} of {totalCount} total parts
        </div>
      )}
    </div>
  );
}

// ── Grid view ──────────────────────────────────────────────────────
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-xs font-medium text-foreground truncate">{value}</div>
    </div>
  );
}

function GridBreadcrumb({ path, onJump }: { path: BOMNode[]; onJump: (depth: number) => void }) {
  return (
    <div className="px-5 pt-4 pb-1 flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
      <button
        onClick={() => onJump(0)}
        className={cn('hover:text-foreground transition-colors cursor-pointer', path.length === 0 ? 'text-foreground font-semibold' : 'font-medium')}
      >
        BOM
      </button>
      {path.map((node, i) => (
        <span key={node.id} className="flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3" />
          <button
            onClick={() => onJump(i + 1)}
            className={cn('hover:text-foreground transition-colors font-mono cursor-pointer', i === path.length - 1 ? 'text-foreground font-semibold' : 'font-medium')}
          >
            {node.pn}
          </button>
        </span>
      ))}
    </div>
  );
}

function GridView({ rows, rootNodes, filtersActive, onOpen, totalCount, formatCurrency }: { rows: BOMNode[]; rootNodes: BOMNode[]; filtersActive: boolean; onOpen: (id: string) => void; totalCount: number; formatCurrency: (n: number) => string }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [drillPath, setDrillPath] = useState<BOMNode[]>([]);

  const current = drillPath[drillPath.length - 1];
  const displayRows = filtersActive ? rows : (current?.children ?? rootNodes);

  const handleCardClick = (row: BOMNode, hasChildren: boolean) => {
    if (!filtersActive && hasChildren) {
      setDrillPath(prev => [...prev, row]);
    } else {
      onOpen(row.id);
    }
  };

  return (
    <div className="flex-1 border-t border-border overflow-y-auto">
      {!filtersActive && <GridBreadcrumb path={drillPath} onJump={depth => setDrillPath(prev => prev.slice(0, depth))} />}
      {displayRows.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm">{filtersActive ? 'No parts match your filters' : 'No sub-components here'}</div>
        </div>
      ) : (
        <>
          <div className="p-5 grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))' }}>
            {displayRows.map(row => {
              const meta = getCategoryMeta(row.cat);
              const isH = hovered === row.id;
              const hasChildren = !!(row.children?.length);
              return (
                <div
                  key={row.id}
                  onClick={() => handleCardClick(row, hasChildren)}
                  onMouseEnter={() => setHovered(row.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="bg-card border rounded-xl overflow-hidden cursor-pointer transition-all"
                  style={{
                    borderColor: isH ? 'hsl(var(--foreground) / 0.25)' : 'hsl(var(--border))',
                    transform: isH ? 'translateY(-2px)' : undefined,
                  }}
                >
                  {/* Thumbnail */}
                  <div className="relative p-2.5">
                    <PartImageThumb nodeId={row.id} cat={row.cat} big />
                    <span className="absolute top-4 left-4 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-card/90"
                      style={{ backdropFilter: 'blur(4px)', color: meta.tint, border: `1px solid ${meta.tint}40` }}>
                      {row.levelLabel ?? `L${row.level}`}
                    </span>
                    <span className="absolute top-4 right-4"><BOMStatusPill status={row.status} /></span>
                    {isH && (
                      <button
                        onClick={e => { e.stopPropagation(); onOpen(row.id); }}
                        className="absolute inset-2.5 flex items-center justify-center rounded-lg bg-black/45 transition-opacity"
                      >
                        <span className="inline-flex items-center gap-1.5 bg-card text-foreground text-xs font-medium px-3 py-1.5 rounded-md shadow-sm cursor-pointer">
                          <ExternalLink className="w-3.5 h-3.5" /> Open Details
                        </span>
                      </button>
                    )}
                  </div>
                  {/* Body */}
                  <div className="px-3.5 pb-3.5 pt-0.5">
                    <div className="text-[13.5px] font-semibold text-foreground leading-snug mb-1 line-clamp-2 min-h-[35px]">
                      {row.name || row.desc}
                    </div>
                    <div className="text-[11px] font-medium font-mono mb-2.5 text-muted-foreground">{row.pn}</div>
                    <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5 mb-2.5">
                      <Meta label="Qty" value={`${row.qty} ${row.uom}`} />
                      <Meta label="Unit Price" value={formatCurrency(row.price)} />
                      <Meta label="Manufacturer" value={row.manufacturer} />
                      <Meta label="Lead Time" value={formatLeadTime(row.leadTime)} />
                    </div>
                    {/* Owner row */}
                    <div className="flex items-center gap-1.5 mb-2.5 py-1.5 px-2 rounded-md bg-muted/40 border border-border/50">
                      <User className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">Owner</span>
                      <span className="ml-auto">
                        <OwnerBadge name={row.owner} size="xs" />
                      </span>
                    </div>
                    {hasChildren && !filtersActive && (
                      <div className="flex items-center gap-1.5 mb-2.5 text-[11px] font-medium text-primary">
                        <Layers className="w-3 h-3" />
                        {row.children!.length} sub-component{row.children!.length !== 1 ? 's' : ''}
                        <ChevronRight className="w-3 h-3 ml-auto" />
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2.5 border-t border-border">
                      <div className="flex gap-1 flex-wrap overflow-hidden">
                        {row.req.length === 0
                          ? <span className="text-[11px] text-muted-foreground">No traceability</span>
                          : row.req.slice(0, 2).map(r => <ReqTag key={r} label={r} />)}
                        {row.req.length > 2 && <span className="text-[11px] text-muted-foreground self-center">+{row.req.length - 2}</span>}
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 shrink-0">{row.rev}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-6 pb-5 text-xs text-muted-foreground">
            {`Showing ${displayRows.length} of ${totalCount} total parts`}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main BOMView ───────────────────────────────────────────────────
type ViewMode = 'list' | 'grid' | 'map';

interface BOMViewProps {
  projectId: string;
  orgId: string;
  addOpen?: boolean;
  onAddClose?: () => void;
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  onEcoCreated?: (ecoId: string) => void;
}

export function BOMView({
  projectId,
  orgId,
  addOpen = false,
  onAddClose,
  selectedId = null,
  onSelectedIdChange,
  onEcoCreated,
}: BOMViewProps) {
  const selected = selectedId;
  const setSelected = (id: string | null) => onSelectedIdChange?.(id);
  const [searchParams] = useSearchParams();
  const fallbackPartId = searchParams.get('partId');
  const fallbackPn = searchParams.get('pn');
  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const [addManualOpen, setAddManualOpen] = useState(false);
  const [addImportOpen, setAddImportOpen] = useState(false);
  const [addSubNode, setAddSubNode] = useState<BOMNode | null>(null);
  const [createSubNode, setCreateSubNode] = useState<BOMNode | null>(null);
  const [importSubNode, setImportSubNode] = useState<BOMNode | null>(null);

  // Intercept external addOpen prop — show choice dialog instead of going straight to the sheet
  const prevAddOpen = useRef(false);
  useEffect(() => {
    if (addOpen && !prevAddOpen.current) {
      setAddChoiceOpen(true);
    }
    prevAddOpen.current = addOpen;
  }, [addOpen]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [rejectTarget, setRejectTarget] = useState<BOMNode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BOMNode | null>(null);
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem('bom_view') as ViewMode) ?? 'list');
  const [filterOpen, setFilterOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [filters, setFilters] = useState<BOMFilters>({ ...EMPTY_FILTERS });
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('bom_expanded');
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
    return {};
  });

  const { formatCurrency, currencySymbol } = useCurrency();

  // ── Live API data ─────────────────────────────────────────────────
  const { data: bomTree, isLoading: treeLoading } = useBomTree(projectId);
  const { data: project } = useProjectDetail(projectId);
  const { user } = useAuth();
  const createPart = useCreatePart(orgId);
  const createNode = useCreateBomNode(projectId);
  const decideApprovalRequest = useDecideApprovalRequest(projectId);
  const deleteBomNode = useDeleteBomNode(projectId);
  const addRequirement = useAddRequirement(projectId);
  const { data: pendingApprovalRequests = [] } = useProjectApprovalRequests(projectId, 'pending');

  const projectRole = (project?.myRole || '').toLowerCase();
  const isAdmin = projectRole === 'admin';

  // Map every node covered by an active request to that request, so row-level
  // actions and the "Needs Your Review" card can be gated without N+1 calls.
  const pendingRequestByNodeId = useMemo(() => {
    const map = new Map<string, BOMApprovalRequest>();
    for (const req of pendingApprovalRequests) {
      for (const nodeId of req.nodeIds) map.set(nodeId, req);
    }
    return map;
  }, [pendingApprovalRequests]);

  // Approve/reject buttons only appear when a review request has actually been
  // sent for the node. Admins can decide any active request; other users only
  // if they are listed as an approver on that request.
  const canDecideRow = useCallback((nodeId: string): boolean => {
    const req = pendingRequestByNodeId.get(nodeId);
    if (!req) return false;
    if (isAdmin) return true;
    if (!user) return false;
    return req.approvers.some(a => a.id === user.id);
  }, [isAdmin, user, pendingRequestByNodeId]);

  const handleApprove = async (node: BOMNode) => {
    const active = pendingRequestByNodeId.get(node.id);
    if (!active) { toast.error('This part has not been sent for review yet.'); return; }
    try {
      await decideApprovalRequest.mutateAsync({ requestId: active.id, nodeId: node.id, decision: 'approved' });
      toast.success(`${node.pn} approved`);
    } catch (err) {
      toast.error('Failed to approve part', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleRejectConfirm = async (reason: string, comment?: string) => {
    if (!rejectTarget) return;
    const active = pendingRequestByNodeId.get(rejectTarget.id);
    if (!active) { toast.error('This part has not been sent for review yet.'); return; }
    try {
      await decideApprovalRequest.mutateAsync({ requestId: active.id, nodeId: rejectTarget.id, decision: 'rejected', reason, comment });
      toast.success(`${rejectTarget.pn} rejected`);
    } catch (err) {
      toast.error('Failed to reject part', {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { deletedCount } = await deleteBomNode.mutateAsync(deleteTarget.id);
      toast.success(deletedCount > 1 ? `Deleted ${deletedCount} parts` : `${deleteTarget.pn} deleted`);
      if (selected === deleteTarget.id) setSelected(null);
    } catch (err) {
      toast.error('Failed to delete part', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const rootNodes = useMemo(() => {
    if (!bomTree?.roots?.length) return [];
    const nodes = bomTree.roots.map(r => applyPriceRollup(fromApiNode(r)));
    assignLevelLabels(nodes);
    return nodes;
  }, [bomTree]);

  const allNodes = useMemo(() => bomFlatAll(rootNodes), [rootNodes]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('bom_expanded', JSON.stringify(next));
      return next;
    });
  };

  const handleView = (v: ViewMode) => { setView(v); localStorage.setItem('bom_view', v); };

  // ── Add Part handler (two-step: create part in catalog, then node) ─
  const handleAddPart = async (payload: BOMPartPayload) => {
    try {
      const part = await createPart.mutateAsync({
        partNumber:          payload.pn,
        name:                payload.name,
        description:         payload.desc,
        category:            payload.category,
        manufacturer:        payload.manufacturer || undefined,
        distributor:         payload.distributor  || undefined,
        mpn:                 payload.mpn          || undefined,
        unit:                payload.uom,
        initialStatus:       payload.status,
        initialRev:          payload.rev,
        initialPrice:        payload.price > 0 ? payload.price : undefined,
        initialLeadTimeDays: payload.leadTime > 0 ? payload.leadTime : undefined,
        initialSuppliers:    payload.suppliers?.length ? payload.suppliers : undefined,
      });
      const node = await createNode.mutateAsync({
        partId:   part.id,
        quantity: payload.qty,
        unit:     payload.uom,
        status:   toNodeStatus(payload.status),
        ownerId:  payload.ownerId ?? null,
      });
      // Upload any documents attached in the form
      await saveBomDocs(node.id, payload);
      // Link any requirements added in the Traceability tab
      await Promise.all(payload.req.map(requirementId => addRequirement.mutateAsync({ nodeId: node.id, requirementId })));
      toast.success('Part added to BOM');
      if (onAddClose) onAddClose();
    } catch (err) {
      toast.error('Failed to add part', {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err; // re-throw so the dialog stays open and the user can retry
    }
  };

  // ── Add Sub-component handler (from the list view "+" action) ──────
  const handleAddSubcomponent = async (payload: BOMPartPayload) => {
    if (!createSubNode) return;
    try {
      const part = await createPart.mutateAsync({
        partNumber:          payload.pn,
        name:                payload.name,
        description:         payload.desc,
        category:            payload.category,
        manufacturer:        payload.manufacturer || undefined,
        distributor:         payload.distributor  || undefined,
        mpn:                 payload.mpn          || undefined,
        unit:                payload.uom,
        initialStatus:       payload.status,
        initialRev:          payload.rev,
        initialPrice:        payload.price > 0 ? payload.price : undefined,
        initialLeadTimeDays: payload.leadTime > 0 ? payload.leadTime : undefined,
        initialSuppliers:    payload.suppliers?.length ? payload.suppliers : undefined,
      });
      const node = await createNode.mutateAsync({
        partId:   part.id,
        quantity: payload.qty,
        unit:     payload.uom,
        status:   toNodeStatus(payload.status),
        parentId: createSubNode.id,
        ownerId:  payload.ownerId ?? null,
      });
      await saveBomDocs(node.id, payload);
      await Promise.all(payload.req.map(requirementId => addRequirement.mutateAsync({ nodeId: node.id, requirementId })));
      setCreateSubNode(null);
    } catch {
      // errors are logged by React Query's MutationCache; no further action needed
    }
  };

  const handleExportCsv = async () => {
    try {
      const blob = await bomService.exportCsv(projectId);
      downloadBomCsv(blob, projectId);
      toast.success('BOM exported as CSV');
    } catch (err) {
      toast.error('Failed to export BOM', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleExportExcel = async () => {
    try {
      const blob = await bomService.exportCsv(projectId);
      const text = await blob.text();
      const rows = text.split('\n').slice(1).map(line => {
        const cells = line.split(',').map(cell => cell.replace(/^"|"$/g, ''));
        return {
          partNumber: cells[0],
          description: cells[1],
          category: cells[2],
          quantity: parseFloat(cells[3]) || 0,
          unit: cells[4],
          status: cells[5],
          manufacturer: cells[6] || null,
          distributor: cells[7] || null,
          mpn: cells[8] || null,
          price: parseFloat(cells[9]) || null,
          leadTime: parseFloat(cells[10]) || null,
          revision: cells[11],
          owner: cells[12],
          level: cells[13],
          requirements: cells[14],
        };
      }).filter(row => row.partNumber);

      const workbook = await createBomWorkbook(rows);
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `bom-${projectId}-${dateStr}.xlsx`;
      await downloadExcelFile(workbook, filename);
      toast.success('BOM exported as Excel');
    } catch (err) {
      toast.error('Failed to export BOM', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const facets = useMemo(() => ({
    units: [...new Set(allNodes.map(n => n.uom))].sort(),
    manufacturers: [...new Set(allNodes.map(n => n.manufacturer))].sort(),
    suppliers: [...new Set(allNodes.map(n => n.distributor))].sort(),
    owners: [...new Set(allNodes.map(n => n.owner))].sort(),
  }), [allNodes]);

  const activeCount =
    (filters.bomType !== 'all' ? 1 : 0) + filters.statuses.length + filters.units.length +
    filters.manufacturers.length + filters.suppliers.length + filters.owners.length +
    (filters.priceMin || filters.priceMax ? 1 : 0) +
    (filters.leadMin || filters.leadMax ? 1 : 0) +
    (filters.mpn ? 1 : 0);

  const pred = useCallback((row: BOMNode) => {
    const q = search.toLowerCase();
    if (q && !(row.pn.toLowerCase().includes(q) || row.name.toLowerCase().includes(q) || row.desc.toLowerCase().includes(q) ||
      row.manufacturer.toLowerCase().includes(q) || row.mpn.toLowerCase().includes(q))) return false;
    if (filterStatus !== 'all' && row.status !== filterStatus) return false;
    if (filters.statuses.length && !filters.statuses.includes(row.status)) return false;
    if (filters.units.length && !filters.units.includes(row.uom)) return false;
    if (filters.manufacturers.length && !filters.manufacturers.includes(row.manufacturer)) return false;
    if (filters.suppliers.length && !filters.suppliers.includes(row.distributor)) return false;
    if (filters.owners.length && !filters.owners.includes(row.owner)) return false;
    if (filters.bomType !== 'all' && bomTypeOf(row) !== filters.bomType) return false;
    if (filters.mpn && !row.mpn.toLowerCase().includes(filters.mpn.toLowerCase())) return false;
    const pMin = parseFloat(filters.priceMin), pMax = parseFloat(filters.priceMax);
    if (!isNaN(pMin) && row.price < pMin) return false;
    if (!isNaN(pMax) && row.price > pMax) return false;
    const lMin = parseFloat(filters.leadMin), lMax = parseFloat(filters.leadMax);
    if (!isNaN(lMin) && row.leadTime < lMin) return false;
    if (!isNaN(lMax) && row.leadTime > lMax) return false;
    return true;
  }, [search, filterStatus, filters]);

  const filtersActive = !!search || filterStatus !== 'all' || activeCount > 0;

  const listRows = useMemo(() => {
    if (!filtersActive) return bomFlatten(rootNodes, expanded);
    const { matched, include } = bomFilterTree(rootNodes, pred);
    return bomFlattenInclude(rootNodes, matched, include);
  }, [filtersActive, expanded, pred, rootNodes]);

  const gridRows = useMemo(() => allNodes.filter(pred), [allNodes, pred]);

  const totalCount    = bomTree?.totalNodes    ?? allNodes.length;
  const approvedCount = bomTree?.approvedCount ?? allNodes.filter(n => n.status === 'approved').length;
  const pendingCount  = bomTree?.pendingCount  ?? allNodes.filter(n => n.status === 'pending').length;
  const totalCost     = useMemo(() => rootNodes.reduce((s, n) => s + n.price * n.qty, 0), [rootNodes]);

  if (treeLoading) return <BOMViewSkeleton />;

  // Detail view
  if (selected || fallbackPartId || fallbackPn) {
    // The node/part id we were sent (e.g. from an ECO's "Affected Parts" list)
    // can point at a soft-deleted BOM row if the part was removed/re-added
    // since the reference was captured — those ids stay resolvable server-side
    // (the row still exists, just deleted) but never appear in the live tree.
    // Part number is the one thing guaranteed unique among *live* parts, so it
    // is the most reliable fallback once the id-based lookups come up empty.
    const node = (selected && bomFind(selected, rootNodes))
      || (fallbackPartId ? allNodes.find(n => n._partId === fallbackPartId) ?? null : null)
      || (fallbackPn ? allNodes.find(n => n.pn === fallbackPn) ?? null : null);
    if (node) return (
      <BOMDetailScreen
        node={node}
        rootNodes={rootNodes}
        orgId={orgId}
        projectId={projectId}
        onBack={() => setSelected(null)}
        onNavigate={setSelected}
        onEcoCreated={onEcoCreated}
      />
    );
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-center px-4">
        <p className="text-sm text-muted-foreground">This part could not be found in the BOM.</p>
        <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
          Back to BOM
        </Button>
      </div>
    );
  }

  const Tab = ({ id, label }: { id: 'all' | 'approved' | 'pending' | 'rejected'; label: string }) => (
    <button
      onClick={() => setFilterStatus(id)}
      className={cn(
        'px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer border transition-colors',
        filterStatus === id
          ? 'bg-primary/10 text-primary border-primary/25'
          : 'text-muted-foreground border-transparent hover:text-foreground'
      )}
    >
      {label}
    </button>
  );

  const ViewBtn = ({ id, icon: Icon, label }: { id: ViewMode; icon: React.ElementType; label: string }) => {
    const active = view === id;
    return (
      <button
        onClick={() => handleView(id)}
        title={`${label} view`}
        className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border-none cursor-pointer transition-colors',
          active ? 'bg-card text-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground')}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full px-6 overflow-hidden bg-background" style={{ height: 'calc(100vh - 140px)' }}>
      {/* ── Fixed header zone (no scroll) ─────────────────────────── */}
      <div className="shrink-0 py-4">
        {/* Stat cards */}
        <div className="flex gap-2.5 md:gap-3 flex-wrap mb-4">
          <StatCard label="Total Parts" value={String(totalCount)} icon={Layers} iconColor="#2563EB" accent />
          <StatCard label="Approved" value={String(approvedCount)} icon={CheckCircle} iconColor="#16A34A" />
          <StatCard label="Pending Review" value={String(pendingCount)} icon={Clock} iconColor="#D97706" />
          <StatCard label="Total BOM Cost" value={formatCurrency(totalCost)} icon={DollarSign} iconColor="#9333EA" />
        </div>

        {/* Toolbar — desktop/tablet */}
        <div className="hidden md:flex items-center gap-2.5 pb-0">
          <div className="flex items-center gap-2 bg-muted border border-border rounded-md px-2.5 py-1.5 w-72">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search parts, MPN, manufacturer…"
              className="bg-transparent border-none outline-none text-foreground text-sm w-full placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-foreground/70 hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Tab id="all" label="All" />
          <Tab id="approved" label="Approved" />
          <Tab id="pending" label="Pending" />
          <Tab id="rejected" label="Rejected" />

          <div className="flex-1" />

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border bg-card text-foreground border-border hover:bg-muted cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCsv}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel}>
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter button */}
          <button
            onClick={() => setFilterOpen(true)}
            className={cn('inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border cursor-pointer transition-colors',
              activeCount ? 'bg-primary/10 text-primary border-primary/30' : 'bg-card text-foreground border-border hover:bg-muted'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
            {activeCount > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-foreground text-background">
                {activeCount}
              </span>
            )}
          </button>

          <div className="w-px h-5 bg-border" />

          {/* View toggle */}
          <div className="flex bg-muted border border-border rounded-lg p-0.5 gap-0.5">
            <ViewBtn id="list" icon={List} label="List" />
            <ViewBtn id="grid" icon={LayoutGrid} label="Grid" />
            <ViewBtn id="map" icon={Share2} label="Map" />
          </div>
        </div>{/* end desktop toolbar */}

        {/* Toolbar — mobile only */}
        <div className="flex md:hidden items-center gap-2 pb-0">
          {mobileSearchOpen ? (
            <div className="flex items-center gap-2 bg-muted border border-border rounded-md px-2.5 py-1.5 flex-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search parts…"
                className="bg-transparent border-none outline-none text-foreground text-sm w-full placeholder:text-muted-foreground"
              />
              <button
                onClick={() => { setSearch(''); setMobileSearchOpen(false); }}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setMobileSearchOpen(true)}
                title="Search"
                className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors shrink-0"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Status dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border bg-card text-foreground border-border hover:bg-muted cursor-pointer transition-colors">
                    {filterStatus === 'all' ? 'All' : filterStatus === 'approved' ? 'Approved' : filterStatus === 'pending' ? 'Pending' : 'Rejected'}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setFilterStatus('all')}>All</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus('approved')}>Approved</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus('pending')}>Pending</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus('rejected')}>Rejected</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex-1" />

              {/* Export */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    title="Export"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md border bg-card text-foreground border-border hover:bg-muted cursor-pointer transition-colors shrink-0"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCsv}>Export as CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcel}>Export as Excel</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filter */}
              <button
                onClick={() => setFilterOpen(true)}
                title="Filter"
                className={cn('relative inline-flex items-center justify-center w-8 h-8 rounded-md border cursor-pointer transition-colors shrink-0',
                  activeCount ? 'bg-primary/10 text-primary border-primary/30' : 'bg-card text-foreground border-border hover:bg-muted'
                )}
              >
                <Filter className="w-4 h-4" />
                {activeCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-foreground text-background">
                    {activeCount}
                  </span>
                )}
              </button>

              {/* View */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    title="View"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md border bg-card text-foreground border-border hover:bg-muted cursor-pointer transition-colors shrink-0"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleView('list')}>List</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleView('grid')}>Grid</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleView('map')}>Map</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Add Part — lives next to the search/toolbar row on mobile
                  instead of the tab strip above, to match the other sections. */}
              <button
                onClick={() => setAddChoiceOpen(true)}
                title="Add Part"
                aria-label="Add Part"
                className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-foreground text-background hover:opacity-90 cursor-pointer transition-opacity shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </>
          )}
        </div>{/* end mobile toolbar */}
      </div>{/* end header zone */}

      {/* ── Scrollable content (fills remaining height) ────────────── */}
      {view === 'list' && (
        <>
          <ListView
            rows={listRows}
            expanded={expanded}
            toggle={toggle}
            filtersActive={filtersActive}
            onOpen={setSelected}
            onAddSub={setAddSubNode}
            onDeleteRequest={setDeleteTarget}
            totalCount={totalCount}
            formatCurrency={formatCurrency}
            canDecideRow={canDecideRow}
            onApprove={handleApprove}
            onReject={setRejectTarget}
            approvingId={decideApprovalRequest.isPending ? decideApprovalRequest.variables?.nodeId ?? null : null}
          />
          <MobileListView
            rows={listRows}
            expanded={expanded}
            toggle={toggle}
            filtersActive={filtersActive}
            onOpen={setSelected}
            totalCount={totalCount}
          />
        </>
      )}
      {view === 'grid' && (
        <GridView rows={gridRows} rootNodes={rootNodes} filtersActive={filtersActive} onOpen={setSelected} totalCount={totalCount} formatCurrency={formatCurrency} />
      )}
      {view === 'map' && (
        <BOMMapView nodes={rootNodes} onOpen={setSelected} pred={pred} filtersActive={filtersActive} />
      )}
      <FilterDrawer
        open={filterOpen} filters={filters} setFilters={setFilters}
        onClose={() => setFilterOpen(false)} facets={facets}
        currencySymbol={currencySymbol}
      />

      {/* Add Part — choice dialog */}
      <Dialog open={addChoiceOpen} onOpenChange={v => { if (!v) { setAddChoiceOpen(false); onAddClose?.(); } }}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <DialogTitle className="text-base font-semibold">Add Part</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Choose how you'd like to add a top-level part to the BOM.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 px-4 py-4">
            <button
              onClick={() => { setAddChoiceOpen(false); setAddManualOpen(true); }}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-foreground/20 transition-colors text-left group"
            >
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                <PenLine className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">Add Manually</div>
                <div className="text-xs text-muted-foreground mt-0.5">Create one new part using the part details form.</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </button>
            <button
              onClick={() => { setAddChoiceOpen(false); setAddImportOpen(true); }}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-foreground/20 transition-colors text-left group"
            >
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-600">
                <FileSpreadsheet className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">Import from Excel</div>
                <div className="text-xs text-muted-foreground mt-0.5">Bulk-add multiple parts at once from a spreadsheet.</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </button>
          </div>
          <div className="px-4 pb-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { setAddChoiceOpen(false); onAddClose?.(); }}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Part sheet — manual */}
      <BOMPartSheet
        mode="add"
        projectId={projectId}
        orgId={orgId}
        open={addManualOpen}
        onClose={() => { setAddManualOpen(false); onAddClose?.(); }}
        onSave={handleAddPart}
      />

      {/* Add Part — import from Excel (top-level, no parent) */}
      {addImportOpen && (
        <BOMImportSubcomponentsDialog
          open={addImportOpen}
          onClose={() => { setAddImportOpen(false); onAddClose?.(); }}
          projectId={projectId}
          orgId={orgId}
        />
      )}

      {/* Add Sub-component dialog (from list row "+" action) */}
      {addSubNode && (
        <AddSubcomponentDialog
          open={!!addSubNode}
          onClose={() => setAddSubNode(null)}
          parentNode={addSubNode}
          onCreateNew={() => { setCreateSubNode(addSubNode); setAddSubNode(null); }}
          onImportExcel={() => { setImportSubNode(addSubNode); setAddSubNode(null); }}
        />
      )}

      {/* Create New Sub-component sheet */}
      {createSubNode && (
        <BOMPartSheet
          mode="add"
          projectId={projectId}
          orgId={orgId}
          open={!!createSubNode}
          onClose={() => setCreateSubNode(null)}
          onSave={handleAddSubcomponent}
        />
      )}

      {/* Import Sub-components from Excel */}
      {importSubNode && (
        <BOMImportSubcomponentsDialog
          open={!!importSubNode}
          onClose={() => setImportSubNode(null)}
          parentNode={importSubNode}
          projectId={projectId}
          orgId={orgId}
        />
      )}

      {/* Reject confirmation (mandatory reason) */}
      <BOMRejectDialog
        open={!!rejectTarget}
        partLabel={rejectTarget?.pn}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleRejectConfirm}
      />

      {/* Delete confirmation (warns about cascading sub-component deletion) */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        variant="destructive"
        confirmText={deleteTarget && bomFlatAll(deleteTarget.children ?? []).length > 0 ? 'Delete All' : 'Delete Part'}
        {...(deleteTarget ? describeDeleteImpact(deleteTarget) : { title: '', description: '' })}
      />
    </div>
  );
}
