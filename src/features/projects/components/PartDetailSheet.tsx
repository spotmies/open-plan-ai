import { useMemo, useState } from 'react';
import {
  Download, ShoppingCart, Pencil, ArrowLeftRight, ClipboardCheck, MapPin, ChevronLeft, Clock,
  Zap, Cpu, Package, Box, Monitor, Shield, Layers, Tag, Unlock, ShieldAlert, type LucideIcon,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { TeamMember } from '@/types';
import { getCategoryMeta, formatLeadTime, type ApiPartResponse } from './bomData';
import {
  availableOf, CoveragePill, STOCK_LOCATIONS, formatShortDate,
  type StockRecord, type StockTransaction, type CoverageStatus, type OrderRecord,
} from './inventoryData';

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = { Zap, Cpu, Package, Box, Monitor, Shield, Layers, Tag };

const STAT_TOOLTIPS: Record<string, string> = {
  'On Hand': 'Physical quantity currently in stock, including anything held in quarantine.',
  'Allocated': 'Quantity already reserved against BOM demand for planned builds.',
  'Available': 'On Hand minus Allocated minus Quarantine — what can actually be used right now.',
  'On Order': 'Quantity remaining on open purchase orders, not yet received. Want-to-order items aren’t counted until marked ordered — see "planned" below.',
  'Quarantine': 'Held out of Available until released — pending inspection or testing.',
};

interface TransactionMeta {
  label: string;
  detail?: string;
  Icon: LucideIcon;
  color: string;
}

/** Describes a ledger row for the Movements tab — one case per `type` (plus the
 * quarantine-release `adjust` variant the backend logs via `reasonCode`), so every kind of
 * stock event (received, adjusted, allocated to a build, released from quarantine) gets its
 * own icon/color/label instead of falling through to a generic "Adjusted" bucket. */
function describeTransaction(t: StockTransaction): TransactionMeta {
  if (t.type === 'receive') {
    return {
      label: 'Received',
      detail: t.quarantine ? 'Held in quarantine' : t.reference,
      Icon: Download,
      color: '#16A34A',
    };
  }
  if (t.type === 'allocate') {
    return { label: 'Allocated', detail: t.note ?? t.description, Icon: ClipboardCheck, color: '#7C3AED' };
  }
  if (t.type === 'deallocate') {
    return { label: 'Deallocated', detail: t.note ?? t.description, Icon: ClipboardCheck, color: '#64748B' };
  }
  if (t.type === 'issue') {
    return { label: 'Issued', detail: t.reasonCode ?? t.note ?? t.description, Icon: ArrowLeftRight, color: '#DC2626' };
  }
  if (t.type === 'transfer') {
    return { label: 'Transferred', detail: t.reference ? `To ${t.reference}` : t.note, Icon: ArrowLeftRight, color: '#2563EB' };
  }
  // adjust
  if (t.reasonCode === 'Released from quarantine') {
    return { label: 'Released from quarantine', detail: t.note, Icon: Unlock, color: '#0EA5E9' };
  }
  const adding = t.direction === 'add';
  return {
    label: adding ? 'Adjusted +' : 'Adjusted −',
    detail: t.reasonCode ?? t.note ?? t.description,
    Icon: Pencil,
    color: adding ? '#16A34A' : '#DC2626',
  };
}

export interface WhereUsedRow {
  levelLabel?: string;
  name: string;
  qty: number;
  uom: string;
  designators?: string;
}

interface PartDetailSheetProps {
  isOpen: boolean;
  record: StockRecord | null;
  status: CoverageStatus;
  part?: ApiPartResponse;
  transactions: StockTransaction[];
  members?: TeamMember[];
  orders: OrderRecord[];
  whereUsed: WhereUsedRow[];
  /** Whether this part is a BOM line on at least one build in the Builds tab — Allocate is
   * meaningless (and disabled) if no build actually needs this part. */
  hasBuildDemand: boolean;
  /** True only when every build that needs this part already has it fully covered (per that
   * build's own ledger-tracked allocation, not the stock row's pooled `allocated`) — so the
   * button can't go "Allocated" while some other build still has an outstanding shortfall. */
  isFullyAllocated: boolean;
  onClose: () => void;
  onReceive: () => void;
  onAdjust: () => void;
  onOrder: () => void;
  onIssue: () => void;
  onTransfer: () => void;
  onAllocate: () => void;
  onReleaseQuarantine: (qty: number) => void;
  /** Transitions a "want to order" order to actually ordered — only meaningful for
   * `status === 'planned'` rows in the Supply tab. */
  onMarkOrdered: (orderId: string) => void;
}

function StatItem({ label, value, color, sub }: { label: string; value: number; color?: string; sub?: string }) {
  const tip = STAT_TOOLTIPS[label];
  return (
    <div className="min-w-0">
      <div className="text-sm font-semibold leading-tight" style={color ? { color } : undefined}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
        {tip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help underline decoration-dotted underline-offset-2">{label}</span>
            </TooltipTrigger>
            <TooltipContent>{tip}</TooltipContent>
          </Tooltip>
        ) : label}
      </div>
      {sub && <div className="text-[10px] text-amber-600 truncate">{sub}</div>}
    </div>
  );
}

