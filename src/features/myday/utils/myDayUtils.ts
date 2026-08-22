import { Task, Project, TaskStatus, Issue, IssueStatus, MyDayItem, MyDayItemType } from '@/types';
import { startOfDay, isSameDay, isBefore, isAfter, addDays, format as formatDate } from 'date-fns';

export interface MyDayTask extends Task {
  projectId: string;
  projectName: string;
  isOverdue: boolean;
  isDueToday: boolean;
  isBlockingOthers: boolean;
  isBlocked: boolean;
  hasUnresolvedDependencies: boolean;
}

// Re-export types for convenience
export type { MyDayItem, MyDayItemType } from '@/types';

export type DueDateStatus = 'overdue' | 'today' | 'upcoming' | 'none';

import { parseISO, isValid } from 'date-fns';

/**
 * Parse date strings in local time when value is date-only (yyyy-MM-dd).
 * This avoids UTC conversion drift that can move "today" to yesterday.
 */
function parseDueDateSafe(value?: string): Date | null {
  if (!value) return null;

  // For yyyy-MM-dd format, use manual parsing to ensure local time
  const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnlyRegex.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return isValid(date) ? date : null;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

// Simple memoization cache for due date status
const dueDateStatusCache = new Map<string, { status: DueDateStatus; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds


/**
 * Check if a task or issue was completed/resolved today.
 */
export function isCompletedToday(item: any): boolean {
  if (!item) return false;

  // Try to find the best timestamp for completion
  const completedAt =
    item.resolvedAt ||
    item.resolved_at ||
    item.updatedAt ||
    item.updated_at;

  if (!completedAt) return false;

  const completedDate = new Date(completedAt);
  const now = new Date();

  return isSameDay(completedDate, now);
}

/**
 * Get due date status relative to today
 */
export function getDueDateStatus(dueDate?: string): DueDateStatus {
  if (!dueDate) return 'none';

  // Check cache first
  const cached = dueDateStatusCache.get(dueDate);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.status;
  }

  const today = startOfDay(new Date());
  const parsedDueDate = parseDueDateSafe(dueDate);
  if (!parsedDueDate) {
    dueDateStatusCache.set(dueDate, { status: 'none', timestamp: now });
    return 'none';
  }
  
  const due = startOfDay(parsedDueDate);
  let status: DueDateStatus = 'upcoming';

  if (isBefore(due, today)) {
    status = 'overdue';
  } else if (isSameDay(due, today)) {
    status = 'today';
  }

  dueDateStatusCache.set(dueDate, { status, timestamp: now });
  return status;
}

/**
 * Check if a task is blocking other tasks
 */
export function isBlockingOthers(task: Task, allTasks: Task[]): boolean {
  return allTasks.some(t =>
    t.id !== task.id &&
    t.blockedBy.includes(task.id)
  );
}

/**
 * Check if a task has unresolved dependencies
 */
export function hasUnresolvedDependencies(task: Task, allTasks: Task[]): boolean {
  if (task.blockedBy.length === 0) return false;

  const dependencyIds = task.blockedBy;
  return dependencyIds.some(depId => {
    const depTask = allTasks.find(t => t.id === depId);
    return depTask && depTask.status !== 'done';
  });
}

/**
 * Get all tasks assigned to a user across all projects
 */
export function getUserTasks(projects: Project[], userId: string): MyDayTask[] {
  const allTasks: Task[] = projects.flatMap(p => p.tasks || []);

  return projects.flatMap(project =>
    (project.tasks || [])
      .filter(task => {
        const isAssignedToUser = task.assignees?.some(a => a.id === userId) ?? false;
        return isAssignedToUser && (task.status !== 'done' || isCompletedToday(task));
      })
      .map(task => {
        const dueDateStatus = getDueDateStatus(task.dueDate);
        return {
          ...task,
          projectId: project.id,
          projectName: project.name,
          isOverdue: dueDateStatus === 'overdue',
          isDueToday: dueDateStatus === 'today',
          isBlockingOthers: isBlockingOthers(task, allTasks),
          isBlocked: task.status === 'blocked' || (task.blockedBy?.length ?? 0) > 0,
          hasUnresolvedDependencies: hasUnresolvedDependencies(task, allTasks),
        };
      })
  );
}

/**
 * Get all issues assigned to a user across all projects
 */
export function getUserIssues(projects: Project[], userId: string): Issue[] {
  return projects.flatMap(project =>
    (project.issues || []).filter(issue =>
      (issue.assignees?.some(a => a.id === userId) ?? false) &&
      ((issue.status !== 'resolved') || isCompletedToday(issue))
    )
  );
}

/**
 * Map a Task to MyDayItem
 */
export function mapTaskToMyDayItem(task: Task, project: Project, allTasks: Task[]): MyDayItem {
  const dueDateStatus = getDueDateStatus(task.dueDate);

  return {
    id: task.id,
    itemType: 'task',
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignees: task.assignees || [],
    dueDate: task.dueDate,
    projectId: project.id,
    projectName: project.name,
    isOverdue: dueDateStatus === 'overdue',
    isDueToday: dueDateStatus === 'today',
    isBlocked: task.status === 'blocked' || task.blockedBy.length > 0,
    isBlockingOthers: isBlockingOthers(task, allTasks),
    hasUnresolvedDependencies: hasUnresolvedDependencies(task, allTasks),
    originalTask: task,
  };
}

/**
 * Map an Issue to MyDayItem
 */
export function mapIssueToMyDayItem(issue: Issue, project: Project): MyDayItem {
  const dueDateStatus = getDueDateStatus(issue.dueDate);

  return {
    id: issue.id,
    itemType: 'issue',
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.severity,
    assignees: issue.assignees || [],
    dueDate: issue.dueDate,
    projectId: project.id,
    projectName: project.name,
    isOverdue: dueDateStatus === 'overdue',
    isDueToday: dueDateStatus === 'today',
    isBlocked: false,
    originalIssue: issue,
  };
}

/**
 * Get all items (tasks and issues) assigned to a user across all projects
 */
export function getUserItems(projects: Project[], userId: string): MyDayItem[] {
  const allTasks: Task[] = projects.flatMap(p => p.tasks || []);
  const items: MyDayItem[] = [];

  // Add tasks
  projects.forEach(project => {
    (project.tasks || [])
      .filter(task => {
        const isAssignedToUser = task.assignees?.some(a => a.id === userId) ?? false;
        return isAssignedToUser && (task.status !== 'done' || isCompletedToday(task));
      })
      .forEach(task => {
        items.push(mapTaskToMyDayItem(task, project, allTasks));
      });
  });

  // Add issues
  projects.forEach(project => {
    (project.issues || [])
      .filter(issue =>
        (issue.assignees?.some(a => a.id === userId) ?? false) &&
        ((issue.status !== 'resolved') || isCompletedToday(issue))
      )
      .forEach(issue => {
        items.push(mapIssueToMyDayItem(issue, project));
      });
  });

  return items;
}

/**
 * Categorize tasks into My Day sections
 */
export function categorizeMyDayTasks(tasks: MyDayTask[]): {
  needsAttention: MyDayTask[];
  readyToWork: MyDayTask[];
  waitingBlocked: MyDayTask[];
} {
  const needsAttention: MyDayTask[] = [];
  const readyToWork: MyDayTask[] = [];
  const waitingBlocked: MyDayTask[] = [];

  for (const task of tasks) {
    if (task.status === 'done') {
      continue;
    }

    // Check if task needs attention
    const needsAttentionCheck =
      task.isOverdue ||
      task.priority === 'critical' ||
      task.priority === 'major' ||
      task.isBlockingOthers;

    // Check if task is blocked
    const isBlocked = task.isBlocked || task.hasUnresolvedDependencies;

    if (isBlocked) {
      waitingBlocked.push(task);
    } else if (needsAttentionCheck) {
      needsAttention.push(task);
    } else {
      readyToWork.push(task);
    }
  }

  // Sort by priority and due date
  const sortTasks = (a: MyDayTask, b: MyDayTask) => {
    const priorityOrder = { critical: 0, major: 1, minor: 2, trivial: 3 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    if (a.dueDate && b.dueDate) {
      const aDate = parseDueDateSafe(a.dueDate);
      const bDate = parseDueDateSafe(b.dueDate);
      if (!aDate || !bDate) return 0;
      return aDate.getTime() - bDate.getTime();
    }
    return a.dueDate ? -1 : 1;
  };

  return {
    needsAttention: needsAttention.sort(sortTasks),
    readyToWork: readyToWork.sort(sortTasks),
    waitingBlocked: waitingBlocked.sort(sortTasks),
  };
}

/**
 * Categorize items (tasks and issues) into My Day sections
 */
export function categorizeMyDayItems(items: MyDayItem[]): {
  needsAttention: MyDayItem[];
  readyToWork: MyDayItem[];
  waitingBlocked: MyDayItem[];
} {
  const needsAttention: MyDayItem[] = [];
  const readyToWork: MyDayItem[] = [];
  const waitingBlocked: MyDayItem[] = [];

  for (const item of items) {
    if (item.status === 'done' || item.status === 'resolved') {
      continue;
    }

    // Check if item needs attention
    const needsAttentionCheck =
      item.isOverdue ||
      item.priority === 'critical' ||
      item.priority === 'major' ||
      item.isBlockingOthers;

    // Check if item is blocked
    const isBlocked = item.isBlocked || item.hasUnresolvedDependencies;

    if (isBlocked) {
      waitingBlocked.push(item);
    } else if (needsAttentionCheck) {
      needsAttention.push(item);
    } else {
      readyToWork.push(item);
    }
  }

  // Sort by priority and due date
  const sortItems = (a: MyDayItem, b: MyDayItem) => {
    const priorityOrder: Record<string, number> = {
      critical: 0,
      major: 1,
      minor: 2,
      trivial: 3,
    };
    const aPriority = a.priority || 'trivial';
    const bPriority = b.priority || 'trivial';
    const priorityDiff = (priorityOrder[aPriority] || 3) - (priorityOrder[bPriority] || 3);
    if (priorityDiff !== 0) return priorityDiff;

    if (a.dueDate && b.dueDate) {
      const aDate = parseDueDateSafe(a.dueDate);
      const bDate = parseDueDateSafe(b.dueDate);
      if (!aDate || !bDate) return 0;
      return aDate.getTime() - bDate.getTime();
    }
    return a.dueDate ? -1 : 1;
  };

  return {
    needsAttention: needsAttention.sort(sortItems),
    readyToWork: readyToWork.sort(sortItems),
    waitingBlocked: waitingBlocked.sort(sortItems),
  };
}

/**
 * Get module display info
 */
export function getModuleInfo(module: string): { label: string; color: string } {
  const moduleMap: Record<string, { label: string; color: string }> = {
    hardware: { label: 'Hardware', color: 'bg-module-hardware text-white' },
    software: { label: 'Software', color: 'bg-module-software text-white' },
    firmware: { label: 'Firmware', color: 'bg-module-firmware text-white' },
    testing: { label: 'Testing', color: 'bg-module-testing text-white' },
    design: { label: 'Design', color: 'bg-blue-500 text-white' },
    procurement: { label: 'Procurement', color: 'bg-amber-500 text-white' },
    manufacturing: { label: 'Manufacturing', color: 'bg-slate-500 text-white' },
    qa: { label: 'QA', color: 'bg-purple-500 text-white' },
    logistics: { label: 'Logistics', color: 'bg-cyan-500 text-white' },
  };
  return moduleMap[module] || { label: module, color: 'bg-muted text-muted-foreground' };
}

/**
 * Get priority display info
 */
export function getPriorityInfo(priority: string): { label: string; color: string } {
  const priorityMap: Record<string, { label: string; color: string }> = {
    critical: { label: 'Critical', color: 'bg-priority-critical text-white' },
    high: { label: 'High', color: 'bg-priority-high text-white' },
    medium: { label: 'Medium', color: 'bg-priority-medium text-black' },
    low: { label: 'Low', color: 'bg-priority-low text-muted-foreground' },
  };
  return priorityMap[priority] || { label: priority, color: 'bg-muted text-muted-foreground' };
}

/**
 * Format relative date for display
 */
export function formatDueDate(dueDate?: string): string {
  if (!dueDate) return 'No due date';

  const status = getDueDateStatus(dueDate);
  const date = parseDueDateSafe(dueDate);
  if (!date) return 'No due date';
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  switch (status) {
    case 'overdue':
      return `Overdue: ${formatted}`;
    case 'today':
      return 'Due Today';
    default:
      return `Due ${formatted}`;
  }
}

/**
 * Format task date window for compact cards.
 * Examples:
 * - start+due in same month/year: "13–14 Apr"
 * - different month same year: "30 Apr – 2 May"
 * - different years: "30 Dec 2026 – 2 Jan 2027"
 * - only one date: "14 Apr"
 */
export function formatTaskDateRange(startDate?: string, dueDate?: string): string {
  const start = parseDueDateSafe(startDate);
  const due = parseDueDateSafe(dueDate);

  if (!start && !due) return 'No date';
  if (!start && due) return formatDate(due, 'd MMM');
  if (start && !due) return formatDate(start, 'd MMM');

  if (!start || !due) return 'No date';

  if (isSameDay(start, due)) {
    return formatDate(due, 'd MMM');
  }

  const sameYear = start.getFullYear() === due.getFullYear();
  const sameMonth = sameYear && start.getMonth() === due.getMonth();

  if (sameMonth) {
    return `${formatDate(start, 'd')}–${formatDate(due, 'd MMM')}`;
  }

  if (sameYear) {
    return `${formatDate(start, 'd MMM')} – ${formatDate(due, 'd MMM')}`;
  }

  return `${formatDate(start, 'd MMM yyyy')} – ${formatDate(due, 'd MMM yyyy')}`;
}

export function isDueTomorrow(dueDate?: string): boolean {
  if (!dueDate) return false;
  const tomorrow = addDays(startOfDay(new Date()), 1);
  const parsedDueDate = parseDueDateSafe(dueDate);
  if (!parsedDueDate) return false;
  const due = startOfDay(parsedDueDate);

  return isSameDay(due, tomorrow);
}

export function isDueThisWeek(dueDate?: string): boolean {
  if (!dueDate) return false;
  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 7);
  const parsedDueDate = parseDueDateSafe(dueDate);
  if (!parsedDueDate) return false;
  const due = startOfDay(parsedDueDate);

  return isAfter(due, today) && (isBefore(due, weekEnd) || isSameDay(due, weekEnd));
}

/**
 * Group tasks by project
 */
export function groupTasksByProject(tasks: MyDayTask[]): Map<string, { name: string; tasks: MyDayTask[] }>;
export function groupTasksByProject(items: MyDayItem[]): Map<string, { name: string; tasks: MyDayItem[] }>;
export function groupTasksByProject(items: MyDayTask[] | MyDayItem[]): Map<string, { name: string; tasks: any[] }> {
  const groups = new Map<string, { name: string; tasks: any[] }>();

  for (const item of items) {
    const existing = groups.get(item.projectId);
    if (existing) {
      existing.tasks.push(item);
    } else {
      groups.set(item.projectId, { name: item.projectName, tasks: [item] });
    }
  }

  return groups;
}

/**
 * Group tasks by progress/status
 */
export function groupTasksByProgress(tasks: MyDayTask[]): {
  dependency: MyDayTask[];
  notStarted: MyDayTask[];
  inProgress: MyDayTask[];
  completed: MyDayTask[];
};
export function groupTasksByProgress(items: MyDayItem[]): {
  dependency: MyDayItem[];
  notStarted: MyDayItem[];
  inProgress: MyDayItem[];
  completed: MyDayItem[];
};
export function groupTasksByProgress(items: MyDayTask[] | MyDayItem[]): {
  dependency: any[];
  notStarted: any[];
  inProgress: any[];
  completed: any[];
} {
  const groups = {
    dependency: [] as any[],
    notStarted: [] as any[],
    inProgress: [] as any[],
    completed: [] as any[],
  };

  for (const item of items) {
    if (item.status === 'done' || item.status === 'resolved') {
      groups.completed.push(item);
    } else if (item.status === 'in-progress' || item.status === 'review') {
      groups.inProgress.push(item);
    } else if (item.status === 'blocked' || item.isBlocked || item.hasUnresolvedDependencies) {
      groups.dependency.push(item);
    } else {
      groups.notStarted.push(item);
    }
  }

  return groups;
}

/**
 * Group tasks by due date
 */
export function groupTasksByDueDate(tasks: MyDayTask[]): {
  late: MyDayTask[];
  today: MyDayTask[];
  tomorrow: MyDayTask[];
  thisWeek: MyDayTask[];
  later: MyDayTask[];
};
export function groupTasksByDueDate(items: MyDayItem[]): {
  late: MyDayItem[];
  today: MyDayItem[];
  tomorrow: MyDayItem[];
  thisWeek: MyDayItem[];
  later: MyDayItem[];
};
export function groupTasksByDueDate(items: MyDayTask[] | MyDayItem[]): {
  late: any[];
  today: any[];
  tomorrow: any[];
  thisWeek: any[];
  later: any[];
} {
  const groups = {
    late: [] as any[],
    today: [] as any[],
    tomorrow: [] as any[],
    thisWeek: [] as any[],
    later: [] as any[],
  };

  for (const item of items) {
    if (item.isOverdue) {
      groups.late.push(item);
    } else if (item.isDueToday) {
      groups.today.push(item);
    } else if (isDueTomorrow(item.dueDate)) {
      groups.tomorrow.push(item);
    } else if (isDueThisWeek(item.dueDate)) {
      groups.thisWeek.push(item);
    } else {
      groups.later.push(item);
    }
  }

  return groups;
}

/**
 * Group tasks by priority
 */
export function groupTasksByPriority(tasks: MyDayTask[]): {
  urgent: MyDayTask[];
  important: MyDayTask[];
  medium: MyDayTask[];
  low: MyDayTask[];
};
export function groupTasksByPriority(items: MyDayItem[]): {
  urgent: MyDayItem[];
  important: MyDayItem[];
  medium: MyDayItem[];
  low: MyDayItem[];
};
export function groupTasksByPriority(items: MyDayTask[] | MyDayItem[]): {
  urgent: any[];
  important: any[];
  medium: any[];
  low: any[];
} {
  const groups = {
    urgent: [] as any[],
    important: [] as any[],
    medium: [] as any[],
    low: [] as any[],
  };

  for (const item of items) {
    const priority = item.priority || 'trivial';
    switch (priority) {
      case 'critical':
        groups.urgent.push(item);
        break;
      case 'major':
        groups.important.push(item);
        break;
      case 'minor':
        groups.medium.push(item);
        break;
      default:
        groups.low.push(item);
    }
  }

  return groups;
}
