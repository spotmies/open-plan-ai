import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  projectTaskColumnsService,
  type CreateTaskColumnInput,
  type UpdateTaskColumnInput,
} from '@/services/projectTaskColumns.service';
import { queryKeys } from '@/lib/queryClient';

export function useProjectTaskColumns(projectId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: projectId ? queryKeys.taskColumns.list(projectId) : queryKeys.taskColumns.list('none'),
    queryFn: () => projectTaskColumnsService.getByProjectId(projectId!),
    enabled: !!projectId && (options?.enabled ?? true),
  });
}

export function useCreateTaskColumn(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskColumnInput) => {
      if (!projectId) return Promise.reject(new Error('Missing projectId'));
      return projectTaskColumnsService.create(projectId, input);
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.taskColumns.list(projectId) });
    },
    onError: () => {
      toast.error('Failed to create column');
    },
  });
}

export function useUpdateTaskColumn(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskColumnInput }) =>
      projectTaskColumnsService.update(id, input),
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.taskColumns.list(projectId) });
    },
    onError: () => {
      toast.error('Failed to update column');
    },
  });
}

export function useDeleteTaskColumn(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectTaskColumnsService.remove(id),
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.taskColumns.list(projectId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete column');
    },
  });
}

export function useReorderTaskColumns(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (columnIds: string[]) => {
      if (!projectId) return Promise.reject(new Error('Missing projectId'));
      return projectTaskColumnsService.reorder(projectId, columnIds);
    },
    onSuccess: (savedColumns) => {
      if (!projectId) return;
      queryClient.setQueryData(queryKeys.taskColumns.list(projectId), savedColumns);
    },
    onError: () => {
      toast.error('Failed to save column order');
    },
  });
}
