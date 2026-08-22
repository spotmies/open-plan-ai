import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { issuesService } from '@/services/issues.service';
import { fromApiIssue } from '@/services/projects.service';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { useProjectStore } from '@/stores/useProjectStore';
import { queryKeys } from '@/lib/queryClient';
import { Issue } from '@/types';
import { useOrganization } from '@/contexts/OrganizationContext';
import { logger } from '@/services/monitoring/logger';
import { toast } from 'sonner';

/**
 * Fetch all issues across all org projects — single aggregated endpoint,
 * replaces the previous O(n) fan-out across individual project endpoints.
 */
export function useAllIssues() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: [...queryKeys.issues.all, 'org-all', orgId],
    queryFn: async (): Promise<Issue[]> => {
      if (!orgId) return [];
      const data = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.ORGANIZATIONS.ALL_ISSUES(orgId));
      return (data || []).map(fromApiIssue);
    },
    enabled: !!orgId,
  });
}

/**
 * Alias — same single-endpoint implementation, kept for backward compatibility
 * with components that import useOrgAllIssues.
 */
export function useOrgAllIssues() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: [...queryKeys.issues.all, 'org', orgId],
    queryFn: async (): Promise<Issue[]> => {
      if (!orgId) return [];
      const data = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.ORGANIZATIONS.ALL_ISSUES(orgId));
      return (data || []).map(fromApiIssue);
    },
    enabled: !!orgId,
  });
}

/**
 * Fetch issues for a specific project
 */
export function useProjectIssues(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.issues.list(projectId),
    queryFn: () => issuesService.getByProject(projectId!),
    enabled: !!projectId,
  });
}

/**
 * Fetch single issue by ID
 */
export function useIssue(issueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.issues.detail(issueId || ''),
    queryFn: () => issuesService.getById(issueId!),
    enabled: !!issueId,
  });
}

/**
 * Fetch open issues count
 */
export function useOpenIssuesCount() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: [...queryKeys.issues.openCount(), orgId],
    queryFn: () => issuesService.getOpenCount(orgId),
    enabled: !!orgId,
  });
}

/**
 * Create new issue
 */
export function useCreateIssue() {
  const queryClient = useQueryClient();
  const addIssue = useProjectStore((state) => state.addIssue);

  return useMutation({
    mutationFn: ({ projectId, issue }: { projectId: string; issue: Omit<Issue, 'id' | 'reportedAt'> }) =>
      issuesService.create(projectId, issue),
    onSuccess: (newIssue, { projectId }) => {
      addIssue(projectId, newIssue);
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.openCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
    },
  });
}

/**
 * Update existing issue
 */
export function useUpdateIssue() {
  const queryClient = useQueryClient();
  const updateIssue = useProjectStore((state) => state.updateIssue);

  return useMutation({
    mutationFn: ({ projectId, issueId, updates }: { projectId: string; issueId: string; updates: Partial<Issue> }) =>
      issuesService.update(issueId, updates),
    onMutate: async ({ projectId, issueId, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.issues.detail(issueId) });

      // Snapshot the previous value
      const previousIssue = queryClient.getQueryData(queryKeys.issues.detail(issueId));

      // Optimistically update the store
      const timestamp = updates.status === 'resolved' ? new Date().toISOString() : undefined;
      const issueUpdates = { ...updates, resolvedAt: timestamp };
      updateIssue(projectId, issueId, issueUpdates);

      // Also update the projects cache if it exists
      queryClient.setQueriesData({ queryKey: queryKeys.projects.root }, (old: unknown) => {
        if (old == null) return old;
        if (Array.isArray(old)) {
          return old.map((p: any) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              issues: (p.issues || []).map((i: any) =>
                i.id === issueId ? { ...i, ...issueUpdates } : i
              )
            };
          });
        }
        if (typeof old === 'object' && old !== null && 'id' in old && (old as { id: string }).id === projectId) {
          const o = old as { issues?: any[]; [k: string]: unknown };
          return {
            ...o,
            issues: (o.issues || []).map((i: any) =>
              i.id === issueId ? { ...i, ...issueUpdates } : i
            )
          };
        }
        if (typeof old !== 'object' || !('id' in (old as object))) {
          logger.warn('[useIssues] setQueriesData: unexpected cache shape', typeof old);
        }
        return old;
      });

      return { previousIssue, projectId };
    },
    onError: (_err, { projectId, issueId }, context) => {
      logger.error('Issue update failed, rolling back', _err);
      toast.error('Failed to update issue');
    },
    onSuccess: (updatedIssue, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(updatedIssue.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.openCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
      toast.success('Issue updated successfully');
    },
  });
}

/**
 * Delete issue
 */
export function useDeleteIssue() {
  const queryClient = useQueryClient();
  const deleteIssue = useProjectStore((state) => state.deleteIssue);

  return useMutation({
    mutationFn: ({ projectId, issueId }: { projectId: string; issueId: string }) =>
      issuesService.delete(issueId),
    onSuccess: (_, { projectId, issueId }) => {
      deleteIssue(projectId, issueId);
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(projectId) });
      queryClient.removeQueries({ queryKey: queryKeys.issues.detail(issueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.openCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
    },
  });
}
