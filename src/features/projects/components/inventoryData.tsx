// Inventory (stock) types and pure helpers.
//
// Stock/orders/transactions/builds are persisted via the real backend — see
// src/services/inventory.service.ts and src/hooks/useInventory.ts. This file holds only
// backend-agnostic types, coverage/netting math (computeCoverage, availableOf, onOrderOf,
// buildFromDef), and display components (LocationCombobox, CategoryCombobox, CoveragePill,
// CoverageBar) that both real and (formerly) mock data flowed through unchanged.

import { useState, useEffect, useMemo } from 'react';
import { Lock, Plus, Check, X as XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KNOWN_BOM_CATEGORIES, UOM_OPTIONS, type BOMCategory } from './bomData';
import { useLocations, useCreateLocation, groupLocationsByParent, type ApiLocation, type LocationKind } from '@/hooks/useLocations';

export const STOCK_LOCATIONS = ['Lab Shelf A', 'Lab Shelf B', 'Incoming Dock', 'CM', 'Quarantine'] as const;
// Locations are free-text (mirrors the BOMCategory custom-category pattern) — the presets
// above are just suggestions surfaced in pickers, not a closed set the hardware team is
// still deciding per-part-type constraints for.
export type StockLocation = string;

export type CoverageStatus = 'ready' | 'covered-by-order' | 'short' | 'conflict';

export interface StockRecord {
  id: string;
  partId: string;   // links to ApiPartResponse.id in the real Parts catalog
  pn: string;
  name: string;
  mpn?: string;
  manufacturer?: string;
  cat: BOMCategory;
  onHand: number;
  allocated: number;
  onOrder: number;
  location: StockLocation;
  locationNodeId?: string;
  leadTimeDays: number;
  lotNumber?: string;
  serialNumber?: string;
  quarantineQty?: number;
  imageUrl?: string;   // part photo, when the catalog entry has one — falls back to a category icon
  createdAt: string;   // ISO — when this (part, location) stock row was first created; earliest row = the part's canonical location
}

export interface OrderRecord {
  id: string;
  partId: string;
  pn: string;
  quantity: number;
  remainingQty: number;
  expectedDate: string;   // ISO
  leadTimeDays?: number;
  supplierRef?: string;
  unitCost?: number;
  location: string;
  locationNodeId?: string;
  note?: string;
  description?: string;
  purpose?: string;
  lotNumber?: string;
  serialNumber?: string;
  status: 'planned' | 'open' | 'partially_received' | 'received' | 'cancelled';
  createdAt: string;
  createdBy: string;
}


/** Read-only Location field for Receive / Place order. A part's stock location is pinned
 * to its canonical (first-ever) location — the backend enforces this too — so these flows
 * show it locked rather than as an editable picker. Use Transfer to move a part elsewhere. */
export function LockedLocationField({ location }: { location: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm">
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{location}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Pinned to this part&apos;s stock location — use Transfer to move it elsewhere.
      </p>
    </div>
  );
}

const LEVEL_LABEL: Record<LocationKind, string> = { warehouse: 'Warehouse', shelf: 'Shelf', box: 'Box' };
const NEW_SENTINEL = '__new__';

/** One cascading tier (Warehouse, Shelf, or Box) — a plain Select plus an
 * inline "+ New <kind>" create affordance, so the hierarchy can be built up
 * on the fly while picking rather than needing a separate management screen
 * first. Selecting a level clears any deeper selection the caller is
 * holding (handled by the parent, LocationHierarchyPicker). */
