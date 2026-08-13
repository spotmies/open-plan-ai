import { Task, Issue, Milestone, TeamMember, Module, Priority, TaskStatus, Project } from '@/types';
import {
  subDays,
  isBefore,
  parse,
  parseISO,
  differenceInDays,
  format,
  startOfDay,
  eachDayOfInterval,
  isWithinInterval
} from 'date-fns';

// Single source of truth — ReportFilter is defined in useFilterStore.
// Importing from there prevents the two definitions from silently diverging.
export type { ReportFilter, ReportTimeRange } from '@/stores/useFilterStore';

export interface ReportKPI {
  projectProgress: number;
  completedTasks: number;
  totalTasks: number;
  openIssues: number;
  criticalIssues: number;
  overdueTasks: number;
  avgCycleTime: number;
  trendData: { date: string; value: number }[];
}

export interface StatusBreakdown {
  status: TaskStatus;
  count: number;
  percentage: number;
}

export interface IssueStatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

export interface MilestoneHealthItem {
  milestone: Milestone;
  status: 'on-track' | 'at-risk' | 'blocked' | 'complete';
  progress: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  daysRemaining: number;
}

export interface TeamWorkloadItem {
  member: TeamMember;
  totalTasks: number;
  overdueTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  totalIssues: number;
  openIssues: number;
  resolvedIssues: number;
}

export interface ModuleProgressItem {
  module: Module;
  progress: number;
  totalTasks: number;
  completedTasks: number;
}

export interface TrendDataPoint {
  date: string;
  completed: number;
  cumulative: number;
  remaining: number;
}

// Get date range based on time range selection
export function getDateRangeFromTimeRange(
  timeRange: ReportTimeRange,
  customRange?: { start: string; end: string }
): { start: Date; end: Date } {
  const today = startOfDay(new Date());

  switch (timeRange) {
    case '7d':
      return { start: subDays(today, 7), end: today };
    case '30d':
      return { start: subDays(today, 30), end: today };
    case '90d':
      return { start: subDays(today, 90), end: today };
    case 'custom':
      if (customRange) {
        return {
          start: parse(customRange.start, 'yyyy-MM-dd', new Date()),
          end: parse(customRange.end, 'yyyy-MM-dd', new Date())
        };
      }
      return { start: subDays(today, 30), end: today };
    default:
      return { start: subDays(today, 30), end: today };
  }
}

/**
 * Filter tasks for the selected reporting window.
 *
 * Previously this used **due dates only**, which dropped active tasks whose due date was
 * in the future (or otherwise outside the window), so KPIs and charts showed empty data
 * while "Project Progress" still counted tasks from unfiltered totals.
 *
 * Rules now:
 * - **Non-done** tasks: always included (current backlog / in-flight work for the org/project).
 * - **Done** tasks: included only if completion time (`updatedAt`) falls within the range
 *   (typical for "Last 30 days" velocity / cycle metrics).
 */
export function filterTasksByTimeRange(
  tasks: Task[],
  dateRange: { start: Date; end: Date }
): Task[] {
  const rangeStart = startOfDay(dateRange.start);
  const rangeEnd = startOfDay(dateRange.end);

  return tasks.filter((task) => {
    if (task.status !== 'done') {
      return true;
    }
    if (!task.updatedAt) {
      return false;
    }
    const completedDay = startOfDay(parseISO(task.updatedAt));
    return isWithinInterval(completedDay, { start: rangeStart, end: rangeEnd });
  });
}

