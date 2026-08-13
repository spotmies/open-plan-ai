import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  addWeeks,
  addDays,
  subMonths,
  subWeeks,
  subDays,
  parse,
  isValid,
} from 'date-fns';
import { Task, Milestone, Issue, CalendarFilter, CalendarViewMode, Priority } from '@/types';

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'task' | 'milestone' | 'issue' | 'meeting';
  projectId: string;
  projectName: string;
  // Task-specific
  status?: string;
  priority?: string;
  assignees?: { id: string; name: string; initials: string }[];
  isBlocked?: boolean;
  startDate?: Date;
  // Milestone-specific
  completed?: boolean;
  // Issue-specific
  severity?: string;
  issueStatus?: string;
  // Meeting-specific
  endDate?: Date;
  meetingUri?: string;
  htmlLink?: string;
  attendeeEmails?: string[];
  // Common
  description?: string;
  tags?: string[];
  createdBy?: { id: string; name: string };
}

/**
 * Get all days for a month calendar grid (includes days from prev/next month to fill weeks)
 */
export function getMonthDays(date: Date): CalendarDay[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  return eachDayOfInterval({ start: calendarStart, end: calendarEnd }).map((day) => ({
    date: day,
    isCurrentMonth: isSameMonth(day, date),
    isToday: isToday(day),
  }));
}

/**
 * Get all days for a week view
 */
export function getWeekDays(date: Date): CalendarDay[] {
  const weekStart = startOfWeek(date);
  const weekEnd = endOfWeek(date);

  return eachDayOfInterval({ start: weekStart, end: weekEnd }).map((day) => ({
    date: day,
    isCurrentMonth: true,
    isToday: isToday(day),
  }));
}

/**
 * Navigate to previous period based on view mode
 */
export function navigatePrevious(date: Date, viewMode: CalendarViewMode): Date {
  switch (viewMode) {
    case 'month':
      return subMonths(date, 1);
    case 'week':
      return subWeeks(date, 1);
    case 'day':
      return subDays(date, 1);
  }
}

/**
 * Navigate to next period based on view mode
 */
export function navigateNext(date: Date, viewMode: CalendarViewMode): Date {
  switch (viewMode) {
    case 'month':
      return addMonths(date, 1);
    case 'week':
      return addWeeks(date, 1);
    case 'day':
      return addDays(date, 1);
  }
}

/**
 * Format date range label based on view mode
 */
export function formatDateRangeLabel(date: Date, viewMode: CalendarViewMode): string {
  switch (viewMode) {
    case 'month':
      return format(date, 'MMMM yyyy');
    case 'week': {
      const weekStart = startOfWeek(date);
      const weekEnd = endOfWeek(date);
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd, yyyy')}`;
      }
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    case 'day':
      return format(date, 'EEEE, MMMM d, yyyy');
  }
}

/**
 * Parse date string safely
 */
export function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const result = parse(dateStr, 'yyyy-MM-dd', new Date());
    return isValid(result) ? result : null;
  } catch {
    return null;
  }
}

/**
 * Convert tasks, milestones, and issues to calendar events
 */
export function convertToCalendarEvents(
  tasks: Task[],
  milestones: Milestone[],
  issues: Issue[],
  projectId: string,
  projectName: string
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // Tasks with due dates
  tasks.forEach((task) => {
    const dueDate = parseDate(task.dueDate);
    if (dueDate) {
      events.push({
        id: task.id,
        title: task.title,
        date: dueDate,
        type: 'task',
        projectId,
        projectName,
        status: task.status,
        priority: task.priority,
        assignees: task.assignees?.map((a) => ({ id: a.id, name: a.name, initials: a.initials })),
        isBlocked: task.status === 'blocked' || (task.blockedBy && task.blockedBy.length > 0),
        startDate: parseDate(task.startDate) || undefined,
        description: task.description,
        tags: task.tags,
      });
    }
  });

  // Milestones
  milestones.forEach((milestone) => {
    const date = parseDate(milestone.date);
    if (date) {
      events.push({
        id: milestone.id,
        title: milestone.title,
        date,
        type: 'milestone',
        projectId,
        projectName,
        completed: milestone.completed,
        description: milestone.description,
      });
    }
  });

  // Only critical/major issues with due dates
  issues
    .filter((issue) => issue.severity === 'critical' || issue.severity === 'major')
    .forEach((issue) => {
      const dueDate = parseDate(issue.dueDate);
      if (dueDate) {
        events.push({
          id: issue.id,
          title: issue.title,
          date: dueDate,
          type: 'issue',
          projectId,
          projectName,
          severity: issue.severity,
          issueStatus: issue.status,
          description: issue.description,
          tags: issue.tags,
        });
      }
    });

  return events;
}

/**
 * Group events by date key (YYYY-MM-DD)
 */
export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();

  events.forEach((event) => {
    const dateKey = format(event.date, 'yyyy-MM-dd');
    const existing = grouped.get(dateKey) || [];
    grouped.set(dateKey, [...existing, event]);
  });

  return grouped;
}

/**
 * Get events for a specific date
 */
export function getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events.filter((event) => isSameDay(event.date, date));
}

/**
 * Apply calendar filters to events
 */
export function filterCalendarEvents(
  events: CalendarEvent[],
  filters: CalendarFilter
): CalendarEvent[] {
  return events.filter((event) => {
    // Project filter
    if (filters.projectIds?.length && !filters.projectIds.includes(event.projectId)) {
      return false;
    }

    // Priority filter (applies to tasks and issues)
    if (filters.priority?.length) {
      if (event.type === 'task' || event.type === 'issue') {
        const priority = event.type === 'task' ? event.priority : event.severity;
        if (!priority || !filters.priority.includes(priority as Priority)) {
          return false;
        }
      }
    }

    // Entity type filter
    if (filters.entityType?.length && !filters.entityType.includes(event.type)) {
      return false;
    }

    // Blocked filter
    if (filters.isBlocked !== undefined) {
      if (event.type === 'task') {
        if (filters.isBlocked && !event.isBlocked) return false;
        if (!filters.isBlocked && event.isBlocked) return false;
      }
    }

    // Assigned By filter (task/issue creator — milestones don't carry creator data)
    if (filters.assignedBy?.length) {
      if (!event.createdBy || !filters.assignedBy.includes(event.createdBy.id)) {
        return false;
      }
    }

    return true;
  });
}