function LocationLevelSelect({ kind, options, selectedId, onSelect, onCreate, creating, disabled }: {
  kind: LocationKind; options: ApiLocation[]; selectedId: string | null;
  onSelect: (id: string) => void; onCreate: (name: string) => void; creating: boolean; disabled?: boolean;
}) {
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');

  if (addingNew) {
    return (
      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`New ${LEVEL_LABEL[kind].toLowerCase()} name...`} autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) { onCreate(newName.trim()); setAddingNew(false); setNewName(''); } }} />
        <Button type="button" variant="outline" size="icon" disabled={!newName.trim() || creating}
          onClick={() => { onCreate(newName.trim()); setAddingNew(false); setNewName(''); }}>
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => { setAddingNew(false); setNewName(''); }}>
          <XIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Select
      disabled={disabled}
      value={selectedId ?? ''}
      onValueChange={(v) => {
        if (v === NEW_SENTINEL) setTimeout(() => setAddingNew(true), 0);
        else onSelect(v);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={disabled ? `Pick a ${LEVEL_LABEL[kind].toLowerCase()} above first` : `${LEVEL_LABEL[kind]}...`} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
        <SelectItem value={NEW_SENTINEL}><span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" />New {LEVEL_LABEL[kind].toLowerCase()}...</span></SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Real Warehouse -> Shelf -> Box picker, replacing the old flat
 * LocationCombobox. `value`/`onChange` stay the same shape (the resolved
 * path text) so every existing call site's own form state needs no change —
 * only the picker itself and the final submit handler (which resolves the
 * matching node's id from `locations` for the mutation payload) changed. A
 * selection commits at whichever level the user stops drilling into —
 * picking just a warehouse is as valid as going all the way to a box. */
export function LocationHierarchyPicker({ value, onChange, orgId, placeholder = 'Select a location...' }: {
  value: string; onChange: (v: string) => void; orgId: string; placeholder?: string;
}) {
  const { data: locations = [] } = useLocations(orgId);
  const createLocation = useCreateLocation(orgId);
  const byId = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);
  const byParent = useMemo(() => groupLocationsByParent(locations), [locations]);

  // Free-text fallback for a value that doesn't match any real node yet
  // (legacy data, or a path typed before the hierarchy existed) — shown
  // read-only-ish via the warehouse level's own custom-entry escape hatch
  // below, so nothing already-stored is ever silently blanked out.
  const matchedNode = useMemo(() => locations.find((l) => l.path === value) ?? null, [locations, value]);

  const [selection, setSelection] = useState<{ warehouseId: string | null; shelfId: string | null; boxId: string | null }>(
    { warehouseId: null, shelfId: null, boxId: null },
  );

  // Re-sync internal selection whenever the external value resolves to a
  // different (or newly-loaded) real node — e.g. opening the dialog for a
  // part that already has a canonical location once `locations` has loaded.
  useEffect(() => {
    if (!matchedNode) return;
    if (matchedNode.kind === 'warehouse' && selection.warehouseId === matchedNode.id) return;
    if (matchedNode.kind === 'shelf' && selection.shelfId === matchedNode.id) return;
    if (matchedNode.kind === 'box' && selection.boxId === matchedNode.id) return;

    if (matchedNode.kind === 'warehouse') {
      setSelection({ warehouseId: matchedNode.id, shelfId: null, boxId: null });
    } else if (matchedNode.kind === 'shelf') {
      setSelection({ warehouseId: matchedNode.parentId, shelfId: matchedNode.id, boxId: null });
    } else {
      const shelf = matchedNode.parentId ? byId.get(matchedNode.parentId) : undefined;
      setSelection({ warehouseId: shelf?.parentId ?? null, shelfId: matchedNode.parentId, boxId: matchedNode.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedNode]);

  const commit = (next: typeof selection) => {
    setSelection(next);
    const node = next.boxId ? byId.get(next.boxId) : next.shelfId ? byId.get(next.shelfId) : next.warehouseId ? byId.get(next.warehouseId) : null;
    onChange(node?.path ?? '');
  };

  const warehouses = byParent.get('') ?? [];
  const shelves = selection.warehouseId ? (byParent.get(selection.warehouseId) ?? []) : [];
  const boxes = selection.shelfId ? (byParent.get(selection.shelfId) ?? []) : [];

  const createAt = (kind: LocationKind, parentId: string | null, name: string) => {
    createLocation.mutate({ name, parentId, kind }, {
      onSuccess: (created) => {
        if (kind === 'warehouse') commit({ warehouseId: created.id, shelfId: null, boxId: null });
        else if (kind === 'shelf') commit({ warehouseId: selection.warehouseId, shelfId: created.id, boxId: null });
        else commit({ warehouseId: selection.warehouseId, shelfId: selection.shelfId, boxId: created.id });
      },
    });
  };

  return (
    <div className="space-y-2">
      {!matchedNode && value && (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-input bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="truncate">Currently: {value} (not in the hierarchy yet — pick or create a real location below)</span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <LocationLevelSelect kind="warehouse" options={warehouses} selectedId={selection.warehouseId} creating={createLocation.isPending}
          onSelect={(id) => commit({ warehouseId: id, shelfId: null, boxId: null })}
          onCreate={(name) => createAt('warehouse', null, name)} />
        <LocationLevelSelect kind="shelf" options={shelves} selectedId={selection.shelfId} disabled={!selection.warehouseId} creating={createLocation.isPending}
          onSelect={(id) => commit({ ...selection, shelfId: id, boxId: null })}
          onCreate={(name) => createAt('shelf', selection.warehouseId, name)} />
        <LocationLevelSelect kind="box" options={boxes} selectedId={selection.boxId} disabled={!selection.shelfId} creating={createLocation.isPending}
          onSelect={(id) => commit({ ...selection, boxId: id })}
          onCreate={(name) => createAt('box', selection.shelfId, name)} />
      </div>
      {!warehouses.length && !value && (
        <p className="text-xs text-muted-foreground">{placeholder} No locations yet — use &quot;New warehouse…&quot; to create the first one.</p>
      )}
    </div>
  );
}

const CUSTOM_CATEGORY_SENTINEL = '__custom_category__';

function formatCategoryOptionLabel(category: string): string {
  return category
    .trim()
    .split(/[_-]+|\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Category picker for new-part creation: preset dropdown (the 7 known BOM categories, plus
 * any custom categories already in use — passed in via `extraCategories`) with a custom escape
 * hatch, so a category typed here shows up as a real filter later instead of being silently
 * limited to the fixed preset list. */
export function CategoryCombobox({ value, onChange, placeholder = 'Select a category...', extraCategories = [] }: {
  value: string; onChange: (v: string) => void; placeholder?: string; extraCategories?: string[];
}) {
  const options = useMemo(() => {
    const extra = Array.from(new Set(extraCategories)).filter(
      cat => !(KNOWN_BOM_CATEGORIES as readonly string[]).includes(cat)
    );
    return [...KNOWN_BOM_CATEGORIES, ...extra];
  }, [extraCategories]);

  const [customMode, setCustomMode] = useState(
    () => value !== '' && !options.includes(value)
  );
  const [customValue, setCustomValue] = useState(
    () => (value !== '' && !options.includes(value) ? value : '')
  );

  useEffect(() => {
    if (value === '') {
      setCustomMode(false);
      setCustomValue('');
      return;
    }

    if (!options.includes(value)) {
      setCustomMode(true);
      setCustomValue(value);
    }
  }, [value, options]);

  if (customMode) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={customValue}
            onChange={(e) => {
              const nextValue = e.target.value;
              setCustomValue(nextValue);
              onChange(nextValue);
            }}
            placeholder="Enter custom category..."
            autoFocus
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCustomMode(false);
              setCustomValue('');
              onChange('');
            }}
          >
            Presets
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Custom categories will also appear in the inventory category chips.
        </p>
      </div>
    );
  }

  return (
    <Select
      onValueChange={(v) => {
        if (v === CUSTOM_CATEGORY_SENTINEL) {
          // See LocationCombobox's identical deferral above — swapping to the custom
          // Input unmounts this Select from inside its own onValueChange, which races
          // Radix's close/focus-restore and silently gets discarded if done synchronously.
          setTimeout(() => {
            setCustomMode(true);
            setCustomValue('');
            onChange('');
          }, 0);
        } else {
          onChange(v);
        }
      }}
      value={options.includes(value) ? value : ''}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((c) => (
          <SelectItem key={c} value={c}>{formatCategoryOptionLabel(c)}</SelectItem>
        ))}
        <SelectItem value={CUSTOM_CATEGORY_SENTINEL}>Other (custom)…</SelectItem>
      </SelectContent>
    </Select>
  );
}

const CUSTOM_UNIT_SENTINEL = '__custom_unit__';

/** Unit-of-measure picker for new-part creation: preset dropdown (UOM_OPTIONS from bomData.ts —
 * the same list BOMPartSheet's UOM toggle buttons use) with a custom escape hatch, so a unit
 * typed here isn't limited to the fixed preset list. */
export function UnitCombobox({ value, onChange, placeholder = 'Select a unit...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const options = UOM_OPTIONS as readonly string[];

  const [customMode, setCustomMode] = useState(
    () => value !== '' && !options.includes(value)
  );
  const [customValue, setCustomValue] = useState(
    () => (value !== '' && !options.includes(value) ? value : '')
  );

  useEffect(() => {
    if (value === '') {
      setCustomMode(false);
      setCustomValue('');
      return;
    }

    if (!options.includes(value)) {
      setCustomMode(true);
      setCustomValue(value);
    }
  }, [value, options]);

  if (customMode) {
    return (
      <div className="flex gap-2">
        <Input
          value={customValue}
          onChange={(e) => {
            const nextValue = e.target.value;
            setCustomValue(nextValue);
            onChange(nextValue);
          }}
          placeholder="Enter custom unit..."
          autoFocus
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setCustomMode(false);
            setCustomValue('');
            onChange('');
          }}
        >
          Presets
        </Button>
      </div>
    );
  }

  return (
    <Select
      onValueChange={(v) => {
        if (v === CUSTOM_UNIT_SENTINEL) {
          // Deferred a tick — see LocationCombobox/CategoryCombobox's identical comment above.
          setTimeout(() => {
            setCustomMode(true);
            setCustomValue('');
            onChange('');
          }, 0);
        } else {
          onChange(v);
        }
      }}
      value={options.includes(value) ? value : ''}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((u) => (
          <SelectItem key={u} value={u}>{u}</SelectItem>
        ))}
        <SelectItem value={CUSTOM_UNIT_SENTINEL}>Custom...</SelectItem>
      </SelectContent>
    </Select>
  );
}

export interface StockTransaction {
  id: string;
  partId: string;
  type: 'receive' | 'adjust' | 'allocate' | 'deallocate' | 'issue' | 'transfer';
  direction?: 'add' | 'remove';   // adjust/issue only
  qty: number;
  location: StockLocation;
  locationNodeId?: string;         // real Warehouse/Shelf/Box node, when this row resolves to one
  reference?: string;              // receive: PO / expected-receipt reference. transfer: destination location.
  reasonCode?: string;             // adjust/issue only
  note?: string;
  description?: string;            // adjust only
  quarantine?: boolean;            // receive only
  buildId?: string;                // allocate/deallocate/issue only
  lotNumber?: string;               // receive/adjust only
  serialNumber?: string;            // receive/adjust only
  leadTimeDays?: number;            // adjust only; user-entered lead time from New transaction
  createdAt: string;
  createdBy: string;
}

export const REASON_CODES = [
  'Cycle count correction',
  'Damaged / scrap',
  'Found stock',
  'Data entry error',
  'Returned to supplier',
  'Consumed outside system',
] as const;

export const availableOf = (r: StockRecord): number => r.onHand - r.allocated - (r.quarantineQty ?? 0);

/** Sum of remaining qty across a part's open/partially-received orders — `onOrder` is
 * derived from real order state rather than a static seeded field. */
export function onOrderOf(orders: OrderRecord[], partId: string): number {
  return orders
    .filter(o => o.partId === partId && (o.status === 'open' || o.status === 'partially_received'))
    .reduce((sum, o) => sum + o.remainingQty, 0);
}

/**
 * demandQty is the BOM quantity-required for this part (from BOMNode.qty). Coverage is
 * "conflict" when more is allocated than on-hand (over-committed), "ready" when available
 * stock alone meets demand, "covered-by-order" when incoming on-order stock closes the gap,
 * else "short".
 */
export function computeCoverage(record: StockRecord, demandQty: number): CoverageStatus {
  const available = availableOf(record);
  if (available < 0) return 'conflict';
  if (available >= demandQty) return 'ready';
  if (available + record.onOrder >= demandQty) return 'covered-by-order';
  return 'short';
}

export const COVERAGE_META: Record<CoverageStatus, { label: string; bg: string; fg: string; border: string }> = {
  ready:              { label: 'Ready',            bg: 'rgba(34,197,94,0.1)',  fg: '#16A34A', border: 'rgba(34,197,94,0.2)' },
  'covered-by-order': { label: 'Covered by order', bg: 'rgba(245,158,11,0.1)', fg: '#D97706', border: 'rgba(245,158,11,0.2)' },
  short:              { label: 'Short',             bg: 'rgba(220,38,38,0.1)', fg: '#DC2626', border: 'rgba(220,38,38,0.2)' },
  conflict:           { label: 'Conflict',          bg: 'rgba(220,38,38,0.1)', fg: '#DC2626', border: 'rgba(220,38,38,0.2)' },
};

export function CoveragePill({ status }: { status: CoverageStatus }) {
  const meta = COVERAGE_META[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ background: meta.bg, color: meta.fg, border: `1px solid ${meta.border}` }}
    >
      {meta.label}
    </span>
  );
}

