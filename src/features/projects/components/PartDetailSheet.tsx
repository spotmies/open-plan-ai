import { useMemo, useState } from 'react';
import {
  Download, ShoppingCart, Pencil, ArrowLeftRight, ClipboardCheck, MapPin, ChevronLeft, ChevronRight, Clock,
  Zap, Cpu, Package, Box, Monitor, Shield, Layers, Tag, Unlock, ShieldAlert, type LucideIcon,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useEntityAttachmentsBatch } from '@/hooks/useProjectAttachments';
import { resolveFileUrl } from '@/utils/fileUrl';
import type { AttachmentRecord } from '@/services/attachments.service';
import type { TeamMember } from '@/types';
import { getCategoryMeta, formatLeadTime, type ApiPartResponse } from './bomData';
import { ImageViewerModal } from './BOMShared';
import {
  availableOf, CoveragePill, STOCK_LOCATIONS, formatShortDate,
  type StockRecord, type StockTransaction, type CoverageStatus, type OrderRecord,
} from './inventoryData';

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = { Zap, Cpu, Package, Box, Monitor, Shield, Layers, Tag };

const FIELD_TOOLTIPS: Record<string, string> = {
  'On Hand': 'Physical quantity currently in stock, including anything held in quarantine.',
  'Allocated': 'Quantity already reserved against BOM demand for planned builds.',
  'Available': 'On Hand minus Allocated minus Quarantine — what can actually be used right now.',
  'On Order': 'Quantity remaining on open purchase orders, not yet received. Want-to-order items aren’t counted until marked ordered.',
  'Quarantine': 'Held out of Available until released — pending inspection or testing.',
};

interface TransactionMeta {
  label: string;
  /** The headline detail for this event (a PO reference, an issue reason, "To CM", …).
   * Note / description / lot / images are rendered separately below it, so they're never
   * swallowed by a more prominent field the way the old single `detail` line did. */
  primary?: string;
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
      primary: t.quarantine ? 'Held in quarantine' : t.reference,
      Icon: Download,
      color: '#16A34A',
    };
  }
  if (t.type === 'allocate') {
    return { label: 'Allocated', Icon: ClipboardCheck, color: '#7C3AED' };
  }
  if (t.type === 'deallocate') {
    return { label: 'Deallocated', Icon: ClipboardCheck, color: '#64748B' };
  }
  if (t.type === 'issue') {
    return { label: 'Issued', primary: t.reasonCode, Icon: ArrowLeftRight, color: '#DC2626' };
  }
  if (t.type === 'transfer') {
    return { label: 'Transferred', primary: t.reference ? `To ${t.reference}` : undefined, Icon: ArrowLeftRight, color: '#2563EB' };
  }
  // adjust
  if (t.reasonCode === 'Released from quarantine') {
    return { label: 'Released from quarantine', Icon: Unlock, color: '#0EA5E9' };
  }
  const adding = t.direction === 'add';
  return {
    label: adding ? 'Adjusted +' : 'Adjusted −',
    primary: t.reasonCode,
    Icon: Pencil,
    color: adding ? '#16A34A' : '#DC2626',
  };
}

/** An attachment record → a displayable image URL, or null for non-images. */
function attachmentImageUrl(a: AttachmentRecord): string | null {
  const mime = a.mimeType ?? a.mime_type ?? '';
  const raw = a.fileUrl ?? a.url ?? a.file_path ?? null;
  if (!raw) return null;
  const looksLikeImage = mime.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(a.fileName ?? a.file_name ?? '');
  if (!looksLikeImage) return null;
  return resolveFileUrl(raw) ?? raw;
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

/** One labelled cell in the facts strip — small-caps label over a value, matching the
 * BOM part-detail screen's `Field`. */
function Field({
  label, mono, hint, children,
}: { label: string; mono?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[10.5px] uppercase tracking-wider text-muted-foreground/70" title={hint}>{label}</div>
      <div className={cn('truncate text-sm font-medium text-foreground', mono && 'font-mono')}>{children}</div>
    </div>
  );
}

/** Bordered content section with a titled header + optional count pill. */
function SectionCard({
  title, count, action, bodyClassName, children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {count !== undefined && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{count}</span>
          )}
        </div>
        {action}
      </div>
      <div className={bodyClassName ?? 'p-4'}>{children}</div>
    </div>
  );
}

