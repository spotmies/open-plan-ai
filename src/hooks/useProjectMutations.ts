import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksService } from '@/services/tasks.service';
import { issuesService } from '@/services/issues.service';
import { milestonesService, type MilestoneInsert, type MilestoneUpdate } from '@/services/milestones.service';
import { modulesService, type ModuleInsert, type ModuleUpdate } from '@/services/modules.service';
import { queryKeys } from '@/lib/queryClient';
import { Task, Issue, Milestone } from '@/types';
import { toast } from 'sonner';
import { logger } from '@/services/monitoring/logger';

// ==================== Task Mutations ====================

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) =>
      tasksService.create(projectId, task),
    onSuccess: (createdTask) => {
      // Patch the cache directly rather than relying solely on the invalidated
      // refetch landing — see the matching comment in useCreateIssue above.
      queryClient.setQueryData(queryKeys.projects.detail(projectId), (old: any) =>
        old ? { ...old, tasks: [...(old.tasks || []), createdTask] } : old
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
      toast.success('Task created successfully');
    },
    onError: (error) => {
      logger.error('Error creating task:', error);
      toast.error('Failed to create task');
    },
  });
}

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) =>
      tasksService.update(projectId, taskId, updates),
    onMutate: async ({ taskId, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.detail(projectId) });
      const previousProject = queryClient.getQueryData(queryKeys.projects.detail(projectId));
      const previousTask = (previousProject as any)?.tasks?.find((t: Task) => t.id === taskId) as Task | undefined;

      // Optimistic update
      queryClient.setQueryData(queryKeys.projects.detail(projectId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t: Task) =>
            t.id === taskId ? {
              ...t,
              ...updates,
              updatedAt: updates.status === 'done' ? new Date().toISOString() : t.updatedAt
            } : t
          ),
        };
      });

      return { previousProject, previousTask };
    },
    onError: (err, _vars, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(queryKeys.projects.detail(projectId), context.previousProject);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to update task');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
      toast.success('Task updated successfully');
    },
  });
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => tasksService.delete(projectId, taskId),
    onSuccess: (_data, taskId) => {
      // Patch the cache directly rather than relying solely on the invalidated
      // refetch landing — see the matching comment in useCreateIssue above.
      queryClient.setQueryData(queryKeys.projects.detail(projectId), (old: any) =>
        old ? { ...old, tasks: (old.tasks || []).filter((t: Task) => t.id !== taskId) } : old
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
      toast.success('Task deleted');
    },
    onError: () => {
      toast.error('Failed to delete task');
    },
  });
}

export function useBatchUpdateTasks(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Array<{ id: string; updates: Partial<Task> }>) =>
      tasksService.batchUpdate(projectId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update tasks');
    },
  });
}

// ==================== Issue Mutations ====================

export function useCreateIssue(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (issue: Omit<Issue, 'id' | 'reportedAt'>) =>
      issuesService.create(projectId, issue),
    onSuccess: (createdIssue) => {
      // Patch the cache directly rather than relying solely on the invalidated
      // refetch landing — if that refetch gets cancelled/raced (it shares an
      // AbortSignal with the other project-detail sub-fetches and can lose that
      // race right after a mutation), the board would otherwise be left showing
      // stale empty data until a hard reload. See useProjectDetail.ts.
      queryClient.setQueryData(queryKeys.projects.detail(projectId), (old: any) =>
        old ? { ...old, issues: [...(old.issues || []), createdIssue] } : old
      );
      // refetchType: 'none' — the detail cache above is already patched with the
      // new issue, so an immediate refetch here only serves other (unmounted)
      // consumers of queryKeys.projects.root. Forcing it right away would abort
      // the project-detail query's in-flight combined fetch (see useProjectDetail.ts),
      // which shares one AbortSignal across its tasks/milestones/issues sub-requests
      // and shows up in devtools as those requests being cancelled and re-fired.
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root, refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
      toast.success('Issue created successfully');
    },
    onError: (error) => {
      logger.error('Error creating issue:', error);
      toast.error('Failed to create issue');
    },
  });
}

export function useUpdateIssue(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ issueId, updates }: { issueId: string; updates: Partial<Issue> }) =>
      issuesService.update(issueId, updates),
    onMutate: async ({ issueId, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.detail(projectId) });
      const previousProject = queryClient.getQueryData(queryKeys.projects.detail(projectId));

      queryClient.setQueryData(queryKeys.projects.detail(projectId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          issues: old.issues?.map((i: Issue) =>
            i.id === issueId ? { ...i, ...updates } : i
          ) || [],
        };
      });

      return { previousProject };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(queryKeys.projects.detail(projectId), context.previousProject);
      }
      toast.error('Failed to update issue');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
      toast.success('Issue updated successfully');
    },
  });
}