/** Thin bar under the coverage pill — fill = remaining unallocated share of on-hand stock. */
export function CoverageBar({ status, record }: { status: CoverageStatus; record: StockRecord }) {
  const available = availableOf(record);
  if (available < 0) {
    const overRatio = Math.min(1, Math.abs(available) / Math.max(record.allocated, 1));
    return (
      <div className="flex h-1 w-full rounded-full overflow-hidden bg-muted mt-1.5">
        <div style={{ width: `${(1 - overRatio) * 100}%`, background: COVERAGE_META.conflict.fg }} />
        <div style={{ width: `${overRatio * 100}%`, background: COVERAGE_META['covered-by-order'].fg }} />
      </div>
    );
  }
  const pct = record.onHand > 0 ? Math.round((available / record.onHand) * 100) : 0;
  return (
    <div className="h-1 w-full rounded-full bg-muted overflow-hidden mt-1.5">
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: COVERAGE_META[status].fg }} />
    </div>
  );
}

// Deterministic pseudo-random spread seeded by part number, so seeded numbers stay stable
// across re-renders without needing a backend.
function seededRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

export interface BuildLine {
  partId: string;
  pn: string;
  name: string;
  cat: BOMCategory;
  imageUrl?: string;
  qtyPerUnit: number;
  uom: string;
  required: number;
  available: number;
  allocated: number;
  onOrder: number;
  leadTimeDays: number;
  status: CoverageStatus;
}

