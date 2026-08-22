import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import type { StockRecord, OrderRecord, StockTransaction, BuildDef, BuildBomLine } from '@/features/projects/components/inventoryData';

// ─── API response shapes (match backend inventory.types.ts responses) ─────────

export interface ApiStockRecord {
  id: string;
  partId: string;
  pn: string;
  name: string;
  cat: string;
  onHand: number;
  allocated: number;
  onOrder: number;
  location: string;
  leadTimeDays: number;
  lotNumber: string | null;
  serialNumber: string | null;
  quarantineQty: number;
  transactionId?: string;
}

export interface ApiOrderRecord {
  id: string;
  partId: string;
  pn: string;
  quantity: number;
  remainingQty: number;
  expectedDate: string;
  supplierRef: string | null;
  unitCost: number | null;
  location: string;
  note: string | null;
  description: string | null;
  purpose: string | null;
  lotNumber: string | null;
  serialNumber: string | null;
  status: 'open' | 'partially_received' | 'received' | 'cancelled';
  createdAt: string;
  createdBy: string;
}

export interface ApiStockTransaction {
  id: string;
  partId: string;
  type: 'receive' | 'adjust' | 'allocate' | 'deallocate';
  direction: 'add' | 'remove' | null;
  qty: number;
  location: string;
  reference: string | null;
  reasonCode: string | null;
  note: string | null;
  description: string | null;
  quarantine: boolean;
  createdAt: string;
  createdBy: string;
}

export interface ApiBuildDef {
  id: string;
  projectId: string;
  name: string;
  type: string;
  units: number;
  bomRev: string;
  scrapPct: number;
  milestone: string | null;
  targetDate: string | null;
  status: 'planned' | 'allocated' | 'kitted';
}

export interface ApiBuildBomLine {
  partId: string;
  pn: string;
  name: string;
  cat: string;
  qtyPerUnit: number;
  uom: string;
  onHand: number;
  allocated: number;
  onOrder: number;
  leadTimeDays: number;
  required: number;
  shortage: number;
}

export interface ApiAllocateBuildLineResult {
  partId: string;
  pn: string;
  required: number;
  allocated: number;
  shortage: number;
}

export interface ApiAllocateBuildResponse {
  build: ApiBuildDef;
  lines: ApiAllocateBuildLineResult[];
  fullyAllocated: boolean;
}

// ─── Adapters ───────────────────────────────────────────────────────────────────

export function fromApiStock(r: ApiStockRecord): StockRecord {
  return {
    id: r.id,
    partId: r.partId,
    pn: r.pn,
    name: r.name,
    cat: r.cat,
    onHand: r.onHand,
    allocated: r.allocated,
    onOrder: r.onOrder,
    location: r.location,
    leadTimeDays: r.leadTimeDays,
    lotNumber: r.lotNumber ?? undefined,
    serialNumber: r.serialNumber ?? undefined,
    quarantineQty: r.quarantineQty || undefined,
  };
}

export function fromApiOrder(r: ApiOrderRecord): OrderRecord {
  return {
    id: r.id,
    partId: r.partId,
    pn: r.pn,
    quantity: r.quantity,
    remainingQty: r.remainingQty,
    expectedDate: r.expectedDate,
    supplierRef: r.supplierRef ?? undefined,
    unitCost: r.unitCost ?? undefined,
    location: r.location,
    note: r.note ?? undefined,
    description: r.description ?? undefined,
    purpose: r.purpose ?? undefined,
    lotNumber: r.lotNumber ?? undefined,
    serialNumber: r.serialNumber ?? undefined,
    status: r.status,
    createdAt: r.createdAt,
    createdBy: r.createdBy,
  };
}

export function fromApiTransaction(r: ApiStockTransaction): StockTransaction {
  return {
    id: r.id,
    partId: r.partId,
    type: r.type,
    direction: r.direction ?? undefined,
    qty: r.qty,
    location: r.location,
    reference: r.reference ?? undefined,
    reasonCode: r.reasonCode ?? undefined,
    note: r.note ?? undefined,
    description: r.description ?? undefined,
    quarantine: r.quarantine,
    createdAt: r.createdAt,
    createdBy: r.createdBy,
  };
}

export function fromApiBuild(r: ApiBuildDef): BuildDef {
  return {
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    type: r.type,
    units: r.units,
    bomRev: r.bomRev,
    scrapPct: r.scrapPct,
    milestone: r.milestone ?? '',
    targetDate: r.targetDate ?? undefined,
    status: r.status,
  };
}

