import { useQuery } from '@tanstack/react-query';
import { dashboardService, type DashboardStats, type ProjectSummary } from '@/services/dashboard.service';
import { useOrganization } from '@/contexts/OrganizationContext';
import { queryKeys } from '@/lib/queryClient';

export function useDashboardStats() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.stats(orgId),
    queryFn: () => dashboardService.getStats(orgId!),
    enabled: !!orgId,
  });
}

export function useRecentActivity(limit?: number) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.activity(orgId, limit),
    queryFn: () => dashboardService.getRecentActivity(orgId!, limit),
    enabled: !!orgId,
  });
}

export function useProjectSummaries() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.projects(orgId),
    queryFn: () => dashboardService.getProjectSummaries(orgId!),
    enabled: !!orgId,
  });
}

export type { DashboardStats, ProjectSummary };
