import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search, Table as TableIcon, LayoutGrid, Download, Pencil, PackageSearch,
  AlertTriangle, Truck, CheckCircle, Lock, Boxes as BoxesIcon, Layers, SlidersHorizontal, ShoppingCart,
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
  useReceiveStock, useAdjustStock, useReleaseQuarantine, usePlaceOrder, useCreateInventoryBuild,
} from '@/hooks/useInventory';
import {
  fromApiNode, applyPriceRollup, assignLevelLabels, bomFlatAll, formatLeadTime,
  KNOWN_BOM_CATEGORIES, getCategoryMeta, type BOMCategory,
} from './bomData';
import {
  buildFromDef, computeCoverage, availableOf, onOrderOf,
  CoveragePill, CoverageBar,
  type StockRecord, type CoverageStatus,
} from './inventoryData';
import { HoverZoomImage, PartThumb } from './BOMShared';
import { ReceiveStockDialog, type ReceiveStockInput } from './ReceiveStockDialog';
import { AdjustQuantityDialog, type AdjustQuantityInput } from './AdjustQuantityDialog';
import { PlaceOrderDialog, type PlaceOrderInput } from './PlaceOrderDialog';
import { PartDetailSheet, type WhereUsedRow } from './PartDetailSheet';
import { BuildsPanel } from './BuildsPanel';
import { AlertsPanel } from './AlertsPanel';
import type { NewBuildInput } from './NewBuildDialog';

