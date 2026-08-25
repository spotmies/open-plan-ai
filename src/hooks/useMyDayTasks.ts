import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { tasksService } from '@/services/tasks.service';
import { issuesService } from '@/services/issues.service';
import { queryKeys } from '@/lib/queryClient';
import { getDueDateStatus, isCompletedToday, isBlockingOthers, hasUnresolvedDependencies } from '@/features/myday/utils/myDayUtils';
import type { MyDayItem, DueDateStatus } from '@/features/myday/utils/myDayUtils';
import type { MyDayFilter } from '@/types';

function matchesFilter(status: DueDateStatus, filter: MyDayFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'today') return status === 'today';
  return status === 'overdue';
}

/** Local midnight today, as an ISO string — the cutoff for "done today". */
function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Shared raw fetch of tasks and issues assigned to the current user across all projects.
 * Both come from dedicated org-wide "assigned to me" endpoints — /tasks/me/all and
 * /issues/me/all — each a single request, not a per-project fan-out.
 *
 * Backs both useMyDayTasks and useCompletedTodayCount. By default the backend
 * excludes done/resolved items except ones completed today (all that either
 * consumer needs), instead of shipping the account's entire completed
 * history on every My Day load. Pass `includeDone` only when the user has
 * explicitly opened the Done/Resolved/Won't Fix column filter — that's a
 * separate, on-demand query rather than the default page-load fetch.
 */
function useMyDayRawData(options?: { includeDone?: boolean }) {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const includeDone = options?.includeDone ?? false;

  const { data: rawTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: [...queryKeys.myDay.all, 'tasks', user?.id, orgId, includeDone],
    queryFn: () => tasksService.getMyTasks(orgId, includeDone ? { includeDone: true } : { doneSince: startOfTodayISO() }),
    enabled: !!user?.id && !!orgId,
    staleTime: 30 * 1000,
  });

  const { data: rawIssuesList = [], isLoading: issuesLoading } = useQuery({
    queryKey: [...queryKeys.myDay.issues(user?.id || ''), orgId, includeDone],
    queryFn: () => issuesService.getMyIssues(orgId, includeDone ? { includeResolved: true } : { resolvedSince: startOfTodayISO() }),
    enabled: !!user?.id && !!orgId,
    staleTime: 30 * 1000,
  });

  const rawIssues = useMemo(
    () => rawIssuesList.map((issue) => ({ issue, projectName: issue.projectName, projectCode: issue.projectCode })),
    [rawIssuesList],
  );

  return { user, rawTasks, rawIssues, isLoading: tasksLoading || issuesLoading };
}

/**
 * `filter` narrows the result to today's items, overdue items, or everything;
 * the underlying queries always fetch the full assigned set so switching
 * filters is a client-side recompute, not a refetch.
 *
 * `statusFilter` is the active column status filter (from MyTasksFiltersDropdown).
 * Wont-fix/resolved issues are hidden by default (see below), but if the user has
 * explicitly selected one of those statuses, it must still be excludable-from-exclusion
 * so the filter can actually surface it instead of being silently dead.
 */
export function useMyDayTasks(filter: MyDayFilter = 'all', statusFilter?: string[]) {
  const includeWontFix = statusFilter?.includes('wont-fix') ?? false;
  const includeResolved = statusFilter?.includes('resolved') ?? false;
  const includeDone = statusFilter?.includes('done') ?? false;
  // Any of these selected means the full done/resolved/wont-fix history is
  // actually needed, not just today's — fetch it on demand for this case only.
  const { user, rawTasks, rawIssues, isLoading } = useMyDayRawData({
    includeDone: includeDone || includeResolved || includeWontFix,
  });

  const data = useMemo((): MyDayItem[] => {
    if (!user?.id) return [];

    // All tasks from /tasks/me/all are already assigned to the current user (filtered server-side).
    // Completed tasks are excluded by default (today/overdue/all) so a task marked done
    // disappears from the list immediately, unless the user explicitly filters for "Done".
    const taskItems: MyDayItem[] = rawTasks
      .filter(task =>
        matchesFilter(getDueDateStatus(task.dueDate, task.startDate), filter) &&
        (task.status !== 'done' || includeDone)
      )
      .map(task => {
        const dueDateStatus = getDueDateStatus(task.dueDate, task.startDate);
        return {
          id: task.id,
          itemType: 'task' as const,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assignees: task.assignees || [],
          dueDate: task.dueDate,
          projectId: task.projectId || '',
          // A task with no projectId is a personal "My Tasks" item (not tied to a project).
          projectName: (task as any).projectName || (task.projectId ? '' : 'Personal'),
          projectCode: (task as any).projectCode ?? undefined,
          number: task.number,
          isOverdue: dueDateStatus === 'overdue',
          isDueToday: dueDateStatus === 'today',
          isBlocked: task.status === 'blocked' || (task.blockedBy?.length ?? 0) > 0,
          isBlockingOthers: isBlockingOthers(task, rawTasks),
          hasUnresolvedDependencies: hasUnresolvedDependencies(task, rawTasks),
          originalTask: task,
        } as MyDayItem;
      });

    // Wont-fix and resolved issues are excluded by default so they don't linger in
    // My Day, unless the user has explicitly filtered for that status — otherwise
    // selecting "Won't Fix"/"Resolved" in the column filter could never show anything.
    const issueItems: MyDayItem[] = rawIssues
      .filter(({ issue }) => {
        const isAssignedToUser = issue.assignees?.some(a => a.id === user.id) ?? false;
        if (issue.status === 'wont-fix' && !includeWontFix) return false;
        if (issue.status === 'resolved' && !includeResolved) return false;
        return isAssignedToUser &&
          matchesFilter(getDueDateStatus(issue.dueDate), filter);
      })
      .map(({ issue, projectName, projectCode }) => {
        const dueDateStatus = getDueDateStatus(issue.dueDate);
        return {
          id: issue.id,
          itemType: 'issue' as const,
          title: issue.title,
          description: issue.description,
          status: issue.status,
          priority: issue.severity,
          assignees: issue.assignees || [],
          dueDate: issue.dueDate,
          projectId: issue.projectId,
          projectName,
          projectCode: projectCode ?? undefined,
          number: issue.number,
          isOverdue: dueDateStatus === 'overdue',
          isDueToday: dueDateStatus === 'today',
          isBlocked: false,
          originalIssue: issue,
        } as MyDayItem;
      });

    return [...taskItems, ...issueItems];
  }, [user?.id, rawTasks, rawIssues, filter]);

  return { data, isLoading };
}

/**
 * Get count of tasks completed/resolved today.
 * Derives from the same raw task/issue queries as useMyDayTasks, independent
 * of the displayed (non-done) item lists — the org projects list only ever
 * returns taskCount/issueCount summaries, never the actual task/issue arrays,
 * so this must derive from the real per-item queries rather than
 * `project.tasks`/`project.issues` (which are always empty).
 */
export function useCompletedTodayCount() {
  const { user, rawTasks, rawIssues } = useMyDayRawData();

  const data = useMemo(() => {
    if (!user?.id) return 0;

    const doneTasksToday = rawTasks.filter(
      task => task.status === 'done' && isCompletedToday(task)
    ).length;

    const resolvedIssuesToday = rawIssues.filter(
      ({ issue }) =>
        issue.status === 'resolved' &&
        (issue.assignees?.some(a => a.id === user.id) ?? false) &&
        isCompletedToday(issue)
    ).length;

    return doneTasksToday + resolvedIssuesToday;
  }, [user?.id, rawTasks, rawIssues]);

  return { data };
}
