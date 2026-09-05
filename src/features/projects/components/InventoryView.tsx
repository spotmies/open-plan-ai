import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search, Table as TableIcon, LayoutGrid, Download, Pencil, PackageSearch,
  AlertTriangle, Truck, CheckCircle, Lock, Boxes as BoxesIcon, Layers, SlidersHorizontal, ShoppingCart, Clock,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent, DrawerFooter, DrawerTitle } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useProjects } from '@/hooks/useProjects';
import { bomService } from '@/services/bom.service';
import { inventoryService, fromApiBuildBomLine } from '@/services/inventory.service';
import { attachmentsService } from '@/services/attachments.service';
import { queryKeys } from '@/lib/queryClient';
import { useOrgParts } from '@/hooks/useParts';
import { useOrganizationMembers } from '@/hooks/useProjectTeam';
import {
  useInventoryStock, useInventoryOrders, useInventoryTransactions, useInventoryBuilds,
  useReceiveStock, useAdjustStock, useReleaseQuarantine, usePlaceOrder, useMarkOrderOrdered, useCreateInventoryBuild,
  useIssueStock, useTransferStock, useAllocateStock,
} from '@/hooks/useInventory';
import {
  fromApiNode, applyPriceRollup, assignLevelLabels, bomFlatAll,
  KNOWN_BOM_CATEGORIES, getCategoryMeta, type BOMCategory,
} from './bomData';
import {
  buildFromDef, computeCoverage, availableOf, onOrderOf,
  CoveragePill,
  type StockRecord, type CoverageStatus, type BuildDef, type OrderRecord,
} from './inventoryData';
import { HoverZoomImage, PartThumb } from './BOMShared';
import { ReceiveStockDialog, type ReceiveStockInput } from './ReceiveStockDialog';
import { AdjustQuantityDialog, type AdjustQuantityInput } from './AdjustQuantityDialog';
import { PlaceOrderDialog, type PlaceOrderInput } from './PlaceOrderDialog';
import { IssueStockDialog, type IssueStockInput } from './IssueStockDialog';
import { TransferStockDialog, type TransferStockInput } from './TransferStockDialog';
import { AllocateStockDialog, type AllocateStockInput } from './AllocateStockDialog';
import { PartDetailSheet, type WhereUsedRow } from './PartDetailSheet';
import { BuildsPanel } from './BuildsPanel';
import { AlertsPanel } from './AlertsPanel';
import type { NewBuildInput } from './NewBuildDialog';

const STAT_TOOLTIPS: Record<string, string> = {
  'On Hand': 'Physical quantity currently in stock, including anything held in quarantine.',
  'Allocated': 'Quantity reserved against a build via Allocate — committed but not yet issued.',
  'Available': 'On Hand minus Allocated minus Quarantine — what can actually be used right now.',
  'On Order': 'Quantity remaining on open purchase orders, not yet received.',
};

function HeaderTip({ label }: { label: string }) {
  const tip = STAT_TOOLTIPS[label];
  if (!tip) return <>{label}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted underline-offset-2">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

function softTint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function StatCard({ label, value, icon: Icon, iconColor, accent, loading }: {
  label: string; value: string; icon: React.ElementType;
  iconColor: string; accent?: boolean; loading?: boolean;
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
        {loading ? (
          <Skeleton className="h-5 w-10 mb-1" />
        ) : (
          <span className="block text-lg font-bold leading-tight truncate" style={{ color: accent ? iconColor : undefined }}>
            {value}
          </span>
        )}
        <span className="block text-[11px] text-muted-foreground truncate">{label}</span>
      </span>
    </div>
  );
}

interface InventoryViewProps {
  orgId: string;
}

type QuickFilter = 'all' | 'low-coverage' | 'on-order' | 'lot-serial' | 'quarantine';

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: 'all', label: 'All parts' },
  { value: 'low-coverage', label: 'Low coverage' },
  { value: 'on-order', label: 'On order' },
  { value: 'lot-serial', label: 'Lot / serial' },
  { value: 'quarantine', label: 'Quarantine' },
];

