import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { projectsService } from '@/services/projects.service';
import { modulesService } from '@/services/modules.service';
import { queryKeys } from '@/lib/queryClient';
import { logger } from '@/services/monitoring/logger';

/**
 * Degrade a failed sub-fetch to a default value, but let abort errors propagate so React Query
 * can discard the canceled result instead of caching a partial one. Logged because the fallback
 * makes the outer query resolve "successfully" with empty data — without this, a transient 500
 * on one sub-resource renders as a silently empty project instead of a visible error.
 */
function orDefaultUnlessAborted<T>(promise: Promise<T>, fallback: T, label: string): Promise<T> {
  return promise.catch((err) => {
    if (axios.isCancel(err)) throw err;
    logger.error(`useProjectDetail: ${label} sub-fetch failed, falling back to empty`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  });
}

/**
 * Fetch a single project with all related data (tasks, milestones, issues).
 * Tasks, milestones, and issues are fetched in parallel and merged into the
 * project object so ProjectDetail can access project.tasks / .milestones / .issues.
 */
export function useProjectDetail(projectId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId || ''),
    queryFn: async ({ signal }) => {
      const [project, tasks, milestones, issues] = await Promise.all([
        projectsService.getById(projectId!, signal),
        orDefaultUnlessAborted(projectsService.getTasks(projectId!, 100, signal), [], 'tasks'),
        orDefaultUnlessAborted(projectsService.getMilestones(projectId!, 100, signal), [], 'milestones'),
        orDefaultUnlessAborted(projectsService.getIssues(projectId!, 100, signal), [], 'issues'),
      ]);
      if (!project) return null;
      return {
        ...project,
        tasks: tasks ?? [],
        milestones: milestones ?? [],
        issues: issues ?? [],
      };
    },
    enabled: !!projectId && (options?.enabled ?? true),
  });
}

/**
 * Fetch modules for a specific project
 */
export function useProjectModules(projectId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.modules.list(projectId),
    queryFn: () => modulesService.getByProjectId(projectId!),
    enabled: !!projectId && (options?.enabled ?? true),
  });
}

/**
 * Fetch tasks for a specific project
 */
export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tasks.list(projectId || ''),
    queryFn: () => projectsService.getTasks(projectId!),
    enabled: !!projectId,
  });
}
