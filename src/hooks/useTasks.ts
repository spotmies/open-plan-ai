import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksService, fromApi } from '@/services/tasks.service';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { useProjectStore } from '@/stores/useProjectStore';
import { queryKeys } from '@/lib/queryClient';
import { Task } from '@/types';
import { useOrganization } from '@/contexts/OrganizationContext';
import { logger } from '@/services/monitoring/logger';
import { toast } from 'sonner';

/**
 * Fetch all tasks across all org projects — single aggregated endpoint,
 * replaces the previous O(n) fan-out across individual project endpoints.
 */
export function useAllTasks() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: [...queryKeys.tasks.all, 'org-all', orgId],
    queryFn: async (): Promise<Task[]> => {
      if (!orgId) return [];
      const data = await apiClient.get<any[]>(ENDPOINTS.ORGANIZATIONS.ALL_TASKS(orgId));
      return (data || []).map(fromApi);
    },
    enabled: !!orgId,
  });
}

/**
 * Alias — same single-endpoint implementation, kept for backward compatibility
 * with components that import useOrgAllTasks.
 */
export function useOrgAllTasks() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: [...queryKeys.tasks.all, 'org', orgId],
    queryFn: async (): Promise<Task[]> => {
      if (!orgId) return [];
      const data = await apiClient.get<any[]>(ENDPOINTS.ORGANIZATIONS.ALL_TASKS(orgId));
      return (data || []).map(fromApi);
    },
    enabled: !!orgId,
  });
}

/**
 * Fetch tasks for a specific project
 */
export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tasks.list(projectId || ''),
    queryFn: () => tasksService.getByProject(projectId!),
    enabled: !!projectId,
  });
}

/**
 * Fetch single task by ID
 */
export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(taskId || ''),
    queryFn: () => tasksService.getById(taskId!),
    enabled: !!taskId,
  });
}

/**
 * Create new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  const addTask = useProjectStore((state) => state.addTask);

  return useMutation({
    mutationFn: ({ projectId, task }: { projectId: string; task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> }) =>
      tasksService.create(projectId, task),
    onSuccess: (newTask, { projectId }) => {
      addTask(projectId, newTask);
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
    },
  });
}

/**
 * Create a personal "My Tasks" item — no project, private to its creator.
 */
export function useCreatePersonalTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ organizationId, task }: { organizationId: string; task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> }) =>
      tasksService.createPersonal(organizationId, task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
    },
  });
}

/**
 * Update existing task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  const updateTask = useProjectStore((state) => state.updateTask);

  return useMutation({
    mutationFn: ({ projectId, taskId, updates }: { projectId: string; taskId: string; updates: Partial<Task> }) =>
      tasksService.update(projectId, taskId, updates),
    onMutate: async ({ projectId, taskId, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.detail(taskId) });

      // Snapshot the previous value
      const previousTask = queryClient.getQueryData(queryKeys.tasks.detail(taskId));

      // Optimistically update the store
      const timestamp = updates.status === 'done' ? new Date().toISOString() : undefined;
      const taskUpdates = { ...updates, updatedAt: timestamp };

      updateTask(projectId, taskId, taskUpdates);

      // Also update the projects cache if it exists
      queryClient.setQueriesData({ queryKey: queryKeys.projects.root }, (old: unknown) => {
        if (old == null) return old;
        if (Array.isArray(old)) {
          return old.map((p: any) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              tasks: (p.tasks || []).map((t: any) =>
                t.id === taskId ? { ...t, ...taskUpdates } : t
              )
            };
          });
        }
        if (typeof old === 'object' && old !== null && 'id' in old && (old as { id: string }).id === projectId) {
          const o = old as { tasks?: any[]; [k: string]: unknown };
          return {
            ...o,
            tasks: (o.tasks || []).map((t: any) =>
              t.id === taskId ? { ...t, ...taskUpdates } : t
            )
          };
        }
        if (typeof old !== 'object' || !('id' in (old as object))) {
          logger.warn('[useTasks] setQueriesData: unexpected cache shape', typeof old);
        }
        return old;
      });

      return { previousTask, projectId };
    },
    onError: (err, { projectId, taskId }, context) => {
      logger.error('Task update failed, rolling back', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update task');
    },
    onSuccess: (updatedTask, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(updatedTask.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
      toast.success('Task updated successfully');
    },
  });
}

/**
 * Delete task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  const deleteTask = useProjectStore((state) => state.deleteTask);

  return useMutation({
    mutationFn: ({ projectId, taskId }: { projectId: string; taskId: string }) =>
      tasksService.delete(projectId, taskId),
    onSuccess: (_, { projectId, taskId }) => {
      deleteTask(projectId, taskId);
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(projectId) });
      queryClient.removeQueries({ queryKey: queryKeys.tasks.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
    },
  });
}

/**
 * Batch update tasks (e.g., for drag-and-drop)
 */
export function useBatchUpdateTasks() {
  const queryClient = useQueryClient();
  const updateTask = useProjectStore((state) => state.updateTask);

  return useMutation({
    mutationFn: ({ projectId, updates }: { projectId: string; updates: Array<{ id: string; updates: Partial<Task> }> }) =>
      tasksService.batchUpdate(projectId, updates),
    onMutate: async ({ projectId, updates }) => {
      // Optimistically update each task
      updates.forEach(({ id, updates: taskUpdates }) => {
        updateTask(projectId, id, taskUpdates);
      });
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
    },
  });
}