/** Basic user info for a build's assignee — mirrors the backend's inventory.types.ts shape. */
export interface BuildAssignee {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface Build {
  id: string;
  name: string;
  type: string;
  units: number;
  bomRev: string;
  scrapPct: number;
  linkedMilestone: string;
  targetDate: string;      // ISO
  projectedDate: string;   // ISO — target + longest-lead short line's lead time
  daysLate: number;        // 0 when clear to build
  lines: BuildLine[];
  readyCount: number;
  onOrderCount: number;
  shortLines: BuildLine[];
  longestLead: BuildLine | null;
  status: BuildStatus;
  assignee: BuildAssignee | null;
}

export type BuildStatus = 'planned' | 'allocated' | 'kitted';

export interface BuildDef {
  id: string;
  projectId: string;
  name: string;
  type: string;
  units: number;
  bomRev: string;
  scrapPct: number;
  milestone: string;
  /** User-entered target date (new builds). Legacy seeded builds omit this and fall back to
   * a synthetic lateness offset so their numbers stay stable across re-renders. */
  targetDate?: string;
  status: BuildStatus;
  assignee: BuildAssignee | null;
}

/** One row of a build's own project BOM, joined server-side with current org stock — see
 * inventory.service.ts `getBuildBomLines` (backend) / `useBuildBomLines` (frontend hook).
 * Replaces the old client-side `stock.map(...)` over the *entire org's* stock list, which
 * rendered one BOM-line row per org-wide inventory part instead of per part in this build's BOM. */
export interface BuildBomLine {
  partId: string;
  pn: string;
  name: string;
  cat: BOMCategory;
  imageUrl?: string;
  qtyPerUnit: number;
  uom: string;
  onHand: number;
  allocated: number;
  onOrder: number;
  leadTimeDays: number;
  required: number;
  shortage: number;
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function diffDays(laterIso: string, earlierIso: string): number {
  return Math.round((new Date(laterIso).getTime() - new Date(earlierIso).getTime()) / 86400000);
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

/**
 * Computes one "Build" from a def, scaling each BOM line's real demand (qty-per-unit, from
 * this build's own project BOM) by the def's unit count, then reusing computeCoverage against
 * the scaled requirement — so larger builds naturally show more shortages against the same
 * on-hand/on-order stock, same as a real MRP netting would.
 *
 * `bomLines` is scoped to this build's project BOM (one row per part actually used in it) —
 * NOT the org-wide stock list, so builds from different projects/BOMs never bleed into each
 * other's line tables.
 */
export function buildFromDef(def: BuildDef, bomLines: BuildBomLine[]): Build {
  const now = new Date();
  const lines: BuildLine[] = bomLines.map((r) => {
    const qtyPerUnit = r.qtyPerUnit || 1;
    const required = qtyPerUnit * def.units;
    const stockLike: StockRecord = {
      id: r.partId, partId: r.partId, pn: r.pn, name: r.name, cat: r.cat,
      onHand: r.onHand, allocated: r.allocated, onOrder: r.onOrder,
      location: '', leadTimeDays: r.leadTimeDays, createdAt: '',
    };
    const status = computeCoverage(stockLike, required);
    return {
      partId: r.partId, pn: r.pn, name: r.name, cat: r.cat, imageUrl: r.imageUrl,
      qtyPerUnit, uom: r.uom,
      required, available: availableOf(stockLike), allocated: r.allocated, onOrder: r.onOrder,
      leadTimeDays: r.leadTimeDays, status,
    };
  });

  const readyCount = lines.filter(l => l.status === 'ready').length;
  const onOrderCount = lines.filter(l => l.status === 'covered-by-order').length;
  const shortLines = lines.filter(l => l.status === 'short' || l.status === 'conflict');
  const longestLead = shortLines.length
    ? shortLines.reduce((max, l) => (l.leadTimeDays > (max?.leadTimeDays ?? 0) ? l : max), null as BuildLine | null)
    : null;

  const projectedDate = addDays(now, longestLead?.leadTimeDays ?? 0);

  let targetDate: string;
  let daysLate: number;
  if (def.targetDate) {
    targetDate = def.targetDate;
    daysLate = shortLines.length ? Math.max(0, diffDays(projectedDate, targetDate)) : 0;
  } else {
    daysLate = shortLines.length ? Math.round(30 + seededRandom(def.id) * 150) : 0;
    targetDate = addDays(new Date(projectedDate), -daysLate);
  }

  return {
    id: def.id, name: def.name, type: def.type, units: def.units,
    bomRev: def.bomRev, scrapPct: def.scrapPct, linkedMilestone: def.milestone,
    targetDate, projectedDate, daysLate,
    lines, readyCount, onOrderCount, shortLines, longestLead,
    status: def.status, assignee: def.assignee,
  };
}

