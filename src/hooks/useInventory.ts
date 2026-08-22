import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import {
  inventoryService,
  fromApiStock,
  fromApiOrder,
  fromApiTransaction,
  fromApiBuild,
  fromApiBuildBomLine,
  type ReceiveStockDto,
  type AdjustQuantityDto,
  type PlaceOrderDto,
  type CreateBuildDto,
} from '@/services/inventory.service';

export function useInventoryStock(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.inventory.stock(orgId ?? ''),
    queryFn:  async () => (await inventoryService.listStock(orgId!)).map(fromApiStock),
    enabled:  !!orgId,
    staleTime: 30 * 1000,
  });
}

export function useInventoryOrders(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.inventory.orders(orgId ?? ''),
    queryFn:  async () => (await inventoryService.listOrders(orgId!)).map(fromApiOrder),
    enabled:  !!orgId,
    staleTime: 30 * 1000,
  });
}

export function useInventoryTransactions(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.inventory.transactions(orgId ?? ''),
    queryFn:  async () => (await inventoryService.listTransactions(orgId!)).map(fromApiTransaction),
    enabled:  !!orgId,
    staleTime: 30 * 1000,
  });
}

export function useInventoryBuilds(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.inventory.builds(orgId ?? ''),
    queryFn:  async () => (await inventoryService.listBuilds(orgId!)).map(fromApiBuild),
    enabled:  !!orgId,
  });
}

// BOM lines for a single build, scoped to that build's own project BOM — see
// inventory.service.ts (backend) getBuildBomLines / inventoryData.tsx buildFromDef.
export function useBuildBomLines(orgId: string | undefined, buildId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.inventory.buildBomLines(orgId ?? '', buildId ?? ''),
    queryFn:  async () => (await inventoryService.getBuildBomLines(orgId!, buildId!)).map(fromApiBuildBomLine),
    enabled:  !!orgId && !!buildId,
    staleTime: 30 * 1000,
  });
}

function invalidateInventory(queryClient: ReturnType<typeof useQueryClient>, orgId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.inventory.stock(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.inventory.orders(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.inventory.transactions(orgId) });
}

export function useReceiveStock(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: ReceiveStockDto) => inventoryService.receiveStock(orgId, dto),
    onSuccess: () => invalidateInventory(queryClient, orgId),
  });
}

export function useAdjustStock(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: AdjustQuantityDto) => inventoryService.adjustStock(orgId, dto),
    onSuccess: () => invalidateInventory(queryClient, orgId),
  });
}

export function useReleaseQuarantine(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stockId, qty }: { stockId: string; qty: number }) =>
      inventoryService.releaseQuarantine(orgId, stockId, qty),
    onSuccess: () => invalidateInventory(queryClient, orgId),
  });
}

export function usePlaceOrder(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: PlaceOrderDto) => inventoryService.placeOrder(orgId, dto),
    onSuccess: () => invalidateInventory(queryClient, orgId),
  });
}

export function useCreateInventoryBuild(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...dto }: CreateBuildDto & { projectId: string }) =>
      inventoryService.createBuild(projectId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.builds(orgId) });
    },
  });
}

function invalidateBuild(queryClient: ReturnType<typeof useQueryClient>, orgId: string, buildId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.inventory.builds(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.inventory.buildBomLines(orgId, buildId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.inventory.stock(orgId) });
}

export function useAllocateBuild(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (buildId: string) => inventoryService.allocateBuild(orgId, buildId),
    onSuccess: (_data, buildId) => invalidateBuild(queryClient, orgId, buildId),
  });
}

export function useKitBuild(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (buildId: string) => inventoryService.kitBuild(orgId, buildId),
    onSuccess: (_data, buildId) => invalidateBuild(queryClient, orgId, buildId),
  });
}