export function fromApiBuildBomLine(r: ApiBuildBomLine): BuildBomLine {
  return {
    partId: r.partId,
    pn: r.pn,
    name: r.name,
    cat: r.cat as BuildBomLine['cat'],
    qtyPerUnit: r.qtyPerUnit,
    uom: r.uom,
    onHand: r.onHand,
    allocated: r.allocated,
    onOrder: r.onOrder,
    leadTimeDays: r.leadTimeDays,
    required: r.required,
    shortage: r.shortage,
  };
}

// ─── Request DTOs ──────────────────────────────────────────────────────────────

export interface ReceiveStockDto {
  partId: string;
  location: string;
  quantity: number;
  reference?: string;
  quarantine: boolean;
  note?: string;
  orderId?: string;
  lotNumber?: string;
  serialNumber?: string;
}

export interface AdjustQuantityDto {
  partId: string;
  location: string;
  direction: 'add' | 'remove';
  quantity: number;
  reasonCode: string;
  note?: string;
  description?: string;
  lotNumber?: string;
  serialNumber?: string;
}

export interface PlaceOrderDto {
  partId: string;
  quantity: number;
  expectedDate: string;
  supplierRef?: string;
  unitCost?: number;
  location: string;
  note?: string;
  description?: string;
  purpose?: string;
  lotNumber?: string;
  serialNumber?: string;
}

export interface CreateBuildDto {
  name: string;
  type: string;
  units: number;
  bomRev: string;
  scrapPct: number;
  milestone?: string;
  targetDate?: string;
}

// ─── Service ────────────────────────────────────────────────────────────────────

export const inventoryService = {
  async listStock(orgId: string): Promise<ApiStockRecord[]> {
    return apiClient.get<ApiStockRecord[]>(ENDPOINTS.INVENTORY.STOCK(orgId));
  },

  async listOrders(orgId: string): Promise<ApiOrderRecord[]> {
    return apiClient.get<ApiOrderRecord[]>(ENDPOINTS.INVENTORY.ORDERS(orgId));
  },

  async listTransactions(orgId: string): Promise<ApiStockTransaction[]> {
    return apiClient.get<ApiStockTransaction[]>(ENDPOINTS.INVENTORY.TRANSACTIONS(orgId));
  },

  async listBuilds(orgId: string): Promise<ApiBuildDef[]> {
    return apiClient.get<ApiBuildDef[]>(ENDPOINTS.INVENTORY.BUILDS(orgId));
  },

  async getBuildBomLines(orgId: string, buildId: string): Promise<ApiBuildBomLine[]> {
    return apiClient.get<ApiBuildBomLine[]>(ENDPOINTS.INVENTORY.BUILD_BOM_LINES(orgId, buildId));
  },

  async createBuild(projectId: string, dto: CreateBuildDto): Promise<ApiBuildDef> {
    return apiClient.post<ApiBuildDef>(ENDPOINTS.INVENTORY.BUILDS_CREATE(projectId), dto);
  },

  async receiveStock(orgId: string, dto: ReceiveStockDto): Promise<ApiStockRecord> {
    return apiClient.post<ApiStockRecord>(ENDPOINTS.INVENTORY.RECEIVE(orgId), dto);
  },

  async adjustStock(orgId: string, dto: AdjustQuantityDto): Promise<ApiStockRecord> {
    return apiClient.post<ApiStockRecord>(ENDPOINTS.INVENTORY.ADJUST(orgId), dto);
  },

  async releaseQuarantine(orgId: string, stockId: string, qty: number): Promise<ApiStockRecord> {
    return apiClient.post<ApiStockRecord>(ENDPOINTS.INVENTORY.RELEASE_QUARANTINE(orgId, stockId), { qty });
  },

  async placeOrder(orgId: string, dto: PlaceOrderDto): Promise<ApiOrderRecord> {
    return apiClient.post<ApiOrderRecord>(ENDPOINTS.INVENTORY.PLACE_ORDER(orgId), dto);
  },

  async allocateBuild(orgId: string, buildId: string): Promise<ApiAllocateBuildResponse> {
    return apiClient.post<ApiAllocateBuildResponse>(ENDPOINTS.INVENTORY.ALLOCATE_BUILD(orgId, buildId), {});
  },

  async kitBuild(orgId: string, buildId: string): Promise<ApiBuildDef> {
    return apiClient.post<ApiBuildDef>(ENDPOINTS.INVENTORY.KIT_BUILD(orgId, buildId), {});
  },
};
