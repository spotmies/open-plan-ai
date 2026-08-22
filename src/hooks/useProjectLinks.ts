import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectLinksService, CreateProjectLinkInput, UpdateProjectLinkInput } from '@/services/projectLinks.service';
import { toast } from 'sonner';

/**
 * Query links for a project
 */
export function useProjectLinks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-links', projectId],
    queryFn: () => projectLinksService.getByProject(projectId!),
    enabled: !!projectId,
  });
}

/**
 * Create a single project link mutation
 */
export function useCreateProjectLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectLinkInput) => projectLinksService.create(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-links', variables.project_id] });
    },
    onError: (error) => {
      toast.error('Failed to create project link', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}

/**
 * Create multiple project links mutation
 */
export function useCreateProjectLinks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, links }: { projectId: string; links: { name: string; url: string }[] }) =>
      projectLinksService.createMany(projectId, links),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-links', variables.projectId] });
    },
    onError: (error) => {
      toast.error('Failed to create project links', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}

/**
 * Update project link mutation
 */
export function useUpdateProjectLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ linkId, input }: { linkId: string; projectId: string; input: UpdateProjectLinkInput }) =>
      projectLinksService.update(linkId, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-links', variables.projectId] });
      toast.success('Link updated');
    },
    onError: (error) => {
      toast.error('Failed to update project link', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}

/**
 * Delete project link mutation (soft delete)
 */
export function useDeleteProjectLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ linkId, projectId }: { linkId: string; projectId: string }) =>
      projectLinksService.delete(linkId).then(() => projectId),
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ['project-links', projectId] });
      toast.success('Link deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete project link', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}
