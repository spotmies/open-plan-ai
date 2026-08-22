import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  projectTagsService,
  type ProjectTag,
  type CreateTagInput,
  type UpdateTagInput,
} from '@/services/projectTags.service';
import { queryKeys } from '@/lib/queryClient';

export function useProjectTags(projectId?: string) {
  return useQuery({
    queryKey: projectId ? queryKeys.tags.list(projectId) : queryKeys.tags.list('none'),
    queryFn: () => projectTagsService.getByProjectId(projectId!),
    enabled: !!projectId,
  });
}

/** Builds a stable name (lowercased) -> color lookup for rendering tag badges anywhere in the project. */
export function useTagColorMap(projectId?: string): Map<string, string> {
  const { data: tags = [] } = useProjectTags(projectId);
  const map = new Map<string, string>();
  tags.forEach((tag) => map.set(tag.name.toLowerCase(), tag.color));
  return map;
}

export function useCreateTag(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTagInput) => {
      if (!projectId) return Promise.reject(new Error('Missing projectId'));
      return projectTagsService.create(projectId, input);
    },
    onSuccess: (tag: ProjectTag) => {
      if (!projectId) return;
      queryClient.setQueryData<ProjectTag[]>(queryKeys.tags.list(projectId), (old = []) =>
        old.some((t) => t.id === tag.id) ? old : [...old, tag].sort((a, b) => a.name.localeCompare(b.name)),
      );
    },
    onError: () => {
      toast.error('Failed to create tag');
    },
  });
}

export function useUpdateTag(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTagInput }) =>
      projectTagsService.update(id, input),
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.list(projectId) });
      // Renames cascade into task/issue tag arrays server-side — refetch both.
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(projectId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update tag');
    },
  });
}

export function useDeleteTag(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectTagsService.remove(id),
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.list(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(projectId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete tag');
    },
  });
}
