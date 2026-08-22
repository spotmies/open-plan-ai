import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsService } from '@/services/projects.service';
import { useProjectStore } from '@/stores/useProjectStore';
import { useOrganization } from '@/contexts/OrganizationContext';
import { queryKeys } from '@/lib/queryClient';
import { Project } from '@/types';

/**
 * Fetch all projects scoped to the current organization
 */
/** Shorter stale window so project access changes (membership) show up without waiting on realtime alone. */
const PROJECTS_LIST_STALE_MS = 45 * 1000;

export function useProjects() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: queryKeys.projects.all(orgId),
    queryFn: async () => {
      const projects = await projectsService.getAll(orgId);
      useProjectStore.getState().setProjects(projects);
      return projects;
    },
    enabled: !!orgId,
    staleTime: PROJECTS_LIST_STALE_MS,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Fetch single project by ID
 */
export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId || ''),
    queryFn: () => projectsService.getById(projectId!),
    enabled: !!projectId,
  });
}

/**
 * Create new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();
  const addProject = useProjectStore((state) => state.addProject);

  return useMutation({
    mutationFn: ({ project, organizationId }: {
      project: Parameters<typeof projectsService.create>[0];
      organizationId: string;
    }) => projectsService.create(project, organizationId),
    onSuccess: (newProject) => {
      addProject(newProject);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
    },
  });
}

/**
 * Update existing project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();
  const updateProject = useProjectStore((state) => state.updateProject);

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Project> }) =>
      projectsService.update(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.detail(id) });

      // Snapshot the previous value
      const previousProject = queryClient.getQueryData(queryKeys.projects.detail(id));

      // Optimistically update
      queryClient.setQueryData(queryKeys.projects.detail(id), (old: Project | undefined) =>
        old ? { ...old, ...updates } : old
      );

      return { previousProject };
    },
    onError: (_err, { id, updates }, context) => {
      // Only rollback the project-level fields that were being updated,
      // never wipe out task/milestone/issue data (which lives in the same cache key).
      if (context?.previousProject) {
        queryClient.setQueryData(queryKeys.projects.detail(id), (current: any) => {
          if (!current) return context.previousProject;
          // Revert only the fields that were optimistically applied, keep tasks/milestones/issues.
          const revertedFields = Object.fromEntries(
            Object.keys(updates).map((k) => [k, (context.previousProject as any)[k]])
          );
          return { ...current, ...revertedFields };
        });
      }
    },
    onSuccess: (updatedProject) => {
      updateProject(updatedProject.id, updatedProject);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(updatedProject.id) });
    },
  });
}

/**
 * Update project stage — hits the Maintainer+-accessible
 * PATCH /projects/:id/stage endpoint, unlike useUpdateProject's general
 * PUT (Admin-only, for project identity/settings fields). Use this when the
 * caller may only be a Maintainer (not Admin) and is changing stage alone.
 */
export function useUpdateProjectStage() {
  const queryClient = useQueryClient();
  const updateProject = useProjectStore((state) => state.updateProject);

  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      projectsService.updateStage(id, stage),
    onSuccess: (updatedProject) => {
      updateProject(updatedProject.id, updatedProject);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(updatedProject.id) });
    },
  });
}

/**
 * Sync computed project progress — hits the Maintainer+-accessible
 * PATCH /projects/:id/progress endpoint, unlike useUpdateProject's general
 * PUT (Admin-only, for project identity/settings fields).
 */
export function useUpdateProjectProgress() {
  const queryClient = useQueryClient();
  const updateProject = useProjectStore((state) => state.updateProject);

  return useMutation({
    mutationFn: ({ id, progress }: { id: string; progress: number }) =>
      projectsService.updateProgress(id, progress),
    onMutate: async ({ id, progress }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.detail(id) });
      const previousProject = queryClient.getQueryData(queryKeys.projects.detail(id));
      queryClient.setQueryData(queryKeys.projects.detail(id), (old: Project | undefined) =>
        old ? { ...old, progress } : old
      );
      return { previousProject };
    },
    onError: (_err, { id }, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(queryKeys.projects.detail(id), context.previousProject);
      }
    },
    onSuccess: (updatedProject) => {
      updateProject(updatedProject.id, updatedProject);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(updatedProject.id) });
    },
  });
}

/**
 * Toggle the current user's pin on a project — pinned projects sort first
 * in the project list. Private per-user, mirrors useUpdateProjectStage's
 * dedicated-PATCH-endpoint shape.
 */
export function useTogglePinProject() {
  const queryClient = useQueryClient();
  const updateProject = useProjectStore((state) => state.updateProject);

  return useMutation({
    mutationFn: (id: string) => projectsService.togglePin(id),
    onSuccess: (updatedProject) => {
      updateProject(updatedProject.id, updatedProject);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
    },
  });
}

/**
 * Delete project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  const deleteProject = useProjectStore((state) => state.deleteProject);

  return useMutation({
    mutationFn: (projectId: string) => projectsService.delete(projectId),
    onSuccess: (_, projectId) => {
      deleteProject(projectId);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
}