// Calculate project progress
export function calculateProjectProgress(
  tasks: Task[],
  milestones: Milestone[] = [],
  modules: Module[] = [],
  issues: Issue[] = []
): {
  progress: number;
  completed: number;
  total: number
} {
  const total = tasks.length;
  if (total === 0 && milestones.length === 0 && modules.length === 0 && issues.length === 0) {
    return { progress: 0, completed: 0, total: 0 };
  }

  // Task progress: % of tasks completed
  const taskProgress = tasks.length > 0
    ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100)
    : 0;

  // Milestone progress: % of milestones completed
  const milestoneProgress = milestones.length > 0
    ? Math.round((milestones.filter(m => m.completed).length / milestones.length) * 100)
    : 0;

  // Module progress: average of all module progresses
  // Calculated dynamically from tasks associated with each module
  const moduleProgress = modules.length > 0
    ? Math.round(
      modules.reduce((sum, m) => {
        const moduleTasks = tasks.filter(t =>
          t.moduleId === m.id || (t.moduleIds || []).includes(m.id)
        );
        const progress = moduleTasks.length > 0
          ? (moduleTasks.filter(t => t.status === 'done').length / moduleTasks.length) * 100
          : (m.progress || 0);
        return sum + progress;
      }, 0) / modules.length
    )
    : 0;

  // Issue progress: % of issues resolved
  const resolvedIssues = issues.filter(i =>
    i.status === 'resolved'
  ).length;
  const issueProgress = issues.length > 0
    ? Math.round((resolvedIssues / issues.length) * 100)
    : 0;

  // Overall: average only the metrics that have data
  const metrics = [];
  if (tasks.length > 0) metrics.push(taskProgress);
  if (milestones.length > 0) metrics.push(milestoneProgress);
  if (modules.length > 0) metrics.push(moduleProgress);
  if (issues.length > 0) metrics.push(issueProgress);

  const overallProgress = metrics.length > 0
    ? Math.round(metrics.reduce((sum, val) => sum + val, 0) / metrics.length)
    : 0;

  const completed = tasks.filter(t => t.status === 'done').length;
  return {
    progress: overallProgress,
    completed,
    total
  };
}

// Count open issues — all issues except 'resolved' and 'wont-fix'.
// Custom column statuses are included so the count matches the full active board.
export function countOpenIssues(issues: Issue[]): { total: number; critical: number } {
  const openIssues = issues.filter(i =>
    i.status !== 'resolved' && i.status !== 'wont-fix'
  );
  const criticalIssues = openIssues.filter(i => i.severity === 'critical');

  return {
    total: openIssues.length,
    critical: criticalIssues.length
  };
}

// Count overdue tasks
export function countOverdueTasks(tasks: Task[]): number {
  const today = startOfDay(new Date());
  return tasks.filter(task => {
    if (!task.dueDate || task.status === 'done') return false;
    return isBefore(parse(task.dueDate, 'yyyy-MM-dd', new Date()), today);
  }).length;
}

// Format cycle time into a human-readable string.
// Values under 2 days are shown as hours since decimals like "0.3d" are hard to parse at a glance.
export function formatCycleTime(days: number): { value: string; subtitle: string } {
  if (days === 0) return { value: 'N/A', subtitle: 'days per task' };
  if (days < 2) {
    const hours = Math.round(days * 24);
    return { value: `${hours} hrs`, subtitle: 'hours per task' };
  }
  return { value: `${days}d`, subtitle: 'days per task' };
}

// Calculate average cycle time
export function calculateAvgCycleTime(tasks: Task[]): number {
  const completedTasks = tasks.filter(t =>
    t.status === 'done' && t.startDate && t.updatedAt
  );

  if (completedTasks.length === 0) return 0;

  const totalDays = completedTasks.reduce((sum, task) => {
    const start = parseISO(task.startDate!);
    const end = parseISO(task.updatedAt);
    return sum + Math.abs(differenceInDays(end, start));
  }, 0);

  return Math.round((totalDays / completedTasks.length) * 10) / 10;
}

// Get task status breakdown
export function getTaskStatusBreakdown(tasks: Task[]): StatusBreakdown[] {
  const total = tasks.length;
  if (total === 0) return [];

  const statusOrder: TaskStatus[] = ['todo', 'in-progress', 'review', 'done', 'blocked'];
  const counts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<TaskStatus, number>);

  return statusOrder.map(status => ({
    status,
    count: counts[status] || 0,
    percentage: Math.round(((counts[status] || 0) / total) * 100)
  })).filter(item => item.count > 0);
}

