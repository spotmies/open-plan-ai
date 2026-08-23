import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modulesService, type Module, type ModuleInsert, type ModuleUpdate } from '@/services/modules.service';
import { queryKeys } from '@/lib/queryClient';
import { useOrganization } from '@/contexts/OrganizationContext';

export function useProjectModules(projectId: string) {
  return useQuery({
    queryKey: queryKeys.modules.list(projectId),
    queryFn: () => modulesService.getByProjectId(projectId),
    enabled: !!projectId,
  });
}

/**
 * Fetch all hardware modules across all org projects — single aggregated
 * endpoint, replaces the previous O(n) fan-out across individual project
 * endpoints.
 */
export function useAllModules() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: [...queryKeys.modules.all, 'all', orgId],
    queryFn: (): Promise<Module[]> => (orgId ? modulesService.getAllForOrg(orgId) : Promise.resolve([])),
    enabled: !!orgId,
  });
}

export function useModule(moduleId: string) {
  return useQuery({
    queryKey: queryKeys.modules.detail(moduleId),
    queryFn: () => modulesService.getById(moduleId),
    enabled: !!moduleId,
  });
}

export function useCreateModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (module: ModuleInsert) => modulesService.create(module),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.modules.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.modules.list(data.project_id) });
    },
  });
}

export function useUpdateModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: ModuleUpdate }) =>
      modulesService.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.modules.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.modules.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.modules.list(data.project_id) });
    },
  });
}

export function useDeleteModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => modulesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.modules.all });
    },
  });
}

/**
 * Alias — same single-endpoint implementation as useAllModules, kept for
 * backward compatibility with components that import useOrgAllModules.
 */
export function useOrgAllModules() {
  return useAllModules();
}

export type { Module, ModuleInsert, ModuleUpdate };
