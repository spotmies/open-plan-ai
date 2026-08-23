import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { milestonesService, type Milestone, type MilestoneInsert, type MilestoneUpdate } from '@/services/milestones.service';
import { queryKeys } from '@/lib/queryClient';
import { useOrganization } from '@/contexts/OrganizationContext';

export function useProjectMilestones(projectId: string) {
  return useQuery({
    queryKey: queryKeys.milestones.list(projectId),
    queryFn: () => milestonesService.getByProjectId(projectId),
    enabled: !!projectId,
  });
}

export function useMilestone(milestoneId: string) {
  return useQuery({
    queryKey: queryKeys.milestones.detail(milestoneId),
    queryFn: () => milestonesService.getById(milestoneId),
    enabled: !!milestoneId,
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (milestone: MilestoneInsert) => milestonesService.create(milestone),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones.list(data.project_id) });
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MilestoneUpdate }) =>
      milestonesService.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones.list(data.project_id) });
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => milestonesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones.all });
    },
  });
}

/**
 * Fetch all milestones across all org projects — single aggregated endpoint,
 * replaces the previous O(n) fan-out across individual project endpoints.
 */
export function useAllMilestones() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: [...queryKeys.milestones.all, 'org', orgId],
    queryFn: (): Promise<Milestone[]> => (orgId ? milestonesService.getAllForOrg(orgId) : Promise.resolve([])),
    enabled: !!orgId,
  });
}

export type { Milestone, MilestoneInsert, MilestoneUpdate };