export function InventoryView({ orgId }: InventoryViewProps) {
  const isMobile = useIsMobile();
  const { data: projects = [] } = useProjects();
  const { data: partsResult, isLoading: isPartsLoading } = useOrgParts(orgId, { limit: 100 });
  const parts = useMemo(() => partsResult?.data ?? [], [partsResult]);

  // BOM demand is aggregated across every project in the org — stock/coverage here is
  // organization-wide, not scoped to a single project's BOM.
  const bomTreeQueries = useQueries({
    queries: projects.map((p) => ({
      queryKey: queryKeys.bom.tree(p.id),
      queryFn: () => bomService.getTree(p.id),
      staleTime: 30 * 1000,
    })),
  });

  const rootNodes = useMemo(() => {
    const all = [];
    for (const q of bomTreeQueries) {
      if (!q.data) continue;
      const nodes = q.data.roots.map(r => applyPriceRollup(fromApiNode(r)));
      assignLevelLabels(nodes);
      all.push(...nodes);
    }
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomTreeQueries.map(q => q.dataUpdatedAt).join(',')]);

  const demandByPartId = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of bomFlatAll(rootNodes)) {
      if (!n._partId) continue;
      map.set(n._partId, (map.get(n._partId) ?? 0) + n.qty);
    }
    return map;
  }, [rootNodes]);

  // Which project(s) a part is used in — a part can appear in more than one project's BOM,
  // so this tracks every project name that references it, not just one.
  const projectsByPartId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    projects.forEach((p, i) => {
      const data = bomTreeQueries[i]?.data;
      if (!data) return;
      const nodes = data.roots.map(r => fromApiNode(r));
      for (const n of bomFlatAll(nodes)) {
        if (!n._partId) continue;
        if (!map.has(n._partId)) map.set(n._partId, new Set());
        map.get(n._partId)!.add(p.name);
      }
    });
    const result = new Map<string, string[]>();
    map.forEach((names, partId) => result.set(partId, Array.from(names)));
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomTreeQueries.map(q => q.dataUpdatedAt).join(','), projects]);

  const { data: stock = [], isLoading: isStockLoading } = useInventoryStock(orgId);
  const isInventoryLoading = isPartsLoading || isStockLoading;
  const { data: orders = [] } = useInventoryOrders(orgId);
  const { data: transactions = [] } = useInventoryTransactions(orgId);
  const { data: builds = [] } = useInventoryBuilds(orgId);
  const { data: members = [] } = useOrganizationMembers(orgId);

  const receiveStockMutation = useReceiveStock(orgId);
  const adjustStockMutation = useAdjustStock(orgId);
  const releaseQuarantineMutation = useReleaseQuarantine(orgId);
  const placeOrderMutation = usePlaceOrder(orgId);
  const markOrderOrderedMutation = useMarkOrderOrdered(orgId);
  const createBuildMutation = useCreateInventoryBuild(orgId);
  const issueStockMutation = useIssueStock(orgId);
  const transferStockMutation = useTransferStock(orgId);
  const allocateStockMutation = useAllocateStock(orgId);

  // `onOrder` is derived from live order state rather than the static seeded field, so
  // Receive/Order actions are reflected immediately without touching stock rows directly.
  // Note: `allocated` is passed through untouched — it's the stock row's real pooled reservation
  // (bumped by the Allocate action / build allocation), and the Allocated column + the part-detail
  // sheet both render exactly this so the two never disagree. BOM demand is a separate signal and
  // is surfaced via the Coverage pill, not by inflating `allocated`.
  //
  // A part that's never been received has no stock row at all — without a synthetic zero-on-hand
  // row here, placing its first order makes the order vanish from Inventory entirely (nothing to
  // render it against) until someone happens to receive it. That reads as "the order didn't work."
  const displayStock = useMemo(() => {
    const stockPartIds = new Set(stock.map(r => r.partId));
    const fromStock = stock.map(r => ({ ...r, onOrder: onOrderOf(orders, r.partId) }));
    const pendingOrdersByPart = new Map<string, OrderRecord[]>();
    for (const o of orders) {
      if (stockPartIds.has(o.partId)) continue;
      if (o.status !== 'planned' && o.status !== 'open' && o.status !== 'partially_received') continue;
      const list = pendingOrdersByPart.get(o.partId) ?? [];
      list.push(o);
      pendingOrdersByPart.set(o.partId, list);
    }
    const stubs: StockRecord[] = [];
    for (const p of parts) {
      const partOrders = pendingOrdersByPart.get(p.id);
      if (!partOrders) continue;
      const latest = partOrders.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
      stubs.push({
        id: `pending-order:${p.id}`,
        partId: p.id,
        pn: p.partNumber,
        name: p.name,
        cat: p.category,
        onHand: 0,
        allocated: 0,
        onOrder: onOrderOf(orders, p.id),
        location: latest.location,
        leadTimeDays: 0,
        createdAt: latest.createdAt,
      });
    }
    return [...fromStock, ...stubs];
  }, [stock, orders, parts]);

  // A part's canonical stock location: the location of its earliest stock row, or — for a
  // part not yet stocked — its earliest order's destination. Receive and Place order are
  // pinned to this (a part only ever lives in one location; Transfer moves it). Mirrors
  // findCanonicalStockLocation() on the backend, which enforces the same rule server-side.
  const canonicalLocationByPartId = useMemo(() => {
    const earliestStock = new Map<string, StockRecord>();
    for (const r of stock) {
      const cur = earliestStock.get(r.partId);
      if (!cur || r.createdAt < cur.createdAt) earliestStock.set(r.partId, r);
    }
    const earliestOrder = new Map<string, OrderRecord>();
    for (const o of orders) {
      const cur = earliestOrder.get(o.partId);
      if (!cur || o.createdAt < cur.createdAt) earliestOrder.set(o.partId, o);
    }
    const map = new Map<string, string>();
    for (const partId of new Set([...earliestStock.keys(), ...earliestOrder.keys()])) {
      const loc = earliestStock.get(partId)?.location ?? earliestOrder.get(partId)?.location;
      if (loc) map.set(partId, loc);
    }
    return map;
  }, [stock, orders]);

  // "Want to order" (planned) orders never move the On Order column — that's intentional, they
  // aren't submitted to a supplier yet — but that means a planned order against a part that's
  // *already* stocked produces zero visible change on its row. Surface it as a badge instead so
  // the transaction is never invisible, whether or not the part already had a stock row.
  const wantToOrderPartIds = useMemo(
    () => new Set(orders.filter(o => o.status === 'planned').map(o => o.partId)),
    [orders]
  );

  // Receive/Place order only make sense for parts that already have a stock row or a pending
  // order (i.e. appear in `displayStock`, including its synthetic pending-order rows) — a part
  // that only exists inside a BOM, with neither, isn't orderable/receivable yet. Including the
  // pending-order case is what lets a part actually get its first-ever Receive once ordered.
  const stockedParts = useMemo(() => {
    const displayPartIds = new Set(displayStock.map(r => r.partId));
    return parts.filter(p => displayPartIds.has(p.id));
  }, [parts, displayStock]);

  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(isMobile ? 'cards' : 'table');
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);

  const handleReceive = (input: ReceiveStockInput) => {
    receiveStockMutation.mutate({
      partId: input.partId,
      location: input.location,
      locationNodeId: input.locationNodeId,
      quantity: input.quantity,
      reference: input.reference,
      quarantine: input.quarantine,
      note: input.note,
      orderId: input.orderId,
      lotNumber: input.lotNumber,
      serialNumber: input.serialNumber,
    }, {
      onSuccess: () => toast.success(`Received ${input.quantity} × ${input.pn}`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to receive stock'),
    });
  };

  const handlePlaceOrder = (input: PlaceOrderInput) => {
    placeOrderMutation.mutate({
      partId: input.partId,
      quantity: input.quantity,
      expectedDate: input.expectedDate,
      leadTimeDays: input.leadTime,
      supplierRef: input.supplierRef,
      unitCost: input.unitCost,
      location: input.location,
      locationNodeId: input.locationNodeId,
      note: input.note,
      description: input.description,
      purpose: input.purpose,
      lotNumber: input.lotNumber,
      serialNumber: input.serialNumber,
      status: input.status,
    }, {
      onSuccess: () => toast.success(
        input.status === 'planned'
          ? `Flagged ${input.quantity} × ${input.pn} as needed to order`
          : `Order placed for ${input.quantity} × ${input.pn}`
      ),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to place order'),
    });
  };

  const handleReleaseQuarantine = (recordId: string, qty: number) => {
    releaseQuarantineMutation.mutate({ stockId: recordId, qty }, {
      onSuccess: () => toast.success(`Released ${qty} from quarantine`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to release quarantine'),
    });
  };

  const handleMarkOrdered = (orderId: string) => {
    markOrderOrderedMutation.mutate(orderId, {
      onSuccess: () => toast.success('Order marked as ordered'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to mark order as ordered'),
    });
  };

  const handleAdjust = (input: AdjustQuantityInput) => {
    const dto = {
      partId: input.partId,
      location: input.location,
      locationNodeId: input.locationNodeId,
      direction: input.direction,
      mode: input.mode,
      quantity: input.quantity,
      reasonCode: input.reasonCode,
      note: input.note,
      description: input.description,
      lotNumber: input.lotNumber,
      serialNumber: input.serialNumber,
      leadTimeDays: input.leadTimeDays,
    };
    console.table(Object.entries(dto).map(([field, value]) => ({ field, value: JSON.stringify(value), type: typeof value })));
    adjustStockMutation.mutate(dto, {
      onSuccess: (result) => {
        console.table([
          { source: 'submit', leadTimeDays: input.leadTimeDays },
          { source: 'response', leadTimeDays: result.leadTimeDays },
        ]);
        toast.success('Adjustment posted');
        if (input.images?.length && result.transactionId) {
          const transactionId = result.transactionId;
          Promise.allSettled(
            input.images.map((file) =>
              attachmentsService.upload({ entityId: transactionId, entityType: 'inventory_transaction', file }),
            ),
          ).then((results) => {
            const failed = results.filter((r) => r.status === 'rejected').length;
            if (failed > 0) {
              toast.error(
                failed === input.images!.length
                  ? 'Adjustment saved, but the images failed to upload'
                  : `Adjustment saved, but ${failed} of ${input.images!.length} images failed to upload`,
              );
            }
          });
        }
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to post adjustment'),
    });
  };

  const handleIssue = (input: IssueStockInput) => {
    issueStockMutation.mutate(input, {
      onSuccess: () => toast.success(`Issued ${input.quantity} unit(s) from ${input.location}`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to issue stock'),
    });
  };

  const handleTransfer = (input: TransferStockInput) => {
    transferStockMutation.mutate(input, {
      onSuccess: () => toast.success(`Stock moved from ${input.fromLocation} to ${input.toLocation}`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to transfer stock'),
    });
  };

  const handleAllocate = (recordId: string, input: AllocateStockInput) => {
    allocateStockMutation.mutate({ stockId: recordId, ...input }, {
      onSuccess: () => toast.success(`Allocated ${input.quantity} unit(s)`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to allocate stock'),
    });
  };

  const coverageOf = (r: StockRecord): CoverageStatus =>
    computeCoverage(r, demandByPartId.get(r.partId) ?? 0);

  // Category filter pills reflect whatever categories actually exist in stock — including
  // custom ones typed in via "Add new part" — not just the 7 fixed BOM presets, so a custom
  // category never silently becomes unfilterable/ungrouped after it's created.
  const allCategories = useMemo(() => {
    const extra = Array.from(new Set(displayStock.map(r => r.cat))).filter(
      cat => !(KNOWN_BOM_CATEGORIES as readonly string[]).includes(cat)
    );
    return [...KNOWN_BOM_CATEGORIES, ...extra];
  }, [displayStock]);

  const filteredStock = useMemo(() => {
    return displayStock.filter(r => {
      if (categoryFilter !== 'all' && r.cat !== categoryFilter) return false;
      if (search && !`${r.pn} ${r.name}`.toLowerCase().includes(search.toLowerCase())) return false;
      const coverage = coverageOf(r);
      if (quickFilter === 'low-coverage' && coverage === 'ready') return false;
      if (quickFilter === 'on-order' && r.onOrder <= 0) return false;
      if (quickFilter === 'lot-serial' && !r.lotNumber && !r.serialNumber) return false;
      if (quickFilter === 'quarantine' && !(r.quarantineQty && r.quarantineQty > 0)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayStock, categoryFilter, search, quickFilter, demandByPartId]);

  // Pagination applies to the desktop table/cards views — mobile keeps scrolling the full
  // filtered list within its own scroll region rather than paging (paginatedStock === filteredStock
  // there), since there's no room for page-number controls on a phone-width toolbar.
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const totalPages = Math.max(1, Math.ceil(filteredStock.length / pageSize));

  useEffect(() => { setCurrentPage(1); }, [search, quickFilter, categoryFilter, pageSize]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const paginatedStock = useMemo(() => {
    if (isMobile) return filteredStock;
    const start = (currentPage - 1) * pageSize;
    return filteredStock.slice(start, start + pageSize);
  }, [filteredStock, currentPage, pageSize, isMobile]);

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | 'ellipsis')[] = [1];
    if (currentPage > 3) pages.push('ellipsis');
    for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) pages.push(p);
    if (currentPage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  };

  // Cards view groups by category (unless a single category is already filtered), each
  // group preceded by a small "CATEGORY NAME · count" header — mirrors the design system's
  // card grouping for Inventory. Cards view shows the full filtered list (no pagination
  // there — only the table view paginates).
  const cardGroups = useMemo(() => {
    if (categoryFilter !== 'all') return [{ cat: categoryFilter as BOMCategory, items: filteredStock }];
    const byCat = new Map<BOMCategory, StockRecord[]>();
    for (const r of filteredStock) {
      if (!byCat.has(r.cat)) byCat.set(r.cat, []);
      byCat.get(r.cat)!.push(r);
    }
    return allCategories.filter(cat => byCat.has(cat)).map(cat => ({ cat, items: byCat.get(cat)! }));
  }, [filteredStock, categoryFilter, allCategories]);

  const coverageCounts = useMemo(() => {
    const counts: Record<CoverageStatus, number> = { ready: 0, 'covered-by-order': 0, short: 0, conflict: 0 };
    for (const r of displayStock) counts[coverageOf(r)]++;
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayStock, demandByPartId]);

  const totalParts = displayStock.length;
  const belowCoverage = coverageCounts.short + coverageCounts.conflict;
  const incomingCount = displayStock.filter(r => r.onOrder > 0).length;
  const quarantineCount = displayStock.filter(r => (r.quarantineQty ?? 0) > 0).length;

  // Each build's BOM Line table is scoped to that build's own project BOM (fetched per-build,
  // same useQueries pattern as bomTreeQueries above) — NOT the org-wide `displayStock` list, so
  // a build only shows rows for parts actually in its BOM instead of every stocked part in the org.
  const buildBomLineQueries = useQueries({
    queries: builds.map((b) => ({
      queryKey: queryKeys.inventory.buildBomLines(orgId, b.id),
      queryFn: async () => (await inventoryService.getBuildBomLines(orgId, b.id)).map(fromApiBuildBomLine),
      staleTime: 30 * 1000,
    })),
  });

  const computedBuilds = useMemo(
    () => builds.map((def, i) => buildFromDef(def, buildBomLineQueries[i]?.data ?? [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [builds, buildBomLineQueries.map(q => q.dataUpdatedAt).join(',')]
  );

  // Which build(s) actually need a given part (i.e. it's a BOM line on that build's own
  // project BOM), with that build's own required-vs-allocated for the line — gates the
  // part-detail modal's Allocate button and scopes its build picker to only the relevant
  // builds, instead of every build in the org. Deliberately keyed off each build's own
  // ledger-tracked line.allocated (per buildId), NOT the stock row's pooled `allocated`
  // (shared across every build using this part) — a part can be fully allocated to one
  // build while a different build that also needs it still has zero, and the pooled
  // number alone can't tell those apart.
  const buildLineEntriesByPartId = useMemo(() => {
    const map = new Map<string, { build: BuildDef; required: number; allocated: number }[]>();
    computedBuilds.forEach((cb, i) => {
      const def = builds[i];
      if (!def) return;
      cb.lines.forEach((line) => {
        const list = map.get(line.partId) ?? [];
        list.push({ build: def, required: line.required, allocated: line.allocated });
        map.set(line.partId, list);
      });
    });
    return map;
  }, [computedBuilds, builds]);
  const [activeTab, setActiveTab] = useState('stock');
  const [openBuildId, setOpenBuildId] = useState<string | null>(null);
  const openBuild = (buildId: string) => { setActiveTab('builds'); setOpenBuildId(buildId); };

  const handleAddBuild = (input: NewBuildInput) => {
    createBuildMutation.mutate({
      name: input.name,
      type: input.type,
      units: input.units,
      bomRev: input.bomRev,
      scrapPct: input.scrapPct,
      milestone: input.milestone,
      targetDate: input.targetDate,
      projectId: input.projectId,
      assigneeId: input.assigneeId,
    }, {
      onSuccess: (created) => {
        openBuild(created.id);
        toast.success(`${input.name} created`);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create build'),
    });
  };

  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dialogPartId, setDialogPartId] = useState<string | undefined>(undefined);

  const openDetail = (partId: string) => { setSelectedPartId(partId); setDetailOpen(true); };
  const selectedRecord = useMemo(
    () => displayStock.find(r => r.partId === selectedPartId) ?? null,
    [displayStock, selectedPartId]
  );
  const selectedPart = parts.find(p => p.id === selectedPartId);
  const buildEntriesForSelected = selectedPartId ? (buildLineEntriesByPartId.get(selectedPartId) ?? []) : [];
  const hasBuildDemandForSelected = buildEntriesForSelected.length > 0;
  // Only offer builds that still have an outstanding shortfall on this part — a build
  // already fully covered has nothing left to allocate.
  const allocatableBuildsForSelected = buildEntriesForSelected.filter((e) => e.allocated < e.required);
  const isFullyAllocatedForSelected = hasBuildDemandForSelected && allocatableBuildsForSelected.length === 0;
  const whereUsed: WhereUsedRow[] = useMemo(() => {
    if (!selectedPartId) return [];
    return bomFlatAll(rootNodes)
      .filter(n => n._partId === selectedPartId)
      .map(n => ({ levelLabel: n.levelLabel, name: n.name, qty: n.qty, uom: n.uom, designators: n.designators || undefined }));
  }, [rootNodes, selectedPartId]);

  const openReceiveFor = (partId?: string) => { setDialogPartId(partId); setReceiveOpen(true); };
  const openAdjustFor = (partId?: string) => { setDialogPartId(partId); setAdjustOpen(true); };
  const openOrderFor = (partId?: string) => { setDialogPartId(partId); setOrderOpen(true); };

  // Mobile's Receive/New transaction shortcuts live in the app header (AppHeader), which
  // has no access to this component's local dialog state — it hands off via ?action=.
  // The BOM toolbar's build picker deep-links the same way via ?tab=builds&buildId=.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'receive') openReceiveFor();
    else if (action === 'adjust') openAdjustFor();
    else if (action === 'order') openOrderFor();

    const tab = searchParams.get('tab');
    const buildId = searchParams.get('buildId');
    if (tab === 'builds') {
      if (buildId) openBuild(buildId);
      else setActiveTab('builds');
    }

    if (action || tab || buildId) {
      setSearchParams((prev) => { prev.delete('action'); prev.delete('tab'); prev.delete('buildId'); return prev; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="relative h-full min-h-0 flex flex-col px-4 md:px-6 pt-4 pb-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
        {/* Toolbar/stat-cards/tabs plus, within the Stock tab, the search/filter/category-chip
            row are one `shrink-0` block outside the scrolling region below, so they stay
            visible together while only the table rows or card grid scroll. This relies on
            `/inventory` being a `noPadding` route (App.tsx) — a `position: sticky` block here
            would work fine visually but was dropped in favor of this simpler layout, since it
            avoids CSS sticky's "floor" being pinned to the scroll ancestor's own padding edge. */}
        <div className="shrink-0 space-y-4 md:space-y-6 pb-2">
          <div className={cn(isMobile ? undefined : 'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between')}>
            <TabsList className={cn(isMobile && 'w-full grid grid-cols-3 sticky top-0 z-10 bg-background')}>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="builds">Builds</TabsTrigger>
              <TabsTrigger value="alerts">
                Alerts
                {belowCoverage > 0 && (
                  <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-[10px]">{belowCoverage}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {isMobile ? null : (
              <div className="flex flex-wrap items-center justify-start gap-2 shrink-0 lg:justify-end">
                <Button variant="outline" onClick={() => openOrderFor()}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Order
                </Button>
                <Button variant="outline" onClick={() => openReceiveFor()}>
                  <Download className="h-4 w-4 mr-2" />
                  Receive
                </Button>
                <Button onClick={() => openAdjustFor()}>
                  <Pencil className="h-4 w-4 mr-2" />
                  <span className="truncate">New transaction</span>
                </Button>
              </div>
            )}
          </div>

          <div className={cn('gap-2.5', isMobile ? 'grid grid-cols-2' : 'flex flex-wrap md:gap-3')}>
            <StatCard label="Total Parts" value={String(totalParts)} icon={BoxesIcon} iconColor="#2563EB" accent loading={isInventoryLoading} />
            <StatCard label="Ready to Build" value={String(coverageCounts.ready)} icon={CheckCircle} iconColor="#16A34A" loading={isInventoryLoading} />
            <StatCard label="Below Coverage" value={String(belowCoverage)} icon={AlertTriangle} iconColor="#DC2626" loading={isInventoryLoading} />
            <StatCard label="Incoming This Week" value={String(incomingCount)} icon={Truck} iconColor="#D97706" loading={isInventoryLoading} />
            <StatCard label="In Quarantine" value={String(quarantineCount)} icon={Lock} iconColor="#7C3AED" loading={isInventoryLoading} />
          </div>

          {activeTab === 'stock' && (
            <div className="space-y-4">
              <div className={cn('flex gap-3', isMobile ? 'flex-row items-center' : 'flex-col lg:flex-row lg:items-center')}>
                <div className="relative w-full lg:max-w-xs lg:flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search parts, MPN, manufacturer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {isMobile ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn('h-10 w-10 shrink-0', (quickFilter !== 'all' || categoryFilter !== 'all') && 'border-primary text-primary')}
                    onClick={() => setFiltersOpen(true)}
                    title="Filters"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                ) : (
                  <>
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap lg:flex-1 pb-0.5">
                      {QUICK_FILTERS.map((f) => (
                        <button
                          key={f.value}
                          onClick={() => setQuickFilter(f.value)}
                          className={cn(
                            'shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                            quickFilter === f.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex bg-muted border border-border rounded-lg p-0.5 gap-0.5 shrink-0 self-start lg:self-auto">
                      <button
                        onClick={() => setViewMode('table')}
                        title="Table view"
                        className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border-none cursor-pointer transition-colors',
                          viewMode === 'table' ? 'bg-card text-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground')}
                      >
                        <TableIcon className="w-3.5 h-3.5" /> Table
                      </button>
                      <button
                        onClick={() => setViewMode('cards')}
                        title="Cards view"
                        className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border-none cursor-pointer transition-colors',
                          viewMode === 'cards' ? 'bg-card text-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground')}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" /> Cards
                      </button>
                    </div>
                  </>
                )}
              </div>

              {!isMobile && (
                <div className="flex items-start gap-1">
                  <div
                    className={cn(
                      'flex gap-1.5 -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5',
                      categoriesExpanded
                        ? 'flex-wrap'
                        : 'overflow-x-auto no-scrollbar flex-nowrap'
                    )}
                  >
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className={cn(
                        'shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                        categoryFilter === 'all'
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      All categories
                    </button>
                    {allCategories.map((cat) => {
                      const meta = getCategoryMeta(cat);
                      const active = categoryFilter === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setCategoryFilter(cat)}
                          className="shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                          style={active
                            ? { background: meta.tint, color: '#fff', borderColor: meta.tint }
                            : { background: 'transparent', color: meta.tint, borderColor: `${meta.tint}40` }}
                        >
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCategoriesExpanded((v) => !v)}
                    aria-label={categoriesExpanded ? 'Show fewer categories' : 'Show all categories'}
                    aria-expanded={categoriesExpanded}
                    title={categoriesExpanded ? 'Show fewer categories' : 'Show all categories'}
                    className="shrink-0 mt-0.5 p-1 rounded-full border border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', categoriesExpanded && 'rotate-180')} />
                  </button>
                </div>
              )}

              {isMobile && (
                <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <DrawerContent className="max-h-[85vh]">
                    <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-foreground" />
                        <DrawerTitle className="text-base font-semibold">Filter parts</DrawerTitle>
                      </div>
                      <button
                        onClick={() => { setQuickFilter('all'); setCategoryFilter('all'); }}
                        className="text-sm font-medium text-primary"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="overflow-y-auto px-4 py-4 space-y-5">
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</h4>
                        <div className="flex flex-wrap gap-2">
                          {QUICK_FILTERS.map((f) => {
                            const active = quickFilter === f.value;
                            return (
                              <button
                                key={f.value}
                                onClick={() => setQuickFilter(f.value)}
                                className={cn(
                                  'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors',
                                  active
                                    ? 'bg-foreground text-background border-foreground'
                                    : 'bg-background text-foreground border-input'
                                )}
                              >
                                {f.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</h4>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setCategoryFilter('all')}
                            className={cn(
                              'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors',
                              categoryFilter === 'all'
                                ? 'bg-foreground text-background border-foreground'
                                : 'bg-background text-foreground border-input'
                            )}
                          >
                            All categories
                          </button>
                          {allCategories.map((cat) => {
                            const meta = getCategoryMeta(cat);
                            const active = categoryFilter === cat;
                            return (
                              <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={cn(
                                  'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors',
                                  active
                                    ? 'bg-foreground text-background border-foreground'
                                    : 'bg-background text-foreground border-input'
                                )}
                              >
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.tint }} />
                                {meta.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <DrawerFooter className="pt-2">
                      <Button className="w-full" onClick={() => setFiltersOpen(false)}>Show results</Button>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              )}
            </div>
          )}
        </div>

        {/* No `flex`/display utility directly on TabsContent: Radix hides inactive panels via
            the `hidden` attribute (implicit `display: none`), and a class-based `display` value
            has equal CSS specificity but wins as author CSS over that UA default — so an
            inactive-but-still-mounted panel with `flex` on it stays a real (empty) flex item,
            silently eating a share of `flex-1` space from whichever tab actually is active. The
            flex column lives on this inner div instead. */}
        <TabsContent value="stock" className="mt-1 flex-1 min-h-0">
          <div className="h-full min-h-0 flex flex-col">
          {/* This wrapper only bounds the height — each view branch below owns its own
            scroll region so the table can keep its header row pinned (`position: sticky`
            needs the scrolling ancestor to be *inside* the branch, not this shared div). */}
          <div className="flex-1 min-h-0 overflow-hidden">
              {isMobile ? (
                <div className="h-full overflow-y-auto space-y-5 pb-4">
                  {isInventoryLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={`skeleton-${i}`} className="rounded-xl border border-border bg-card p-3">
                          <div className="flex items-start gap-2.5">
                            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-20" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : cardGroups.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <PackageSearch className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <div className="text-sm">No parts match your filters</div>
                    </div>
                  ) : cardGroups.map(({ cat, items }) => {
                    const groupMeta = getCategoryMeta(cat);
                    return (
                      <div key={cat}>
                        {categoryFilter === 'all' && (
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: groupMeta.tint }} />
                            <span className="text-xs font-bold uppercase tracking-wide text-foreground">{groupMeta.label}</span>
                            <span className="text-xs text-muted-foreground">{items.length}</span>
                          </div>
                        )}
                        <div className="space-y-2">
                          {items.map((r) => {
                            const available = availableOf(r);
                            const status = coverageOf(r);
                            return (
                              <button
                                key={r.id}
                                onClick={() => openDetail(r.partId)}
                                className="w-full text-left rounded-xl border border-border bg-card p-3 active:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-start gap-2.5">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Layers className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-foreground truncate">{r.name}</div>
                                    <div className="text-xs font-mono text-muted-foreground truncate">{r.pn}</div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <CoveragePill status={status} />
                                    <span className="text-[11px] text-muted-foreground truncate max-w-[110px]">{r.location}</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 pt-2.5 mt-2.5 border-t border-border">
                                  <div>
                                    <div className="text-sm font-semibold">{r.onHand}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">On Hand</div>
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold">{r.allocated}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Alloc</div>
                                  </div>
                                  <div>
                                    <div className={cn('text-sm font-semibold', available < 0 && 'text-destructive')}>{available}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Avail</div>
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold">{r.onOrder || '—'}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Order</div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : viewMode === 'table' ? (
                <div className="border rounded-lg overflow-hidden h-full flex flex-col">
                  <Table containerClassName="flex-1 min-h-0">
                    <TableHeader className="sticky top-0 z-20 bg-background [&_th]:bg-background">
                      <TableRow>
                        <TableHead className="h-9 px-3 py-2 w-[120px] text-[11px] font-medium uppercase tracking-wider">Coverage</TableHead>
                        <TableHead className="h-9 px-3 py-2 w-[260px] text-[11px] font-medium uppercase tracking-wider">Part</TableHead>
                        <TableHead className="h-9 px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider"><HeaderTip label="On Hand" /></TableHead>
                        <TableHead className="hidden sm:table-cell h-9 px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider"><HeaderTip label="Allocated" /></TableHead>
                        <TableHead className="h-9 px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider"><HeaderTip label="Available" /></TableHead>
                        <TableHead className="hidden md:table-cell h-9 px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider"><HeaderTip label="On Order" /></TableHead>
                        <TableHead className="h-9 px-3 py-2 text-[11px] font-medium uppercase tracking-wider">Location</TableHead>

                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isInventoryLoading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                          <TableRow key={`skeleton-${i}`}>
                            <TableCell className="px-3 py-2 align-top">
                              <Skeleton className="h-5 w-16 mb-1.5" />
                              <Skeleton className="h-1.5 w-full" />
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                                <div className="min-w-0 flex-1 space-y-1.5">
                                  <Skeleton className="h-4 w-32" />
                                  <Skeleton className="h-3 w-20" />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                            <TableCell className="hidden sm:table-cell px-3 py-2 text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                            <TableCell className="px-3 py-2 text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                            <TableCell className="hidden md:table-cell px-3 py-2 text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                            <TableCell className="px-3 py-2"><Skeleton className="h-5 w-16" /></TableCell>
                            <TableCell className="hidden lg:table-cell px-3 py-2"><Skeleton className="h-4 w-12" /></TableCell>
                          </TableRow>
                        ))
                      ) : filteredStock.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                            <PackageSearch className="h-6 w-6 mx-auto mb-2 opacity-50" />
                            No parts match your filters
                          </TableCell>
                        </TableRow>
                      ) : paginatedStock.map((r) => {
                        const available = availableOf(r);
                        const status = coverageOf(r);
                        return (
                          <TableRow key={r.id} className="cursor-pointer" onClick={() => openDetail(r.partId)}>
                            <TableCell className="px-3 py-2 align-top">
                              <CoveragePill status={status} />
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <HoverZoomImage imageUrl={r.imageUrl} enabled={!!r.imageUrl}>
                                  <PartThumb cat={r.cat} size={32} radius={7} imageUrl={r.imageUrl} />
                                </HoverZoomImage>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-foreground truncate">{r.name}</div>
                                  <div className="text-xs font-mono text-muted-foreground truncate">{r.pn}</div>
                                  {(r.lotNumber || r.serialNumber) && (
                                    <div className="text-[10px] text-muted-foreground truncate">
                                      {r.lotNumber && <>Lot {r.lotNumber}</>}
                                      {r.lotNumber && r.serialNumber && ' · '}
                                      {r.serialNumber && <>SN {r.serialNumber}</>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right">{r.onHand}</TableCell>
                            <TableCell className="hidden sm:table-cell px-3 py-2 text-right">{r.allocated}</TableCell>
                            <TableCell className={cn('px-3 py-2 text-right font-semibold', available < 0 && 'text-destructive')}>
                              {available}
                            </TableCell>
                            <TableCell className="hidden md:table-cell px-3 py-2 text-right">{r.onOrder || '—'}</TableCell>
                            <TableCell className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-[10px] font-normal">{r.location}</Badge>
                                {r.quarantineQty ? <Badge variant="outline" className="text-[10px] font-normal"><Lock className="h-2.5 w-2.5 mr-1" />QA</Badge> : null}
                                {wantToOrderPartIds.has(r.partId) ? (
                                  <Badge variant="outline" className="text-[10px] font-normal border-amber-500/30 bg-amber-500/10 text-amber-600">
                                    <Clock className="h-2.5 w-2.5 mr-1" />Want to order
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>

                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="h-full overflow-y-auto space-y-5 pb-4">
                  {isInventoryLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={`skeleton-${i}`} className="rounded-xl border border-border bg-card p-3">
                          <div className="flex items-start gap-2.5">
                            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-20" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : cardGroups.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <PackageSearch className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <div className="text-sm">No parts match your filters</div>
                    </div>
                  ) : cardGroups.map(({ cat, items }) => {
                    const groupMeta = getCategoryMeta(cat);
                    return (
                      <div key={cat}>
                        {categoryFilter === 'all' && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: groupMeta.tint }} />
                            <span className="text-xs font-bold uppercase tracking-wide text-foreground">{groupMeta.label}</span>
                            <span className="text-xs text-muted-foreground">{items.length}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {items.map((r) => {
                            const available = availableOf(r);
                            const status = coverageOf(r);
                            return (
                              <Card
                                key={r.id}
                                className="cursor-pointer hover:shadow-sm transition-shadow rounded-xl"
                                onClick={() => openDetail(r.partId)}
                              >
                                <CardContent className="p-4 space-y-3">
                                  <div className="flex items-start gap-2.5">
                                    <PartThumb cat={r.cat} size={40} radius={8} imageUrl={r.imageUrl} />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-semibold truncate" style={{ color: groupMeta.tint }}>{r.pn}</div>
                                      <div className="text-sm font-semibold text-foreground truncate">{r.name}</div>
                                      {(r.lotNumber || r.serialNumber) && (
                                        <div className="text-[10px] text-muted-foreground truncate">
                                          {r.lotNumber && <>Lot {r.lotNumber}</>}
                                          {r.lotNumber && r.serialNumber && ' · '}
                                          {r.serialNumber && <>SN {r.serialNumber}</>}
                                        </div>
                                      )}
                                    </div>
                                    {(r.lotNumber || r.serialNumber) && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] font-medium gap-1 shrink-0"
                                        style={{ color: '#7C3AED', borderColor: 'rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)' }}
                                      >
                                        <Layers className="h-2.5 w-2.5" /> {r.lotNumber && r.serialNumber ? 'Lot/SN' : r.lotNumber ? 'Lot' : 'SN'}
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between gap-2">
                                    <CoveragePill status={status} />
                                    <div className="flex items-center gap-1 flex-wrap justify-end">
                                      <Badge variant="outline" className="text-[10px] font-normal">{r.location}</Badge>
                                      {r.quarantineQty ? <Badge variant="outline" className="text-[10px] font-normal"><Lock className="h-2.5 w-2.5 mr-1" />QA</Badge> : null}
                                      {wantToOrderPartIds.has(r.partId) ? (
                                        <Badge variant="outline" className="text-[10px] font-normal border-amber-500/30 bg-amber-500/10 text-amber-600">
                                          <Clock className="h-2.5 w-2.5 mr-1" />Want to order
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-4 gap-2 pt-2.5 border-t border-border">
                                    <div>
                                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide"><HeaderTip label="On Hand" /></div>
                                      <div className="text-sm font-semibold">{r.onHand}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide"><HeaderTip label="Allocated" /></div>
                                      <div className="text-sm font-semibold">{r.allocated}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide"><HeaderTip label="Available" /></div>
                                      <div className={cn('text-sm font-semibold', available < 0 && 'text-destructive')}>{available}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide"><HeaderTip label="On Order" /></div>
                                      <div className="text-sm font-semibold">{r.onOrder || '—'}</div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>

              {!isMobile && viewMode === 'table' && filteredStock.length > 0 && (
                <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>
                      Showing {Math.min((currentPage - 1) * pageSize + 1, filteredStock.length)}–{Math.min(currentPage * pageSize, filteredStock.length)} of {filteredStock.length}
                    </span>
                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                      <SelectTrigger className="h-7 w-[92px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 / page</SelectItem>
                        <SelectItem value="25">25 / page</SelectItem>
                        <SelectItem value="50">50 / page</SelectItem>
                        <SelectItem value="100">100 / page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Pagination className="mx-0 w-auto">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.max(1, p - 1)); }}
                          className={cn(currentPage === 1 && 'pointer-events-none opacity-50')}
                        />
                      </PaginationItem>
                      {getPageNumbers().map((page, idx) =>
                        page === 'ellipsis' ? (
                          <PaginationItem key={`ellipsis-${idx}`}>
                            <span className="flex h-9 w-9 items-center justify-center text-muted-foreground">…</span>
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              isActive={page === currentPage}
                              onClick={(e) => { e.preventDefault(); setCurrentPage(page); }}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      )}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.min(totalPages, p + 1)); }}
                          className={cn(currentPage === totalPages && 'pointer-events-none opacity-50')}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
          </div>
        </TabsContent>

        <TabsContent value="builds" className="mt-4 flex-1 min-h-0 overflow-y-auto">
          <BuildsPanel
            orgId={orgId}
            builds={computedBuilds}
            onSelectPart={openDetail}
            openBuildId={openBuildId}
            onOpenBuildHandled={() => setOpenBuildId(null)}
            onAddBuild={handleAddBuild}
            projects={projects}
          />
        </TabsContent>

        <TabsContent value="alerts" className="mt-4 flex-1 min-h-0 overflow-y-auto">
          <AlertsPanel
            builds={computedBuilds}
            stock={displayStock}
            coverageOf={coverageOf}
            onSelectPart={openDetail}
            onSelectBuild={openBuild}
            onViewBuilds={() => setActiveTab('builds')}
          />
        </TabsContent>
      </Tabs>

      <ReceiveStockDialog
        isOpen={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        orgId={orgId}
        parts={stockedParts}
        orders={orders}
        onReceive={handleReceive}
        initialPartId={dialogPartId}
        canonicalLocationByPartId={canonicalLocationByPartId}
      />
      <AdjustQuantityDialog
        isOpen={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        orgId={orgId}
        stock={displayStock}
        parts={parts}
        partProjects={projectsByPartId}
        partDemand={demandByPartId}
        onAdjust={handleAdjust}
        onPlaceOrder={handlePlaceOrder}
        initialPartId={dialogPartId}
        canonicalLocationByPartId={canonicalLocationByPartId}
      />
      <PlaceOrderDialog
        isOpen={orderOpen}
        onClose={() => setOrderOpen(false)}
        orgId={orgId}
        parts={stockedParts}
        onPlaceOrder={handlePlaceOrder}
        initialPartId={dialogPartId}
        canonicalLocationByPartId={canonicalLocationByPartId}
      />
      <IssueStockDialog
        isOpen={issueOpen}
        onClose={() => setIssueOpen(false)}
        orgId={orgId}
        record={selectedRecord}
        onIssue={handleIssue}
      />
      <TransferStockDialog
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        orgId={orgId}
        record={selectedRecord}
        onTransfer={handleTransfer}
      />
      <AllocateStockDialog
        isOpen={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        record={selectedRecord}
        builds={allocatableBuildsForSelected}
        onAllocate={(input) => selectedRecord && handleAllocate(selectedRecord.id, input)}
      />
      <PartDetailSheet
        isOpen={detailOpen}
        record={selectedRecord}
        status={selectedRecord ? coverageOf(selectedRecord) : 'ready'}
        part={selectedPart}
        transactions={transactions}
        members={members}
        orders={orders}
        whereUsed={whereUsed}
        hasBuildDemand={hasBuildDemandForSelected}
        isFullyAllocated={isFullyAllocatedForSelected}
        onClose={() => setDetailOpen(false)}
        onReceive={() => openReceiveFor(selectedPartId ?? undefined)}
        onAdjust={() => openAdjustFor(selectedPartId ?? undefined)}
        onOrder={() => openOrderFor(selectedPartId ?? undefined)}
        onIssue={() => setIssueOpen(true)}
        onTransfer={() => setTransferOpen(true)}
        onAllocate={() => setAllocateOpen(true)}
        onReleaseQuarantine={(qty) => selectedRecord && handleReleaseQuarantine(selectedRecord.id, qty)}
        onMarkOrdered={handleMarkOrdered}
      />
    </div>
  );
}
