// Project Utility Functions

import { Task, Milestone, Issue, Module, ModuleType, DEFAULT_TASK_STATUSES } from '@/types';

/**
 * Calculate milestone progress from linked tasks
 */
export function getMilestoneProgress(milestone: Milestone, tasks: Task[]): number {
  const linkedTasks = tasks.filter(t =>
    milestone.linkedTaskIds?.includes(t.id) || t.milestoneId === milestone.id
  );

  if (linkedTasks.length === 0) return milestone.completed ? 100 : 0;

  const completedTasks = linkedTasks.filter(t => t.status === 'done').length;
  return Math.round((completedTasks / linkedTasks.length) * 100);
}

/**
 * Get tasks linked to a milestone
 */
export function getMilestoneTasks(milestone: Milestone, tasks: Task[]): Task[] {
  return tasks.filter(t =>
    milestone.linkedTaskIds?.includes(t.id) || t.milestoneId === milestone.id
  );
}

/**
 * Get modules linked to a milestone
 */
export function getMilestoneModules(milestone: Milestone, modules: Module[]): Module[] {
  return modules.filter(m =>
    milestone.linkedModuleIds?.includes(m.id) || m.milestoneId === milestone.id
  );
}

/**
 * Get issues blocking a task
 */
export function getBlockingIssues(taskId: string, issues: Issue[]): Issue[] {
  return issues.filter(issue =>
    issue.blocksTaskIds?.includes(taskId) &&
    issue.status !== 'resolved' &&
    issue.status !== 'wont-fix'
  );
}

/**
 * Get issues affecting a milestone
 */
export function getMilestoneIssues(milestoneId: string, issues: Issue[]): Issue[] {
  return issues.filter(issue =>
    issue.blocksMilestoneIds?.includes(milestoneId) &&
    issue.status !== 'resolved' &&
    issue.status !== 'wont-fix'
  );
}

/**
 * Get all tasks for a module (by moduleId or module type)
 */
export function getModuleTasks(moduleIdOrType: string, tasks: Task[]): Task[] {
  return tasks.filter(t =>
    t.moduleId === moduleIdOrType ||
    (t.moduleIds || []).includes(moduleIdOrType) ||
    t.module === moduleIdOrType
  );
}

/**
 * Get module progress based on tasks
 */
export function getModuleProgress(moduleIdOrType: string, tasks: Task[]): number {
  const moduleTasks = getModuleTasks(moduleIdOrType, tasks);

  if (moduleTasks.length === 0) return 0;

  const completedTasks = moduleTasks.filter(t => t.status === 'done').length;
  return Math.round((completedTasks / moduleTasks.length) * 100);
}

/**
 * Check if a task is blocked by issues
 */
export function isTaskBlockedByIssues(taskId: string, issues: Issue[]): boolean {
  return getBlockingIssues(taskId, issues).length > 0;
}

/**
 * Check if a milestone is blocked by issues
 */
export function isMilestoneBlockedByIssues(milestoneId: string, issues: Issue[]): boolean {
  return getMilestoneIssues(milestoneId, issues).length > 0;
}

/**
 * Get issue counts by severity
 */
export function getIssueCounts(issues: Issue[]): Record<string, number> {
  const openIssues = issues.filter(i => i.status !== 'resolved' && i.status !== 'wont-fix');

  return {
    total: openIssues.length,
    critical: openIssues.filter(i => i.severity === 'critical').length,
    major: openIssues.filter(i => i.severity === 'major').length,
    minor: openIssues.filter(i => i.severity === 'minor').length,
    trivial: openIssues.filter(i => i.severity === 'trivial').length,
  };
}

/**
 * Get milestone status
 */