const STAT_TOOLTIPS: Record<string, string> = {
  'On Hand': 'Physical quantity currently in stock, including anything held in quarantine.',
  'Allocated': 'Quantity already reserved against BOM demand for planned builds.',
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
  const createBuildMutation = useCreateInventoryBuild(orgId);

  // `onOrder` is derived from live order state rather than the static seeded field, so
  // Receive/Order actions are reflected immediately without touching stock rows directly.
  // Note: `allocated` is intentionally left as-is here (always 0 from the backend, which never
  // writes reservations) — `availableOf`/`computeCoverage` already subtract BOM demand via the
  // `demandByPartId` param, so overriding `allocated` with that same demand would double-count it.
  const displayStock = useMemo(
    () => stock.map(r => ({ ...r, onOrder: onOrderOf(orders, r.partId) })),
    [stock, orders]
  );

  // Receive/Place order only make sense for parts that already have a stock row — a part that
  // only exists inside a BOM and has never been stocked isn't orderable/receivable yet.
  const stockedParts = useMemo(() => {
    const stockPartIds = new Set(stock.map(r => r.partId));
    return parts.filter(p => stockPartIds.has(p.id));
  }, [parts, stock]);

  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(isMobile ? 'cards' : 'table');
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  const handleReceive = (input: ReceiveStockInput) => {
    receiveStockMutation.mutate({
      partId: input.partId,
      location: input.location,
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
      supplierRef: input.supplierRef,
      unitCost: input.unitCost,
      location: input.location,
      note: input.note,
      description: input.description,
      purpose: input.purpose,
      lotNumber: input.lotNumber,
      serialNumber: input.serialNumber,
    }, {
      onSuccess: () => toast.success(`Order placed for ${input.quantity} × ${input.pn}`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to place order'),
    });
  };

  const handleReleaseQuarantine = (recordId: string, qty: number) => {
    releaseQuarantineMutation.mutate({ stockId: recordId, qty }, {
      onSuccess: () => toast.success(`Released ${qty} from quarantine`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to release quarantine'),
    });
  };

  const handleAdjust = (input: AdjustQuantityInput) => {
    const dto = {
      partId: input.partId,
      location: input.location,
      direction: input.direction,
      quantity: input.quantity,
      reasonCode: input.reasonCode,
      note: input.note,
      description: input.description,
      lotNumber: input.lotNumber,
      serialNumber: input.serialNumber,
    };
    console.table(Object.entries(dto).map(([field, value]) => ({ field, value: JSON.stringify(value), type: typeof value })));
    adjustStockMutation.mutate(dto, {
      onSuccess: (result) => {
        toast.success('Adjustment posted');
        if (input.image && result.transactionId) {
          attachmentsService
            .upload({ entityId: result.transactionId, entityType: 'inventory_transaction', file: input.image })
            .catch(() => toast.error('Adjustment saved, but the image failed to upload'));
        }
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to post adjustment'),
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

  // Cards view groups by category (unless a single category is already filtered), each
  // group preceded by a small "CATEGORY NAME · count" header — mirrors the design system's
  // card grouping for Inventory.
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
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'receive') openReceiveFor();
    else if (action === 'adjust') openAdjustFor();
    else if (action === 'order') openOrderFor();
    if (action) {
      setSearchParams((prev) => { prev.delete('action'); return prev; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="space-y-4 md:space-y-6 px-4 md:px-6 pb-6">
      {isMobile ? null : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
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
        </div>
      )}

      <div className={cn('gap-2.5', isMobile ? 'grid grid-cols-2' : 'flex flex-wrap md:gap-3')}>
        <StatCard label="Total Parts" value={String(totalParts)} icon={BoxesIcon} iconColor="#2563EB" accent loading={isInventoryLoading} />
        <StatCard label="Ready to Build" value={String(coverageCounts.ready)} icon={CheckCircle} iconColor="#16A34A" loading={isInventoryLoading} />
        <StatCard label="Below Coverage" value={String(belowCoverage)} icon={AlertTriangle} iconColor="#DC2626" loading={isInventoryLoading} />
        <StatCard label="Incoming This Week" value={String(incomingCount)} icon={Truck} iconColor="#D97706" loading={isInventoryLoading} />
        <StatCard label="In Quarantine" value={String(quarantineCount)} icon={Lock} iconColor="#7C3AED" loading={isInventoryLoading} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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

        <TabsContent value="stock" className="mt-4">
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
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap pb-0.5">
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

              {isMobile ? (
                <div className="space-y-5">
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
                                    <div className="text-sm font-semibold">{demandByPartId.get(r.partId) ?? 0}</div>
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
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-9 px-3 py-2 w-[120px] text-[11px] font-medium uppercase tracking-wider">Coverage</TableHead>
                        <TableHead className="h-9 px-3 py-2 w-[260px] text-[11px] font-medium uppercase tracking-wider">Part</TableHead>
                        <TableHead className="h-9 px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider"><HeaderTip label="On Hand" /></TableHead>
                        <TableHead className="hidden sm:table-cell h-9 px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider"><HeaderTip label="Allocated" /></TableHead>
                        <TableHead className="h-9 px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider"><HeaderTip label="Available" /></TableHead>
                        <TableHead className="hidden md:table-cell h-9 px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider"><HeaderTip label="On Order" /></TableHead>
                        <TableHead className="h-9 px-3 py-2 text-[11px] font-medium uppercase tracking-wider">Location</TableHead>
                        <TableHead className="hidden lg:table-cell h-9 px-3 py-2 text-[11px] font-medium uppercase tracking-wider">Lead</TableHead>
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
                      ) : filteredStock.map((r) => {
                        const available = availableOf(r);
                        const status = coverageOf(r);
                        return (
                          <TableRow key={r.id} className="cursor-pointer" onClick={() => openDetail(r.partId)}>
                            <TableCell className="px-3 py-2 align-top">
                              <CoveragePill status={status} />
                              <CoverageBar status={status} record={r} />
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
                            <TableCell className="hidden sm:table-cell px-3 py-2 text-right">{demandByPartId.get(r.partId) ?? 0}</TableCell>
                            <TableCell className={cn('px-3 py-2 text-right font-semibold', available < 0 && 'text-destructive')}>
                              {available}
                            </TableCell>
                            <TableCell className="hidden md:table-cell px-3 py-2 text-right">{r.onOrder || '—'}</TableCell>
                            <TableCell className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-[10px] font-normal">{r.location}</Badge>
                                {r.quarantineQty ? <Badge variant="outline" className="text-[10px] font-normal"><Lock className="h-2.5 w-2.5 mr-1" />QA</Badge> : null}
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell px-3 py-2 text-xs text-muted-foreground">{formatLeadTime(r.leadTimeDays)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {filteredStock.length > 0 && (
                    <div className="px-3 py-2.5 border-t border-border text-xs text-muted-foreground">
                      Showing {filteredStock.length} of {totalParts} total parts
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
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
                                    </div>
                                  </div>

                                  <CoverageBar status={status} record={r} />

                                  <div className="grid grid-cols-4 gap-2 pt-2.5 border-t border-border">
                                    <div>
                                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide"><HeaderTip label="On Hand" /></div>
                                      <div className="text-sm font-semibold">{r.onHand}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide"><HeaderTip label="Allocated" /></div>
                                      <div className="text-sm font-semibold">{demandByPartId.get(r.partId) ?? 0}</div>
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
        </TabsContent>

        <TabsContent value="builds" className="mt-4">
          <BuildsPanel
            orgId={orgId}
            builds={computedBuilds}
            onSelectPart={openDetail}
            openBuildId={openBuildId}
            onOpenBuildHandled={() => setOpenBuildId(null)}
            onAddBuild={handleAddBuild}
            onGenerateShortageOrder={openOrderFor}
            projects={projects}
          />
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
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
      />
      <AdjustQuantityDialog
        isOpen={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        orgId={orgId}
        stock={displayStock}
        parts={parts}
        partProjects={projectsByPartId}
        onAdjust={handleAdjust}
        onPlaceOrder={handlePlaceOrder}
        initialPartId={dialogPartId}
      />
      <PlaceOrderDialog
        isOpen={orderOpen}
        onClose={() => setOrderOpen(false)}
        orgId={orgId}
        parts={stockedParts}
        onPlaceOrder={handlePlaceOrder}
        initialPartId={dialogPartId}
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
        onClose={() => setDetailOpen(false)}
        onReceive={() => openReceiveFor(selectedPartId ?? undefined)}
        onAdjust={() => openAdjustFor(selectedPartId ?? undefined)}
        onOrder={() => openOrderFor(selectedPartId ?? undefined)}
        onReleaseQuarantine={(qty) => selectedRecord && handleReleaseQuarantine(selectedRecord.id, qty)}
      />
    </div>
  );
}
