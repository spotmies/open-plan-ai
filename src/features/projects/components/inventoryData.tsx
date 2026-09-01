// Inventory (stock) types and pure helpers.
//
// Stock/orders/transactions/builds are persisted via the real backend — see
// src/services/inventory.service.ts and src/hooks/useInventory.ts. This file holds only
// backend-agnostic types, coverage/netting math (computeCoverage, availableOf, onOrderOf,
// buildFromDef), and display components (LocationCombobox, CategoryCombobox, CoveragePill,
// CoverageBar) that both real and (formerly) mock data flowed through unchanged.

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KNOWN_BOM_CATEGORIES, UOM_OPTIONS, type BOMCategory } from './bomData';

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
  leadTimeDays: number;
  lotNumber?: string;
  serialNumber?: string;
  quarantineQty?: number;
  imageUrl?: string;   // part photo, when the catalog entry has one — falls back to a category icon
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
  note?: string;
  description?: string;
  purpose?: string;
  lotNumber?: string;
  serialNumber?: string;
  status: 'planned' | 'open' | 'partially_received' | 'received' | 'cancelled';
  createdAt: string;
  createdBy: string;
}

const CUSTOM_LOCATION_SENTINEL = '__custom_location__';

/** Location picker: preset dropdown with a "custom" escape hatch — same pattern as
 * BOMCategory's free-text + preset-list combo (bomData.ts). `knownLocations` (from
 * useLocations) is merged in alongside the hardcoded presets, so a custom location
 * saved once (the backend auto-registers it on receive/adjust/order) shows up as a
 * preset the next time this picker opens instead of only ever living on that one
 * transaction. */
export function LocationCombobox({ value, onChange, placeholder = 'Select a location...', knownLocations = [] }: {
  value: string; onChange: (v: string) => void; placeholder?: string; knownLocations?: string[];
}) {
  const options = [
    ...STOCK_LOCATIONS,
    ...knownLocations.filter((loc) => !(STOCK_LOCATIONS as readonly string[]).includes(loc)).sort(),
  ];

  const [customMode, setCustomMode] = useState(
    () => value !== '' && !options.includes(value)
  );

  useEffect(() => {
    if (value === '') setCustomMode(false);
  }, [value]);

  if (customMode) {
    return (
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter custom location..."
          autoFocus
        />
        <Button type="button" variant="outline" size="sm" onClick={() => { setCustomMode(false); onChange(''); }}>
          Presets
        </Button>
      </div>
    );
  }

  return (
    <Select
      onValueChange={(v) => {
        if (v === CUSTOM_LOCATION_SENTINEL) {
          // Deferred a tick: swapping to the custom Input unmounts this Select's own DOM
          // node, which — done synchronously inside its own onValueChange — races Radix's
          // internal close/focus-restore for that same click and gets silently discarded
          // (the dropdown just closes with nothing changed). Letting that finish first
          // before we swap avoids the race.
          setTimeout(() => { setCustomMode(true); onChange(''); }, 0);
        } else {
          onChange(v);
        }
      }}
      value={value}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((loc) => (
          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
        ))}
        <SelectItem value={CUSTOM_LOCATION_SENTINEL}>Other (custom)…</SelectItem>
      </SelectContent>
    </Select>
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
      location: '', leadTimeDays: r.leadTimeDays,
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