export function getMilestoneStatus(milestone: Milestone, tasks: Task[], issues: Issue[]): 'completed' | 'blocked' | 'at-risk' | 'on-track' {
  if (milestone.completed) return 'completed';

  // A manually-selected status takes precedence over the computed one.
  if (milestone.status && milestone.status !== 'completed') return milestone.status;

  if (isMilestoneBlockedByIssues(milestone.id, issues)) return 'blocked';

  const progress = getMilestoneProgress(milestone, tasks);
  const daysUntilDue = Math.ceil((new Date(milestone.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // At risk if less than 7 days remaining and less than 80% complete
  if (daysUntilDue < 7 && progress < 80) return 'at-risk';

  return 'on-track';
}

/**
 * Get module color by type
 */
export function getModuleColor(type: ModuleType): string {
  const colors: Record<ModuleType, string> = {
    hardware: '#3B82F6',     // Blue
    software: '#8B5CF6',     // Purple
    firmware: '#F59E0B',     // Amber
    testing: '#EC4899',      // Pink
    design: '#06B6D4',       // Cyan
    procurement: '#F97316',  // Orange
    manufacturing: '#10B981',// Emerald
    qa: '#EF4444',           // Red
    logistics: '#64748B',    // Slate
    enclosure: '#22C55E',    // Green
    pcb: '#0EA5E9',          // Sky
    power: '#A855F7',        // Violet
  };

  return colors[type] || '#6B7280';
}

/**
 * Format module type for display
 */
export function formatModuleType(type: ModuleType): string {
  const labels: Record<ModuleType, string> = {
    hardware: 'Hardware',
    software: 'Software',
    firmware: 'Firmware',
    testing: 'Testing',
    design: 'Design',
    procurement: 'Procurement',
    manufacturing: 'Manufacturing',
    qa: 'QA',
    logistics: 'Logistics',
    enclosure: 'Enclosure',
    pcb: 'PCB',
    power: 'Power',
  };

  return labels[type] || type;
}

/**
 * Sort issues by severity (critical first)
 */
export function sortIssuesBySeverity(issues: Issue[]): Issue[] {
  const severityOrder = { critical: 0, major: 1, minor: 2, trivial: 3 };
  return [...issues].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Sort milestones by date
 */
export function sortMilestonesByDate(milestones: Milestone[]): Milestone[] {
  return [...milestones].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Sort tasks/issues so items assigned to `assigneeId` come first — used to
 * surface a milestone assignee's own work at the top of the Linked
 * Tasks/Issues lists. A stable sort, so relative order within each group is
 * unchanged. No-op when there's no assignee to prioritize.
 */
export function sortByAssignee<T extends { assignees?: { id: string }[] }>(
  items: T[],
  assigneeId?: string | null,
): T[] {
  if (!assigneeId) return items;
  return [...items].sort((a, b) => {
    const aAssigned = a.assignees?.some(m => m.id === assigneeId) ? 0 : 1;
    const bAssigned = b.assignees?.some(m => m.id === assigneeId) ? 0 : 1;
    return aAssigned - bAssigned;
  });
}

/**
 * Progress breakdown interface
 */
export interface ProgressBreakdown {
  moduleProgress: number;
  milestoneProgress: number;
  taskProgress: number;
  issueProgress: number;
  overallProgress: number;
  taskStats?: {
    total: number;
    todo: number;
    inProgress: number;
    review: number;
    done: number;
    blocked: number;
    others: number;
  };
}

const KNOWN_TASK_STATUSES = new Set<string>(DEFAULT_TASK_STATUSES);

/**
 * Calculate project progress as an average of modules, milestones, tasks, and issues
 */
export function calculateProjectProgress(
  tasks: Task[],
  milestones: Milestone[],
  modules: { id: string; name: string; progress?: number }[],
  issues: Issue[]
): ProgressBreakdown {
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
        // Calculate progress for this module specifically from the tasks list
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
    : 0; // 0% if no issues

  // Overall: average only the metrics that have data
  // If project is completely empty, return 0
  const metrics = [];
  if (tasks.length > 0) metrics.push(taskProgress);
  if (milestones.length > 0) metrics.push(milestoneProgress);
  if (modules.length > 0) metrics.push(moduleProgress);
  if (issues.length > 0) metrics.push(issueProgress);

  const overallProgress = metrics.length > 0
    ? Math.round(metrics.reduce((sum, val) => sum + val, 0) / metrics.length)
    : 0;

  return {
    moduleProgress,
    milestoneProgress,
    taskProgress,
    issueProgress,
    overallProgress,
    taskStats: {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      review: tasks.filter(t => t.status === 'review').length,
      done: tasks.filter(t => t.status === 'done').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      // Tasks sitting in a custom Kanban column (a bucket beyond the 5
      // default statuses) still need to be counted somewhere.
      others: tasks.filter(t => !KNOWN_TASK_STATUSES.has(t.status)).length,
    }
  };
}
