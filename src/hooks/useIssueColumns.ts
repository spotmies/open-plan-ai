import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  issueColumnsService,
  type CreateIssueColumnInput,
  type UpdateIssueColumnInput,
} from '@/services/issueColumns.service';
import { queryKeys } from '@/lib/queryClient';

export function useIssueColumns(projectId?: string) {
  return useQuery({
    queryKey: projectId ? queryKeys.issueColumns.list(projectId) : queryKeys.issueColumns.list('none'),
    queryFn: () => issueColumnsService.getByProjectId(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateIssueColumn(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateIssueColumnInput) => {
      if (!projectId) return Promise.reject(new Error('Missing projectId'));
      return issueColumnsService.create(projectId, input);
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.issueColumns.list(projectId) });
    },
    onError: () => {
      toast.error('Failed to create column');
    },
  });
}

export function useUpdateIssueColumn(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateIssueColumnInput }) =>
      issueColumnsService.update(id, input),
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.issueColumns.list(projectId) });
    },
    onError: () => {
      toast.error('Failed to update column');
    },
  });
}

export function useDeleteIssueColumn(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => issueColumnsService.remove(id),
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.issueColumns.list(projectId) });
      toast.success('Bucket deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete column');
    },
  });
}

export function useReorderIssueColumns(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (columnIds: string[]) => {
      if (!projectId) return Promise.reject(new Error('Missing projectId'));
      return issueColumnsService.reorder(projectId, columnIds);
    },
    onSuccess: (savedColumns) => {
      if (!projectId) return;
      queryClient.setQueryData(queryKeys.issueColumns.list(projectId), savedColumns);
    },
    onError: () => {
      toast.error('Failed to save column order');
    },
  });
}