export function PartDetailSheet({
  isOpen, record, status, part, transactions, members = [], orders, whereUsed, hasBuildDemand, isFullyAllocated, onClose,
  onReceive, onAdjust, onOrder, onIssue, onTransfer, onAllocate, onReleaseQuarantine, onMarkOrdered,
}: PartDetailSheetProps) {
  const [releaseQty, setReleaseQty] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

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

  // Photos are only ever attached to "New transaction" adjustments today, so only those
  // rows need an attachment lookup (there's no batch endpoint — one request per id).
  const txnIdsWithPossibleImages = useMemo(
    () => partTxns.filter(t => t.type === 'adjust').map(t => t.id),
    [partTxns],
  );
  const { data: attachmentsByTxn } = useEntityAttachmentsBatch('inventory_transaction', txnIdsWithPossibleImages);

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

  const availableQty = availableOf(record);
  const unit = part?.unit ?? 'EA';

  const actionButtons = (
    <>
      <Button
        size="sm"
        onClick={onReceive}
        disabled={record.onOrder <= 0}
        title={record.onOrder <= 0 ? 'No orders available for this part' : undefined}
      >
        <Download className="mr-1.5 h-4 w-4 shrink-0" /> Receive
      </Button>
      <Button size="sm" variant="outline" onClick={onAdjust}>
        <Pencil className="mr-1.5 h-4 w-4 shrink-0" /> Adjust
      </Button>
      <Button size="sm" variant="outline" onClick={onOrder}>
        <ShoppingCart className="mr-1.5 h-4 w-4 shrink-0" /> Order
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onIssue}
        disabled={availableQty <= 0}
        title={availableQty <= 0 ? 'No available stock to issue' : undefined}
      >
        <ArrowLeftRight className="mr-1.5 h-4 w-4 shrink-0" /> Issue
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onTransfer}
        disabled={availableQty <= 0}
        title={availableQty <= 0 ? 'No available stock to transfer' : undefined}
      >
        <ArrowLeftRight className="mr-1.5 h-4 w-4 shrink-0" /> Transfer
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onAllocate}
        disabled={!hasBuildDemand || isFullyAllocated || availableQty <= 0}
        title={
          !hasBuildDemand
            ? 'Not used in any build'
            : isFullyAllocated
              ? 'Already allocated to every build that needs it'
              : availableQty <= 0
                ? 'No available stock to allocate'
                : undefined
        }
      >
        <ClipboardCheck className="mr-1.5 h-4 w-4 shrink-0" />
        {isFullyAllocated ? 'Allocated' : 'Allocate'}
      </Button>
    </>
  );

  const quarantineRelease = (record.quarantineQty ?? 0) > 0 ? (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
        <ShieldAlert className="h-3.5 w-3.5" /> {record.quarantineQty} in quarantine
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Input
          type="number"
          min={1}
          max={record.quarantineQty}
          placeholder={`Qty (up to ${record.quarantineQty})`}
          value={releaseQty}
          onChange={(e) => setReleaseQty(e.target.value)}
          className="h-8 flex-1 text-sm sm:w-36 sm:flex-none"
        />
        <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={handleRelease} disabled={!releaseQty || Number(releaseQty) <= 0}>
          <Unlock className="mr-1.5 h-3.5 w-3.5" /> Release
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideClose
        className={cn(
          'p-0 overflow-hidden gap-0 flex flex-col',
          'inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:rounded-none border-0 bg-background',
        )}
      >
        <DialogTitle className="sr-only">{record.pn} — {record.name}</DialogTitle>

        {/* Breadcrumb */}
        <div className="flex shrink-0 items-center gap-1.5 border-b px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded transition-colors hover:text-foreground"
            aria-label="Back to inventory"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Inventory
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="truncate font-medium text-foreground">{record.pn}</span>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">

            {/* Part header */}
            <div className="flex flex-wrap items-start justify-between gap-4 py-4">
              <div className="flex min-w-0 gap-3">
                {record.imageUrl ? (
                  <img src={record.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl border object-cover" />
                ) : (
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${meta.tint}1a`, color: meta.tint }}
                  >
                    <CategoryIcon className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-xl font-semibold text-foreground">{record.name}</h1>
                    <CoveragePill status={status} />
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">{record.pn}</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-sm" style={{ color: meta.tint }}>
                    <span className="inline-block h-2 w-2 rounded-sm" style={{ background: meta.tint }} />
                    {meta.label}
                  </div>
                </div>
              </div>
              <div className="hidden shrink-0 flex-wrap items-center justify-end gap-2 lg:flex">
                {actionButtons}
              </div>
            </div>

            {/* Actions — small screens */}
            <div className="grid grid-cols-2 gap-2 pb-4 sm:flex sm:flex-wrap lg:hidden">
              {actionButtons}
            </div>

            {quarantineRelease && <div className="pb-4">{quarantineRelease}</div>}

            {/* Facts strip */}
            <div
              className="mb-5 grid gap-4 rounded-xl border bg-card px-4 py-3.5"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(116px, 1fr))' }}
            >
              <Field label="On Hand" hint={FIELD_TOOLTIPS['On Hand']}>{record.onHand} {unit}</Field>
              <Field label="Allocated" hint={FIELD_TOOLTIPS['Allocated']}>{record.allocated}</Field>
              <Field label="Available" hint={FIELD_TOOLTIPS['Available']}>
                <span style={{ color: availableQty < 0 ? '#DC2626' : '#16A34A' }}>{availableQty}</span>
              </Field>
              <Field label="On Order" hint={FIELD_TOOLTIPS['On Order']}>
                <span style={record.onOrder > 0 ? { color: '#D97706' } : undefined}>{record.onOrder}</span>
                {plannedQty > 0 && <span className="text-muted-foreground"> (+{plannedQty} planned)</span>}
              </Field>
              <Field label="Quarantine" hint={FIELD_TOOLTIPS['Quarantine']}>{record.quarantineQty ?? 0}</Field>
              <Field label="Location">{record.location}</Field>
              <Field label="Lead Time">{record.leadTimeDays > 0 ? formatLeadTime(record.leadTimeDays) : '—'}</Field>
              <Field label="Unit">{unit}</Field>
              {part?.manufacturer && <Field label="Manufacturer">{part.manufacturer}</Field>}
              {part?.mpn && <Field label="MPN" mono>{part.mpn}</Field>}
              {record.lotNumber && <Field label="Lot" mono>{record.lotNumber}</Field>}
              {record.serialNumber && <Field label="Serial" mono>{record.serialNumber}</Field>}
            </div>

            {/* Two-column body */}
            <div className="grid gap-4 lg:[grid-template-columns:minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-4">

          {(record.imageUrl || part?.description) && (
            <SectionCard title="Overview">
              <div className="flex gap-4">
                {record.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setLightboxSrc(resolveFileUrl(record.imageUrl) ?? record.imageUrl!)}
                    className="h-28 w-28 shrink-0 overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-80"
                  >
                    <img src={resolveFileUrl(record.imageUrl) ?? record.imageUrl} alt="" className="h-full w-full object-cover" />
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  {part?.description ? (
                    <>
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">Description</p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{part.description}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No description.</p>
                  )}
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Stock by location" count={stockRows.length} bodyClassName="p-3 space-y-2">
            {stockRows.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No stock on hand.</p>
            ) : stockRows.map((row) => (
              <div
                key={`${row.location}-${row.label}`}
                className="rounded-lg border bg-background p-3 flex items-center justify-between gap-3"
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
                <span className="text-sm font-semibold shrink-0">{row.qty} {unit}</span>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Movements" count={partTxns.length} bodyClassName="p-3">
            {partTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No movements yet.</p>
            ) : (
              <div className="space-y-2">
                {partTxns.map((t) => {
                  const meta = describeTransaction(t);
                  const who = t.createdBy ? (memberNameById.get(t.createdBy) ?? 'Unknown user') : 'System';
                  // Don't repeat the headline line as a "Note" too.
                  const note = t.note && t.note !== meta.primary ? t.note : undefined;
                  const description = t.description && t.description !== meta.primary && t.description !== note
                    ? t.description
                    : undefined;
                  const images = (attachmentsByTxn?.get(t.id) ?? [])
                    .map(attachmentImageUrl)
                    .filter((u): u is string => !!u);
                  return (
                    <div key={t.id} className="rounded-lg border bg-background p-3 flex items-start gap-3">
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
                        {meta.primary && (
                          <div className="mt-1 text-xs text-muted-foreground break-words">{meta.primary}</div>
                        )}
                        {(note || description) && (
                          <div className="mt-2 space-y-1 rounded-md bg-muted/50 px-2.5 py-2 text-xs">
                            {description && (
                              <div className="break-words whitespace-pre-wrap">
                                <span className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground/70">Description</span>
                                <div className="text-foreground/90">{description}</div>
                              </div>
                            )}
                            {note && (
                              <div className="break-words whitespace-pre-wrap">
                                <span className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground/70">Note</span>
                                <div className="text-foreground/90">{note}</div>
                              </div>
                            )}
                          </div>
                        )}
                        {(t.lotNumber || t.serialNumber) && (
                          <div className="mt-1 text-xs text-muted-foreground truncate">
                            {t.lotNumber && <>Lot {t.lotNumber}</>}
                            {t.lotNumber && t.serialNumber && ' · '}
                            {t.serialNumber && <>SN {t.serialNumber}</>}
                          </div>
                        )}
                        {t.type === 'adjust' && typeof t.leadTimeDays === 'number' && t.leadTimeDays > 0 && (
                          <div className="mt-1 text-xs text-muted-foreground truncate">
                            Lead time: {formatLeadTime(t.leadTimeDays)}
                          </div>
                        )}
                        {images.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {images.map((src, i) => (
                              <button
                                key={src}
                                type="button"
                                onClick={() => setLightboxSrc(src)}
                                className="h-20 w-20 overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-80"
                              >
                                <img src={src} alt={`Attachment ${i + 1}`} className="h-full w-full object-cover" />
                              </button>
                            ))}
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
          </SectionCard>
              </div>

              <div className="flex min-w-0 flex-col gap-4">

          <SectionCard title="Allocations" count={record.allocated > 0 ? 1 : 0}>
            {record.allocated > 0 ? (
              <div className="rounded-lg border bg-background p-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reserved against BOM demand</span>
                <span className="font-semibold">{record.allocated} {unit}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nothing allocated.</p>
            )}
          </SectionCard>

          <SectionCard title="Where used" count={whereUsed.length} bodyClassName="p-3 space-y-2">
            {whereUsed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Not referenced in the BOM.</p>
            ) : whereUsed.map((w, i) => (
              <div key={i} className="rounded-lg border bg-background p-3 flex items-center justify-between gap-3">
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
          </SectionCard>

          <SectionCard title="On order" count={partOrders.length} bodyClassName="p-3 space-y-2">
            {partOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nothing on order.</p>
            ) : partOrders.map((o) => (
              <div key={o.id} className="rounded-lg border bg-background p-3 space-y-2 text-sm">
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
                  <span className="font-semibold">{o.remainingQty} {unit}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expected</span>
                  <span className="font-medium">{formatShortDate(o.expectedDate)}</span>
                </div>
                {o.leadTimeDays !== undefined && o.leadTimeDays !== null && o.leadTimeDays > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Lead time</span>
                    <span className="font-medium">{formatLeadTime(o.leadTimeDays)}</span>
                  </div>
                )}
                {record.leadTimeDays > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Part lead time</span>
                    <span className="font-medium">{formatLeadTime(record.leadTimeDays)}</span>
                  </div>
                )}
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
          </SectionCard>

              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {lightboxSrc && <ImageViewerModal src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </Dialog>
  );
}
