import { describe, it, expect } from 'vitest';
import { format, subDays } from 'date-fns';
import {
  calculateKPIs,
  getTaskStatusBreakdown,
  calculateProjectProgress,
  countOpenIssues,
  countOverdueTasks,
  getMilestoneHealth,
  getTeamWorkload,
  getModuleProgress,
  getDateRangeFromTimeRange,
  filterTasksByTimeRange,
} from '../utils/reportsUtils';
import { Task, Issue, Milestone, TeamMember, Module, ModuleType } from '@/types';

// Helper to create minimal task objects
const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${Math.random()}`,
  title: 'Test Task',
  description: '',
  status: 'todo',
  priority: 'medium',
  module: 'software' as ModuleType,
  blockedBy: [],
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createIssue = (overrides: Partial<Issue> = {}): Issue => ({
  id: `issue-${Math.random()}`,
  title: 'Test Issue',
  description: '',
  category: 'defect',
  status: 'open',
  severity: 'minor',
  projectId: 'project-1',
  reportedBy: { id: 'user-1', name: 'Test User', role: 'Developer', email: 'test@example.com', initials: 'TU' },
  reportedAt: new Date().toISOString(),
  ...overrides,
});

describe('reportsUtils', () => {
  describe('calculateProjectProgress', () => {
    it('should return 0% for empty task list', () => {
      const result = calculateProjectProgress([]);
      expect(result).toEqual({ progress: 0, completed: 0, total: 0 });
    });

    it('should calculate 50% when half tasks are done', () => {
      const tasks = [
        createTask({ status: 'done' }),
        createTask({ status: 'done' }),
        createTask({ status: 'in-progress' }),
        createTask({ status: 'todo' }),
      ];

      const result = calculateProjectProgress(tasks);

      expect(result.total).toBe(4);
      expect(result.completed).toBe(2);
      expect(result.progress).toBe(50);
    });

    it('should return 100% when all tasks are done', () => {
      const tasks = [
        createTask({ status: 'done' }),
        createTask({ status: 'done' }),
      ];

      const result = calculateProjectProgress(tasks);
      expect(result.progress).toBe(100);
    });
  });

  describe('countOpenIssues', () => {
    it('should return 0 for empty issues list', () => {
      const result = countOpenIssues([]);
      expect(result).toEqual({ total: 0, critical: 0 });
    });

    it('should count all issues except resolved and wont-fix', () => {
      const issues = [
        createIssue({ status: 'open' }),
        createIssue({ status: 'in-progress' }),
        createIssue({ status: 'future-scope' }),
        createIssue({ status: 'mobile-view-open-issues' }),
        createIssue({ status: 'resolved' }),
        createIssue({ status: 'wont-fix' }),
      ];

      const result = countOpenIssues(issues);
      expect(result.total).toBe(4);
    });

    it('should count critical issues separately', () => {
      const issues = [
        createIssue({ status: 'open', severity: 'critical' }),
        createIssue({ status: 'open', severity: 'minor' }),
        createIssue({ status: 'in-progress', severity: 'critical' }),
      ];

      const result = countOpenIssues(issues);
      expect(result.total).toBe(3);
      expect(result.critical).toBe(2);
    });
  });

  describe('countOverdueTasks', () => {
    const wideRange = { start: subDays(new Date(), 365), end: new Date() };

    it('should return 0 for empty task list', () => {
      const result = countOverdueTasks([], wideRange);
      expect(result).toBe(0);
    });

    it('should not count tasks without due dates', () => {
      const tasks = [createTask({ dueDate: undefined })];
      const result = countOverdueTasks(tasks, wideRange);
      expect(result).toBe(0);
    });

    it('should not count completed tasks even if overdue', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      const tasks = [
        createTask({ status: 'done', dueDate: format(pastDate, 'yyyy-MM-dd') }),
      ];

      const result = countOverdueTasks(tasks, wideRange);
      expect(result).toBe(0);
    });

    it('should count incomplete overdue tasks', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      const tasks = [
        createTask({ status: 'in-progress', dueDate: format(pastDate, 'yyyy-MM-dd') }),
        createTask({ status: 'todo', dueDate: format(pastDate, 'yyyy-MM-dd') }),
      ];

      const result = countOverdueTasks(tasks, wideRange);
      expect(result).toBe(2);
    });

    it('should not count overdue tasks whose due date falls outside the selected range', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      const tasks = [
        createTask({ status: 'in-progress', dueDate: format(pastDate, 'yyyy-MM-dd') }),
      ];

      const narrowRange = { start: subDays(new Date(), 400), end: subDays(new Date(), 380) };
      const result = countOverdueTasks(tasks, narrowRange);
      expect(result).toBe(0);
    });
  });

  describe('getTaskStatusBreakdown', () => {
    it('should return empty array for no tasks', () => {
      const result = getTaskStatusBreakdown([]);
      expect(result).toEqual([]);
    });

    it('should group tasks by status with counts and percentages', () => {
      const tasks = [
        createTask({ status: 'done' }),
        createTask({ status: 'done' }),
        createTask({ status: 'in-progress' }),
        createTask({ status: 'todo' }),
      ];

      const breakdown = getTaskStatusBreakdown(tasks);

      const todoItem = breakdown.find(b => b.status === 'todo');
      const doneItem = breakdown.find(b => b.status === 'done');
      const inProgressItem = breakdown.find(b => b.status === 'in-progress');

      expect(todoItem?.count).toBe(1);
      expect(todoItem?.percentage).toBe(25);
      expect(doneItem?.count).toBe(2);
      expect(doneItem?.percentage).toBe(50);
      expect(inProgressItem?.count).toBe(1);
      expect(inProgressItem?.percentage).toBe(25);
    });

    it('should not include statuses with 0 tasks', () => {
      const tasks = [
        createTask({ status: 'done' }),
        createTask({ status: 'done' }),
      ];

      const breakdown = getTaskStatusBreakdown(tasks);

      expect(breakdown.length).toBe(1);
      expect(breakdown[0].status).toBe('done');
    });
  });

  describe('getDateRangeFromTimeRange', () => {
    it('should return 7 day range for "7d"', () => {
      const { start, end } = getDateRangeFromTimeRange('7d');
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
    });

    it('should return 30 day range for "30d"', () => {
      const { start, end } = getDateRangeFromTimeRange('30d');
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    });

    it('should return 90 day range for "90d"', () => {
      const { start, end } = getDateRangeFromTimeRange('90d');
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(90);
    });

    it('should use custom range when provided', () => {
      const customRange = { start: '2024-01-01', end: '2024-01-15' };
      const { start, end } = getDateRangeFromTimeRange('custom', customRange);

      // Use local date formatting to avoid timezone issues
      const formatLocalDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      expect(formatLocalDate(start)).toBe('2024-01-01');
      expect(formatLocalDate(end)).toBe('2024-01-15');
    });
  });

  describe('filterTasksByTimeRange', () => {
    it('includes a non-done task created within the range even if its due date is in the future', () => {
      const futureDue = format(new Date(Date.now() + 86400000 * 60), 'yyyy-MM-dd');
      const tasks = [
        createTask({ status: 'todo', dueDate: futureDue }),
      ];
      const range = { start: subDays(new Date(), 30), end: new Date() };
      const filtered = filterTasksByTimeRange(tasks, range);
      expect(filtered).toHaveLength(1);
    });

    it('includes a non-done task whose due date falls in the range even if created long ago', () => {
      const dueSoon = format(new Date(Date.now() + 86400000 * 5), 'yyyy-MM-dd');
      const tasks = [
        createTask({ status: 'in-progress', createdAt: '2020-01-01T00:00:00.000Z', dueDate: dueSoon }),
      ];
      const range = { start: subDays(new Date(), 30), end: subDays(new Date(), -30) };
      const filtered = filterTasksByTimeRange(tasks, range);
      expect(filtered).toHaveLength(1);
    });

    it('excludes done tasks completed before the reporting window', () => {
      const oldDone = '2020-01-15T12:00:00.000Z';
      const tasks = [
        createTask({ status: 'done', updatedAt: oldDone, startDate: '2020-01-10' }),
      ];
      const range = { start: subDays(new Date(), 30), end: new Date() };
      const filtered = filterTasksByTimeRange(tasks, range);
      expect(filtered).toHaveLength(0);
    });

    it('excludes a non-done task that was neither created nor due within an old empty range', () => {
      const tasks = [
        createTask({ status: 'in-progress', createdAt: new Date().toISOString(), dueDate: undefined }),
      ];
      const emptyRange = { start: new Date('2020-08-04'), end: new Date('2020-08-04') };
      const filtered = filterTasksByTimeRange(tasks, emptyRange);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('calculateKPIs', () => {
    it('should calculate all KPI metrics correctly', () => {
      const tasks = [
        createTask({ status: 'done' }),
        createTask({ status: 'done' }),
        createTask({ status: 'in-progress' }),
        createTask({ status: 'todo' }),
      ];

      const issues = [
        createIssue({ status: 'open', severity: 'critical' }),
        createIssue({ status: 'open', severity: 'minor' }),
      ];

      const dateRange = { start: new Date(), end: new Date() };
      const kpis = calculateKPIs(tasks, issues, dateRange);

      expect(kpis.totalTasks).toBe(4);
      expect(kpis.completedTasks).toBe(2);
      expect(kpis.projectProgress).toBe(25);
      expect(kpis.openIssues).toBe(2);
      expect(kpis.criticalIssues).toBe(1);
    });
  });

  describe('getMilestoneHealth', () => {
    const createMilestone = (overrides: Partial<Milestone> = {}): Milestone => ({
      id: `milestone-${Math.random()}`,
      title: 'Test Milestone',
      date: new Date().toISOString(),
      completed: false,
      ...overrides,
    });

    it('should return empty array for no milestones', () => {
      const result = getMilestoneHealth([], []);
      expect(result).toEqual([]);
    });

    it('should mark milestone as complete when all tasks done', () => {
      const milestone = createMilestone({ id: 'ms-1', completed: true });
      const tasks = [
        createTask({ milestoneId: 'ms-1', status: 'done' }),
        createTask({ milestoneId: 'ms-1', status: 'done' }),
      ];

      const result = getMilestoneHealth([milestone], tasks);

      expect(result[0].status).toBe('complete');
      expect(result[0].progress).toBe(100);
    });

    it('should calculate progress correctly', () => {
      const milestone = createMilestone({ id: 'ms-1' });
      const tasks = [
        createTask({ milestoneId: 'ms-1', status: 'done' }),
        createTask({ milestoneId: 'ms-1', status: 'in-progress' }),
        createTask({ milestoneId: 'ms-1', status: 'todo' }),
        createTask({ milestoneId: 'ms-1', status: 'todo' }),
      ];

      const result = getMilestoneHealth([milestone], tasks);

      expect(result[0].progress).toBe(25);
      expect(result[0].totalTasks).toBe(4);
      expect(result[0].completedTasks).toBe(1);
    });
  });

  describe('getTeamWorkload', () => {
    const createTeamMember = (overrides: Partial<TeamMember> = {}): TeamMember => ({
      id: `member-${Math.random()}`,
      name: 'Test Member',
      email: 'test@example.com',
      role: 'Developer',
      initials: 'TM',
      ...overrides,
    });

    it('should return empty array when no team members exist', () => {
      const members: TeamMember[] = [];
      const tasks: Task[] = [];

      const result = getTeamWorkload(tasks, members);
      expect(result).toEqual([]);
    });

    it('should calculate workload for assigned members', () => {
      const member = createTeamMember({ id: 'user-1', name: 'Alice' });
      const tasks = [
        createTask({ status: 'done', assignees: [member] }),
        createTask({ status: 'in-progress', assignees: [member] }),
        createTask({ status: 'todo', assignees: [member] }),
      ];

      const result = getTeamWorkload(tasks, [member]);

      expect(result[0].totalTasks).toBe(3);
      expect(result[0].completedTasks).toBe(1);
      expect(result[0].inProgressTasks).toBe(1);
    });
  });

  describe('getModuleProgress', () => {
    const createModule = (overrides: Partial<Module> = {}): Module => ({
      id: `module-${Math.random()}`,
      name: 'Test Module',
      type: 'software' as ModuleType,
      progress: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      ...overrides,
    });

    it('should still include modules with no tasks at 0% progress', () => {
      const modules = [createModule()];
      const result = getModuleProgress([], modules);
      expect(result).toHaveLength(1);
      expect(result[0].progress).toBe(0);
      expect(result[0].totalTasks).toBe(0);
    });

    it('should calculate progress per module', () => {
      const module = createModule({ id: 'mod-1' });
      const tasks = [
        createTask({ moduleId: 'mod-1', status: 'done' }),
        createTask({ moduleId: 'mod-1', status: 'done' }),
        createTask({ moduleId: 'mod-1', status: 'in-progress' }),
        createTask({ moduleId: 'mod-1', status: 'todo' }),
      ];

      const result = getModuleProgress(tasks, [module]);

      expect(result[0].progress).toBe(50);
      expect(result[0].totalTasks).toBe(4);
      expect(result[0].completedTasks).toBe(2);
    });
  });
});
