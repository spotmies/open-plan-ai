import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { bomService, type CreateNodeDto, type UpdateNodeDto } from '@/services/bom.service';
import { fromApiApproval, fromApiApprovalRequest, type BOMApprovalRequestScope } from '@/features/projects/components/bomData';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

export interface BomCostTrendPoint {
  date: string;
  totalCost: number;
}

export function useBomCostTrend(
  projectId: string | undefined,
  granularity: 'daily' | 'weekly' | 'monthly',
) {
  return useQuery({
    queryKey: queryKeys.bom.costTrend(projectId ?? '', granularity),
    queryFn: () =>
      apiClient.get<BomCostTrendPoint[]>(
        `${ENDPOINTS.PROJECTS.REPORTS_BOM_COST_TREND(projectId!)}?granularity=${granularity}`,
      ),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 min — historical data doesn't change often
  });
}

export function useBomTree(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bom.tree(projectId ?? ''),
    queryFn:  () => bomService.getTree(projectId!),
    enabled:  !!projectId,
    staleTime: 30 * 1000,  // 30s — tree changes frequently during editing
  });
}

export function useBomSummary(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bom.summary(projectId ?? ''),
    queryFn:  () => bomService.getSummary(projectId!),
    enabled:  !!projectId,
  });
}

export function useCreateBomNode(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateNodeDto) => bomService.createNode(projectId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.tree(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.summary(projectId) });
    },
  });
}

export function useUpdateBomNode(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, dto }: { nodeId: string; dto: UpdateNodeDto }) =>
      bomService.updateNode(nodeId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.tree(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.summary(projectId) });
    },
  });
}

export function useMoveBomNode(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, parentId, position }: { nodeId: string; parentId: string | null; position?: number }) =>
      bomService.moveNode(nodeId, { parentId, position }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.tree(projectId) });
    },
  });
}

export function useDeleteBomNode(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) => bomService.deleteNode(nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.tree(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.summary(projectId) });
    },
  });
}

export function useAddRequirement(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, requirementId }: { nodeId: string; requirementId: string }) =>
      bomService.addRequirement(nodeId, requirementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.tree(projectId) });
    },
  });
}

export function useRemoveRequirement(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => bomService.removeRequirement(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.tree(projectId) });
    },
  });
}

export function useCreateApprovalRequest(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      nodeId,
      scope,
      approverIds,
      comment,
    }: { nodeId: string; scope: BOMApprovalRequestScope; approverIds: string[]; comment?: string }) =>
      bomService.createApprovalRequest(nodeId, { scope, approverIds, comment }),
    onSuccess: (_data, { nodeId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.tree(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.summary(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.approvalRequests(nodeId) });
      queryClient.invalidateQueries({ queryKey: ['bom', 'project-approval-requests', projectId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.all });
    },
  });
}

export function useDecideApprovalRequest(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      decision,
      reason,
      comment,
    }: { requestId: string; nodeId: string; decision: 'approved' | 'rejected'; reason?: string; comment?: string }) =>
      bomService.decideApprovalRequest(requestId, { decision, reason, comment }),
    onSuccess: (_data, { nodeId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.tree(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.summary(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.approvals(nodeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.approvalRequests(nodeId) });
      queryClient.invalidateQueries({ queryKey: ['bom', 'project-approval-requests', projectId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.all });
    },
  });
}

export function useBomApprovalRequests(nodeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bom.approvalRequests(nodeId ?? ''),
    queryFn:  async () => (await bomService.listApprovalRequests(nodeId!)).map(fromApiApprovalRequest),
    enabled:  !!nodeId,
  });
}

export function useActiveBomApprovalRequest(nodeId: string | undefined) {
  const { data: requests } = useBomApprovalRequests(nodeId);
  return requests?.find((r) => r.status === 'pending') ?? null;
}

export function useProjectApprovalRequests(
  projectId: string | undefined,
  status?: 'pending' | 'approved' | 'rejected',
) {
  return useQuery({
    queryKey: queryKeys.bom.projectApprovalRequests(projectId ?? '', status),
    queryFn:  async () => (await bomService.listProjectApprovalRequests(projectId!, status)).map(fromApiApprovalRequest),
    enabled:  !!projectId,
    staleTime: 15 * 1000,
  });
}

export function useMapImportColumns() {
  return useMutation({
    mutationFn: ({ headers, sampleRows }: { headers: string[]; sampleRows: Record<string, unknown>[] }) =>
      bomService.mapImportColumns(headers, sampleRows),
  });
}

export function useFixImportRow() {
  return useMutation({
    mutationFn: (payload: Parameters<typeof bomService.fixImportRow>[0]) =>
      bomService.fixImportRow(payload),
  });
}

export function useBomNodeApprovals(nodeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bom.approvals(nodeId ?? ''),
    queryFn:  async () => (await bomService.getNodeApprovals(nodeId!)).map(fromApiApproval),
    enabled:  !!nodeId,
  });
}