export function PartDetailSheet({
  isOpen, record, status, part, transactions, members = [], orders, whereUsed, hasBuildDemand, isFullyAllocated, onClose,
  onReceive, onAdjust, onOrder, onIssue, onTransfer, onAllocate, onReleaseQuarantine, onMarkOrdered,
}: PartDetailSheetProps) {
  const isMobile = useIsMobile();
  const [releaseQty, setReleaseQty] = useState('');

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach(m => map.set(m.id, m.name));
    return map;
  }, [members]);

  const partTxns = useMemo(() => {
    if (!record) return [];
    return transactions
      .filter(t => t.partId === record.partId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [record, transactions]);

  const stockRows = useMemo(() => {
    if (!record) return [];
    const rows: { location: string; label: string; qty: number; color: string }[] = [];
    const available = availableOf(record);
    if (available > 0) rows.push({ location: record.location, label: 'Available', qty: available, color: '#16A34A' });
    if (record.allocated > 0) {
      const secondSite = STOCK_LOCATIONS.find(l => l !== record.location && l !== 'Quarantine') ?? 'CM';
      rows.push({ location: secondSite, label: 'Allocated', qty: record.allocated, color: '#2563EB' });
    }
    if (record.quarantineQty) rows.push({ location: 'Quarantine', label: 'Quarantine', qty: record.quarantineQty, color: '#D97706' });
    if (rows.length === 0) rows.push({ location: record.location, label: 'On hand', qty: record.onHand, color: '#16A34A' });
    return rows;
  }, [record]);

  const partOrders = useMemo(() => {
    if (!record) return [];
    return orders.filter(o => o.partId === record.partId
      && (o.status === 'planned' || o.status === 'open' || o.status === 'partially_received'));
  }, [record, orders]);

  // Quantity flagged as "want to order" but not yet actually submitted — kept out of
  // record.onOrder (see onOrderOf), surfaced separately so the stat row doesn't understate
  // real procurement need.
  const plannedQty = useMemo(
    () => partOrders.filter(o => o.status === 'planned').reduce((sum, o) => sum + o.remainingQty, 0),
    [partOrders]
  );

  if (!record) return null;

  const handleRelease = () => {
    const qty = Math.min(Number(releaseQty) || 0, record.quarantineQty ?? 0);
    if (qty <= 0) return;
    onReleaseQuarantine(qty);
    setReleaseQty('');
  };

  const meta = getCategoryMeta(record.cat);
  const CategoryIcon = CATEGORY_ICON_MAP[meta.iconName] ?? Tag;

  const tabTriggerClass = cn(
    'rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-muted-foreground shrink-0',
    'data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary data-[state=active]:shadow-none'
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideClose={isMobile}
        className={cn(
          'p-0 overflow-y-auto overflow-x-hidden',
          isMobile
            ? 'inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none max-h-none rounded-none border-0 bg-background flex flex-col gap-0'
            : 'max-w-3xl max-h-[85vh]'
        )}
      >
        <DialogTitle className="sr-only">{record.pn} — {record.name}</DialogTitle>

        {isMobile && (
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold truncate">{record.pn}</h2>
          </div>
        )}

        <div className={cn('min-w-0 p-4 sm:p-6 space-y-4', isMobile && 'pt-3 pb-6')}>
          <div className={cn(isMobile && 'rounded-2xl border bg-background overflow-hidden')}>
            <div className={cn('flex items-start gap-3', isMobile && 'p-4')}>
              {record.imageUrl ? (
                <img src={record.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
              ) : (
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${meta.tint}1a`, color: meta.tint }}
                >
                  <CategoryIcon className="h-5 w-5" />
                </div>
              )}
              <div className={cn('min-w-0 flex-1', !isMobile && 'pr-8')}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-primary">{record.pn}</span>
                  <CoveragePill status={status} />
                </div>
                <h2 className="text-lg font-semibold leading-tight truncate">{record.name}</h2>
                <p className="text-xs text-muted-foreground truncate">
                  {[part?.manufacturer, part?.mpn, meta.label, part?.unit ?? 'EA'].filter(Boolean).join(' · ')}
                </p>
                {(record.lotNumber || record.serialNumber) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {record.lotNumber && <>Lot {record.lotNumber}</>}
                    {record.lotNumber && record.serialNumber && ' · '}
                    {record.serialNumber && <>SN {record.serialNumber}</>}
                  </p>
                )}
              </div>
            </div>

            <div
              className={cn(
                'grid grid-cols-3 gap-x-3 gap-y-3 sm:flex sm:flex-wrap sm:items-center sm:gap-6',
                isMobile ? 'border-t px-4 py-4' : 'py-2'
              )}
            >
              <StatItem label="On Hand" value={record.onHand} />
              <StatItem label="Allocated" value={record.allocated} />
              <StatItem label="Available" value={availableOf(record)} color={availableOf(record) < 0 ? '#DC2626' : '#16A34A'} />
              <StatItem
                label="On Order"
                value={record.onOrder}
                color={record.onOrder > 0 ? '#D97706' : undefined}
                sub={plannedQty > 0 ? `+${plannedQty} planned` : undefined}
              />
              <StatItem label="Quarantine" value={record.quarantineQty ?? 0} />
            </div>

            {(record.quarantineQty ?? 0) > 0 && (
              <div className={cn('flex items-center gap-2', isMobile ? 'px-4 pb-4' : 'pb-2')}>
                <Input
                  type="number"
                  min={1}
                  max={record.quarantineQty}
                  placeholder={`Qty (up to ${record.quarantineQty})`}
                  value={releaseQty}
                  onChange={(e) => setReleaseQty(e.target.value)}
                  className="h-8 w-40 text-sm"
                />
                <Button size="sm" variant="outline" className="h-8" onClick={handleRelease} disabled={!releaseQty || Number(releaseQty) <= 0}>
                  <Unlock className="h-3.5 w-3.5 mr-1.5" /> Release from quarantine
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button
              className="min-w-0 sm:w-auto px-4"
              onClick={onReceive}
            >
              <Download className="h-3.5 w-3.5 mr-1.5 shrink-0" /> <span className="truncate">Receive</span>
            </Button>
            <Button
              className="min-w-0 sm:w-auto px-4"
              variant="outline"
              onClick={onAdjust}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5 shrink-0" /> <span className="truncate">Adjust</span>
            </Button>
            <Button
              className="min-w-0 sm:w-auto px-4"
              variant="outline"
              onClick={onOrder}
            >
              <ShoppingCart className="h-4 w-4 mr-2 shrink-0" /> <span className="truncate">Order</span>
            </Button>
            {!isMobile && (
              <>
                <Button
                  className="min-w-0 px-4"
                  variant="outline"
                  onClick={onIssue}
                  disabled={availableOf(record) <= 0}
                  title={availableOf(record) <= 0 ? 'No available stock to issue' : undefined}
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2 shrink-0" /> <span className="truncate">Issue</span>
                </Button>
                <Button
                  className="min-w-0 px-4"
                  variant="outline"
                  onClick={onTransfer}
                  disabled={availableOf(record) <= 0}
                  title={availableOf(record) <= 0 ? 'No available stock to transfer' : undefined}
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2 shrink-0" /> <span className="truncate">Transfer</span>
                </Button>
                <Button
                  className="min-w-0 px-4"
                  variant="outline"
                  onClick={onAllocate}
                  disabled={!hasBuildDemand || isFullyAllocated || availableOf(record) <= 0}
                  title={
                    !hasBuildDemand
                      ? 'Not used in any build'
                      : isFullyAllocated
                        ? 'Already allocated to every build that needs it'
                        : availableOf(record) <= 0
                          ? 'No available stock to allocate'
                          : undefined
                  }
                >
                  <ClipboardCheck className="h-4 w-4 mr-2 shrink-0" />
                  <span className="truncate">{isFullyAllocated ? 'Allocated' : 'Allocate'}</span>
                </Button>
              </>
            )}
          </div>
        </div>

        <Tabs defaultValue="stock" className="min-w-0 border-t">
          <div className="px-4 sm:px-6 pt-3 overflow-x-auto no-scrollbar">
            <TabsList className="bg-transparent p-0 h-auto gap-2 justify-start">
              <TabsTrigger value="stock" className={tabTriggerClass}>
                Stock <span className="ml-1 text-[11px] opacity-70">{stockRows.length}</span>
              </TabsTrigger>
              <TabsTrigger value="movements" className={tabTriggerClass}>
                Movements <span className="ml-1 text-[11px] opacity-70">{partTxns.length}</span>
              </TabsTrigger>
              <TabsTrigger value="allocations" className={tabTriggerClass}>
                Allocations <span className="ml-1 text-[11px] opacity-70">{record.allocated > 0 ? 1 : 0}</span>
              </TabsTrigger>
              <TabsTrigger value="where-used" className={tabTriggerClass}>
                Where-used <span className="ml-1 text-[11px] opacity-70">{whereUsed.length}</span>
              </TabsTrigger>
              <TabsTrigger value="supply" className={tabTriggerClass}>
                Supply <span className="ml-1 text-[11px] opacity-70">{partOrders.length}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="stock" className="mt-0 p-4 sm:p-6 space-y-3">
            {stockRows.map((row) => (
              <div
                key={`${row.location}-${row.label}`}
                className="rounded-2xl border bg-background p-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold truncate">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {row.location}
                  </div>
                  <div
                    className="mt-1 flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: row.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: row.color }} />
                    {row.label}
                  </div>
                </div>
                <span className="text-sm font-semibold shrink-0">{row.qty} {part?.unit ?? 'EA'}</span>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="movements" className="mt-0 p-4 sm:p-6">
            {partTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No movements yet.</p>
            ) : (
              <div className="space-y-3">
                {partTxns.map((t) => {
                  const meta = describeTransaction(t);
                  const who = t.createdBy ? (memberNameById.get(t.createdBy) ?? 'Unknown user') : 'System';
                  return (
                    <div key={t.id} className="rounded-2xl border bg-background p-3.5 flex items-start gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                        style={{ background: `${meta.color}1a`, color: meta.color }}
                      >
                        <meta.Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold truncate">{meta.label}</div>
                          <span className="text-sm font-semibold shrink-0" style={{ color: meta.color }}>
                            {t.type === 'adjust' ? (t.direction === 'remove' ? '−' : '+') : ''}{t.qty}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground truncate">
                          {t.location} · {new Date(t.createdAt).toLocaleString()} · {who}
                        </div>
                        {meta.detail && (
                          <div className="mt-1 text-xs text-muted-foreground truncate">{meta.detail}</div>
                        )}
                        {(t.lotNumber || t.serialNumber) && (
                          <div className="mt-1 text-xs text-muted-foreground truncate">
                            {t.lotNumber && <>Lot {t.lotNumber}</>}
                            {t.lotNumber && t.serialNumber && ' · '}
                            {t.serialNumber && <>SN {t.serialNumber}</>}
                          </div>
                        )}
                        {t.type === 'receive' && t.quarantine && (
                          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                            <ShieldAlert className="h-3 w-3" /> Quarantine
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="allocations" className="mt-0 p-4 sm:p-6">
            {record.allocated > 0 ? (
              <div className="rounded-2xl border bg-background p-3.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reserved against BOM demand</span>
                <span className="font-semibold">{record.allocated} {part?.unit ?? 'EA'}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nothing allocated.</p>
            )}
          </TabsContent>

          <TabsContent value="where-used" className="mt-0 p-4 sm:p-6">
            {whereUsed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Not referenced in the BOM.</p>
            ) : (
              <div className="space-y-3">
                {whereUsed.map((w, i) => (
                  <div key={i} className="rounded-2xl border bg-background p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {w.levelLabel && <span className="text-muted-foreground">{w.levelLabel} — </span>}
                        {w.name}
                      </div>
                      {w.designators && (
                        <div className="mt-1 text-xs text-muted-foreground truncate">{w.designators}</div>
                      )}
                    </div>
                    <span className="text-sm font-semibold shrink-0">{w.qty} {w.uom}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="supply" className="mt-0 p-4 sm:p-6 space-y-3">
            {partOrders.length > 0 ? (
              <>
                {partOrders.map((o) => (
                  <div key={o.id} className="rounded-2xl border bg-background p-3.5 space-y-2 text-sm">
                    {o.status === 'planned' && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                          <Clock className="h-3 w-3" /> Want to order
                        </span>
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onMarkOrdered(o.id)}>
                          Mark as ordered
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Remaining</span>
                      <span className="font-semibold">{o.remainingQty} {part?.unit ?? 'EA'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Expected</span>
                      <span className="font-medium">{formatShortDate(o.expectedDate)}</span>
                    </div>
                    {o.supplierRef && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Supplier / PO</span>
                        <span className="font-medium">{o.supplierRef}</span>
                      </div>
                    )}
                    {o.lotNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Lot number</span>
                        <span className="font-medium">{o.lotNumber}</span>
                      </div>
                    )}
                    {o.serialNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Serial number</span>
                        <span className="font-medium truncate max-w-[60%]" title={o.serialNumber}>{o.serialNumber}</span>
                      </div>
                    )}
                    {o.note && (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground shrink-0">Notes</span>
                        <span className="font-medium text-right">{o.note}</span>
                      </div>
                    )}
                    {o.description && (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground shrink-0">Description</span>
                        <span className="font-medium text-right">{o.description}</span>
                      </div>
                    )}
                    {o.purpose && (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground shrink-0">Purpose</span>
                        <span className="font-medium text-right">{o.purpose}</span>
                      </div>
                    )}
                    {o.status === 'partially_received' && (
                      <div className="text-xs text-muted-foreground">Partially received — {o.quantity - o.remainingQty} of {o.quantity} so far</div>
                    )}
                  </div>
                ))}
                <div className="text-xs text-muted-foreground">Lead time: {formatLeadTime(record.leadTimeDays)}</div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nothing on order.</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