export function useUpdateIssueStatus(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ issueId, status }: { issueId: string; status: string }) =>
      issuesService.updateStatus(issueId, status as Issue['status']),
    onMutate: async ({ issueId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.detail(projectId) });
      const previousProject = queryClient.getQueryData(queryKeys.projects.detail(projectId));

      queryClient.setQueryData(queryKeys.projects.detail(projectId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          issues: old.issues?.map((i: Issue) =>
            i.id === issueId ? { ...i, status } : i
          ) || [],
        };
      });

      return { previousProject };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(queryKeys.projects.detail(projectId), context.previousProject);
      }
      toast.error('Failed to update issue status');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
    },
  });
}

export function useDeleteIssue(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (issueId: string) => issuesService.delete(issueId),
    onSuccess: (_data, issueId) => {
      // Patch the cache directly rather than relying solely on the invalidated
      // refetch landing — see the matching comment in useCreateIssue above.
      queryClient.setQueryData(queryKeys.projects.detail(projectId), (old: any) =>
        old ? { ...old, issues: (old.issues || []).filter((i: Issue) => i.id !== issueId) } : old
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
      toast.success('Issue deleted');
    },
    onError: () => {
      toast.error('Failed to delete issue');
    },
  });
}

// ==================== Milestone Mutations ====================

export function useCreateMilestone(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (milestone: Omit<MilestoneInsert, 'project_id'>) =>
      milestonesService.create({ ...milestone, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success('Milestone created successfully');
    },
    onError: (error) => {
      logger.error('Error creating milestone:', error);
      toast.error('Failed to create milestone');
    },
  });
}

export function useUpdateMilestone(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ milestoneId, updates }: { milestoneId: string; updates: MilestoneUpdate }) =>
      milestonesService.update(milestoneId, updates),
    onMutate: async ({ milestoneId, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.detail(projectId) });
      const previousProject = queryClient.getQueryData(queryKeys.projects.detail(projectId));

      queryClient.setQueryData(queryKeys.projects.detail(projectId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          milestones: old.milestones?.map((m: Milestone) =>
            m.id === milestoneId ? { ...m, ...updates } : m
          ) || [],
        };
      });

      return { previousProject };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(queryKeys.projects.detail(projectId), context.previousProject);
      }
      toast.error('Failed to update milestone');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useToggleMilestoneComplete(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ milestoneId, completed }: { milestoneId: string; completed: boolean }) =>
      milestonesService.complete(milestoneId, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => {
      toast.error('Failed to update milestone status');
    },
  });
}

export function useDeleteMilestone(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (milestoneId: string) => milestonesService.delete(milestoneId),
    onSuccess: (_data, milestoneId) => {
      // Patch the cache directly rather than relying solely on the invalidated
      // refetch landing — see the matching comment in useCreateIssue above.
      queryClient.setQueryData(queryKeys.projects.detail(projectId), (old: any) =>
        old ? { ...old, milestones: (old.milestones || []).filter((m: Milestone) => m.id !== milestoneId) } : old
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success('Milestone deleted');
    },
    onError: () => {
      toast.error('Failed to delete milestone');
    },
  });
}

// ==================== Module Mutations ====================

export function useCreateModule(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (module: Omit<ModuleInsert, 'project_id'>) =>
      modulesService.create({ ...module, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.modules.list(projectId) });
      toast.success('Module created successfully');
    },
    onError: (error) => {
      logger.error('Error creating module:', error);
      toast.error('Failed to create module');
    },
  });
}

export function useUpdateModule(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ moduleId, updates }: { moduleId: string; updates: ModuleUpdate }) =>
      modulesService.update(moduleId, updates),
    // No success toast: the module detail modal autosaves per field on
    // blur/select-change, so a toast here would fire on every single field
    // edit instead of once for the overall edit session.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.modules.list(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => {
      toast.error('Failed to update module');
    },
  });
}

export function useDeleteModule(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (moduleId: string) => modulesService.delete(moduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.modules.list(projectId) });
      toast.success('Module deleted');
    },
    onError: () => {
      toast.error('Failed to delete module');
    },
  });
}

export function useBatchUpdateModules(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Array<{ id: string; name?: string; milestone_id?: string | null }>) =>
      modulesService.updateMany(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.modules.list(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => {
      toast.error('Failed to update modules');
    },
  });
}
