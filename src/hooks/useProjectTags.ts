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

// No onError toast here on purpose: every caller (TaskDetailModal,
// IssueDetailContent) wraps mutateAsync in its own try/catch and falls back
// to applying the typed tag name locally either way, so from the user's
// point of view the tag always "succeeds" onto the task/issue. A toast fired
// from here reacted only to the mutation's own outcome, with no visibility
// into that fallback — so a transient failure (network blip, slow response)
// surfaced "Failed to create tag" at the exact moment the tag visibly landed
// in the field, contradicting what the user just saw. If a caller wants to
// tell a real failure apart from that fallback, it should do so itself in
// its own catch block, not rely on this hook to guess.
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