// Get issue status breakdown
export function getIssueStatusBreakdown(issues: Issue[]): IssueStatusBreakdown[] {
  const total = issues.length;
  if (total === 0) return [];

  const statusOrder = ['open', 'in-progress', 'resolved', 'wont-fix'];
  const counts = issues.reduce((acc, issue) => {
    acc[issue.status] = (acc[issue.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Known statuses first (in a fixed order), then any custom bucket keys.
  const orderedStatuses = [
    ...statusOrder,
    ...Object.keys(counts).filter(status => !statusOrder.includes(status)),
  ];

  return orderedStatuses.map(status => ({
    status,
    count: counts[status] || 0,
    percentage: Math.round(((counts[status] || 0) / total) * 100)
  })).filter(item => item.count > 0);
}

// Get milestone health
export function getMilestoneHealth(
  milestones: Milestone[],
  tasks: Task[]
): MilestoneHealthItem[] {
  const today = startOfDay(new Date());

  return milestones.map(milestone => {
    const linkedTasks = tasks.filter(t =>
      t.milestoneId === milestone.id ||
      milestone.linkedTaskIds?.includes(t.id)
    );
    const completedTasks = linkedTasks.filter(t => t.status === 'done').length;
    const blockedTasks = linkedTasks.filter(t => t.status === 'blocked').length;
    const overdueTasks = linkedTasks.filter(t => {
      if (!t.dueDate || t.status === 'done') return false;
      return isBefore(parse(t.dueDate, 'yyyy-MM-dd', new Date()), today);
    }).length;

    const totalTasks = linkedTasks.length;
    const progress = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : (milestone.completed ? 100 : 0);
    const daysRemaining = (milestone.date && milestone.date.length > 0)
      ? differenceInDays(parse(milestone.date, 'yyyy-MM-dd', new Date()), today)
      : 0;

    let status: MilestoneHealthItem['status'] = 'on-track';

    if (milestone.completed || progress === 100) {
      status = 'complete';
    } else if (blockedTasks > 0) {
      status = 'blocked';
    } else if (overdueTasks > 0 || (progress < 50 && daysRemaining < 7 && daysRemaining >= 0)) {
      status = 'at-risk';
    }

    return {
      milestone,
      status,
      progress,
      totalTasks,
      completedTasks,
      overdueTasks,
      daysRemaining
    };
  });
}

// Get team workload
export function getTeamWorkload(
  tasks: Task[],
  teamMembers: TeamMember[],
  issues: Issue[] = []
): TeamWorkloadItem[] {
  const today = startOfDay(new Date());

  return teamMembers.map(member => {
    const memberTasks = tasks.filter(t =>
      t.assignees?.some(a => a.id === member.id)
    );

    const overdueTasks = memberTasks.filter(t => {
      if (!t.dueDate || t.status === 'done') return false;
      return isBefore(parse(t.dueDate, 'yyyy-MM-dd', new Date()), today);
    }).length;

    const completedTasks = memberTasks.filter(t => t.status === 'done').length;
    const inProgressTasks = memberTasks.filter(t => t.status === 'in-progress').length;

    const memberIssues = issues.filter(i =>
      i.assignees?.some((a: { id: string }) => a.id === member.id)
    );
    const openIssues = memberIssues.filter(i => i.status !== 'resolved' && i.status !== 'wont-fix').length;
    const resolvedIssues = memberIssues.filter(i => i.status === 'resolved' || i.status === 'wont-fix').length;

    return {
      member,
      totalTasks: memberTasks.length,
      overdueTasks,
      completedTasks,
      inProgressTasks,
      totalIssues: memberIssues.length,
      openIssues,
      resolvedIssues,
    };
  }).sort((a, b) => (b.totalTasks + b.totalIssues) - (a.totalTasks + a.totalIssues));
}

// Get module progress
export function getModuleProgress(
  tasks: Task[],
  modules: Module[]
): ModuleProgressItem[] {
  return modules.map(module => {
    const moduleTasks = tasks.filter(t =>
      t.moduleId === module.id || (t.moduleIds || []).includes(module.id)
    );
    const completedTasks = moduleTasks.filter(t => t.status === 'done').length;
    const totalTasks = moduleTasks.length;

    // Use dynamic progress if tasks exist, otherwise fall back to stored progress
    const progress = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : (module.progress || 0);

    return {
      module,
      progress,
      totalTasks,
      completedTasks
    };
  });
}

// Get completed tasks trend
export function getCompletedTasksTrend(
  tasks: Task[],
  dateRange: { start: Date; end: Date }
): TrendDataPoint[] {
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  const totalTasks = tasks.length;

  let cumulative = 0;

  return days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const completedOnDay = tasks.filter(t => {
      if (t.status !== 'done' || !t.updatedAt) return false;
      const completedDate = format(parseISO(t.updatedAt), 'yyyy-MM-dd');
      return completedDate === dayStr;
    }).length;

    cumulative += completedOnDay;

    return {
      date: format(day, 'MMM dd'),
      completed: completedOnDay,
      cumulative,
      remaining: totalTasks - cumulative
    };
  });
}

// Calculate all KPIs
export function calculateKPIs(
  tasks: Task[],
  issues: Issue[],
  dateRange: { start: Date; end: Date },
  milestones: Milestone[] = [],
  modules: Module[] = []
): ReportKPI {
  const progressData = calculateProjectProgress(tasks, milestones, modules, issues);
  const issueData = countOpenIssues(issues);
  const trendData = getCompletedTasksTrend(tasks, dateRange);

  return {
    projectProgress: progressData.progress,
    completedTasks: progressData.completed,
    totalTasks: progressData.total,
    openIssues: issueData.total,
    criticalIssues: issueData.critical,
    overdueTasks: countOverdueTasks(tasks),
    avgCycleTime: calculateAvgCycleTime(tasks),
    trendData: trendData.map(d => ({ date: d.date, value: d.cumulative }))
  };
}

// Apply filters to tasks
export function applyFilters(
  tasks: Task[],
  filter: ReportFilter
): Task[] {
  return tasks.filter(task => {
    if (filter.moduleIds?.length && !filter.moduleIds.includes(task.moduleId || '')) {
      return false;
    }
    if (filter.milestoneIds?.length && !filter.milestoneIds.includes(task.milestoneId || '')) {
      return false;
    }
    if (filter.assigneeIds?.length) {
      const hasMatchingAssignee = task.assignees?.some(a => filter.assigneeIds!.includes(a.id));
      if (!hasMatchingAssignee) return false;
    }
    if (filter.priority?.length && !filter.priority.includes(task.priority)) {
      return false;
    }
    if (filter.status?.length && !filter.status.includes(task.status)) {
      return false;
    }
    if (filter.tags?.length) {
      const hasMatchingTag = task.tags?.some(t => filter.tags!.includes(t));
      if (!hasMatchingTag) return false;
    }
    return true;
  });
}

// Get status color class
export function getStatusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    'todo': 'hsl(var(--status-todo))',
    'in-progress': 'hsl(var(--status-in-progress))',
    'review': 'hsl(var(--status-review))',
    'done': 'hsl(var(--status-done))',
    'blocked': 'hsl(var(--status-blocked))'
  };
  return colors[status];
}

// Get status label
export function getStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    'todo': 'To Do',
    'in-progress': 'In Progress',
    'review': 'Review',
    'done': 'Done',
    'blocked': 'Blocked'
  };
  return labels[status];
}

// Get issue status color
export function getIssueStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'open': 'hsl(var(--destructive))',
    'in-progress': 'hsl(var(--status-in-progress))',
    'resolved': 'hsl(var(--status-done))',
    'wont-fix': 'hsl(var(--muted-foreground))'
  };
  return colors[status] || 'hsl(var(--muted-foreground))';
}

// Get issue status label
export function getIssueStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'open': 'Open',
    'in-progress': 'In Progress',
    'resolved': 'Resolved',
    'wont-fix': "Won't Fix"
  };
  return labels[status] || status;
}
