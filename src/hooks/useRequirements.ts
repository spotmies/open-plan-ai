import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { queryKeys } from '@/lib/queryClient';

// ─── API response types (backend shape — snake_case enums, camelCase fields) ──

export interface ApiRequirementGroup {
  id: string;
  projectId: string;
  keyPrefix: string;
  label: string;
  color: string;
  icon: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRequirementTreeItem {
  id: string;
  projectId: string;
  groupId: string;
  parentId: string | null;
  key: string;
  type: string;
  category: string;
  priority: string;
  status: string;
  title: string;
  statement: string;
  rationale: string | null;
  source: string | null;
  standard: string | null;
  targetValue: number | null;
  targetTolerance: string | null;
  targetUnit: string | null;
  ownerId: string | null;
  version: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  depth: number;
}

export interface RequirementTargetPayload {
  value: number;
  tolerance?: string;
  unit?: string;
}

export interface CreateRequirementPayload {
  groupId: string;
  parentId?: string | null;
  type: string;
  category: string;
  priority?: string;
  title: string;
  statement: string;
  rationale?: string;
  source?: string;
  standard?: string;
  target?: RequirementTargetPayload | null;
  ownerId?: string;
}

export interface UpdateRequirementPayload {
  groupId?: string;
  parentId?: string | null;
  category?: string;
  priority?: string;
  status?: string;
  title?: string;
  statement?: string;
  rationale?: string;
  source?: string;
  standard?: string;
  target?: RequirementTargetPayload | null;
  ownerId?: string;
}

// ─── Requirement groups ───────────────────────────────────────────────────────

export function useRequirementGroups(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.requirementGroups.list(projectId ?? ''),
    queryFn: () => apiClient.get<ApiRequirementGroup[]>(ENDPOINTS.REQUIREMENT_GROUPS.LIST(projectId!)),
    enabled: !!projectId,
    staleTime: 60 * 1000,
  });
}

// ─── Requirements ─────────────────────────────────────────────────────────────

export function useRequirementTree(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.requirements.tree(projectId ?? ''),
    queryFn: () => apiClient.get<ApiRequirementTreeItem[]>(ENDPOINTS.REQUIREMENTS.TREE(projectId!)),
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

export function useCreateRequirement(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRequirementPayload) =>
      apiClient.post<ApiRequirementTreeItem>(ENDPOINTS.REQUIREMENTS.CREATE(projectId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requirements.tree(projectId) });
    },
  });
}

export function useUpdateRequirement(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requirementId, payload }: { requirementId: string; payload: UpdateRequirementPayload }) =>
      apiClient.patch<ApiRequirementTreeItem>(ENDPOINTS.REQUIREMENTS.UPDATE(requirementId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requirements.tree(projectId) });
    },
  });
}

export function useDeleteRequirement(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requirementId: string) =>
      apiClient.delete<void>(ENDPOINTS.REQUIREMENTS.DELETE(requirementId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requirements.tree(projectId) });
    },
  });
}
