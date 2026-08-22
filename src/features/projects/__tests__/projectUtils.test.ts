import { describe, it, expect } from 'vitest';
import {
  getMilestoneProgress,
  getMilestoneTasks,
  getBlockingIssues,
  getModuleTasks,
  getModuleProgress,
  getModuleColor,
  formatModuleType,
  sortIssuesBySeverity,
  sortMilestonesByDate,
  calculateProjectProgress,
} from '../utils/projectUtils';
import { Task, Milestone, Issue, ModuleType } from '@/types';

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

const createMilestone = (overrides: Partial<Milestone> = {}): Milestone => ({
  id: `milestone-${Math.random()}`,
  title: 'Test Milestone',
  date: new Date().toISOString(),
  completed: false,
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

describe('projectUtils', () => {
  describe('getModuleColor', () => {
    it('should return correct color for each module type', () => {
      expect(getModuleColor('hardware')).toBe('#3B82F6');
      expect(getModuleColor('software')).toBe('#8B5CF6');
      expect(getModuleColor('firmware')).toBe('#F59E0B');
      expect(getModuleColor('testing')).toBe('#EC4899');
    });

    it('should return default color for unknown type', () => {
      expect(getModuleColor('unknown' as ModuleType)).toBe('#6B7280');
    });
  });

  describe('formatModuleType', () => {
    it('should return correct label for each module type', () => {
      expect(formatModuleType('hardware')).toBe('Hardware');
      expect(formatModuleType('software')).toBe('Software');
      expect(formatModuleType('qa')).toBe('QA');
      expect(formatModuleType('pcb')).toBe('PCB');
    });
  });

  describe('getMilestoneProgress', () => {
    it('should return 0 for milestone with no linked tasks', () => {
      const milestone = createMilestone({ id: 'ms-1' });
      const result = getMilestoneProgress(milestone, []);
      expect(result).toBe(0);
    });

    it('should return 100 for completed milestone with no tasks', () => {
      const milestone = createMilestone({ id: 'ms-1', completed: true });
      const result = getMilestoneProgress(milestone, []);
      expect(result).toBe(100);
    });

    it('should calculate progress based on completed tasks', () => {
      const milestone = createMilestone({ id: 'ms-1' });
      const tasks = [
        createTask({ milestoneId: 'ms-1', status: 'done' }),
        createTask({ milestoneId: 'ms-1', status: 'done' }),
        createTask({ milestoneId: 'ms-1', status: 'in-progress' }),
        createTask({ milestoneId: 'ms-1', status: 'todo' }),
      ];

      const result = getMilestoneProgress(milestone, tasks);
      expect(result).toBe(50);
    });

    it('should use linkedTaskIds when available', () => {
      const milestone = createMilestone({
        id: 'ms-1',
        linkedTaskIds: ['task-1', 'task-2']
      });
      const tasks = [
        createTask({ id: 'task-1', status: 'done' }),
        createTask({ id: 'task-2', status: 'in-progress' }),
        createTask({ id: 'task-3', status: 'done' }), // Not linked
      ];

      const result = getMilestoneProgress(milestone, tasks);
      expect(result).toBe(50);
    });
  });

  describe('getMilestoneTasks', () => {
    it('should return tasks linked by milestoneId', () => {
      const milestone = createMilestone({ id: 'ms-1' });
      const tasks = [
        createTask({ milestoneId: 'ms-1' }),
        createTask({ milestoneId: 'ms-2' }),
        createTask({ milestoneId: 'ms-1' }),
      ];

      const result = getMilestoneTasks(milestone, tasks);
      expect(result.length).toBe(2);
    });

    it('should return tasks linked by linkedTaskIds', () => {
      const milestone = createMilestone({
        id: 'ms-1',
        linkedTaskIds: ['task-1', 'task-3']
      });
      const tasks = [
        createTask({ id: 'task-1' }),
        createTask({ id: 'task-2' }),
        createTask({ id: 'task-3' }),
      ];

      const result = getMilestoneTasks(milestone, tasks);
      expect(result.length).toBe(2);
    });
  });

  describe('getBlockingIssues', () => {
    it('should return issues blocking a specific task', () => {
      const issues = [
        createIssue({ id: 'issue-1', blocksTaskIds: ['task-1'], status: 'open' }),
        createIssue({ id: 'issue-2', blocksTaskIds: ['task-2'], status: 'open' }),
        createIssue({ id: 'issue-3', blocksTaskIds: ['task-1'], status: 'resolved' }),
      ];

      const result = getBlockingIssues('task-1', issues);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('issue-1');
    });

    it('should not return resolved issues', () => {
      const issues = [
        createIssue({ id: 'issue-1', blocksTaskIds: ['task-1'], status: 'resolved' }),
        createIssue({ id: 'issue-2', blocksTaskIds: ['task-1'], status: 'wont-fix' }),
      ];

      const result = getBlockingIssues('task-1', issues);
      expect(result.length).toBe(0);
    });
  });

  describe('getModuleTasks', () => {
    it('should return tasks by moduleId', () => {
      const tasks = [
        createTask({ moduleId: 'mod-1' }),
        createTask({ moduleId: 'mod-2' }),
        createTask({ moduleId: 'mod-1' }),
      ];

      const result = getModuleTasks('mod-1', tasks);
      expect(result.length).toBe(2);
    });

    it('should return tasks by module type', () => {
      const tasks = [
        createTask({ module: 'software' }),
        createTask({ module: 'hardware' }),
        createTask({ module: 'software' }),
      ];

      const result = getModuleTasks('software', tasks);
      expect(result.length).toBe(2);
    });
  });

  describe('getModuleProgress', () => {
    it('should return 0 for module with no tasks', () => {
      const result = getModuleProgress('mod-1', []);
      expect(result).toBe(0);
    });

    it('should calculate progress correctly', () => {
      const tasks = [
        createTask({ moduleId: 'mod-1', status: 'done' }),
        createTask({ moduleId: 'mod-1', status: 'done' }),
        createTask({ moduleId: 'mod-1', status: 'in-progress' }),
        createTask({ moduleId: 'mod-1', status: 'todo' }),
      ];

      const result = getModuleProgress('mod-1', tasks);
      expect(result).toBe(50);
    });
  });

  describe('sortIssuesBySeverity', () => {
    it('should sort issues by severity (critical first)', () => {
      const issues = [
        createIssue({ id: 'issue-1', severity: 'trivial' }),
        createIssue({ id: 'issue-2', severity: 'critical' }),
        createIssue({ id: 'issue-3', severity: 'minor' }),
        createIssue({ id: 'issue-4', severity: 'major' }),
      ];

      const sorted = sortIssuesBySeverity(issues);

      expect(sorted[0].severity).toBe('critical');
      expect(sorted[1].severity).toBe('major');
      expect(sorted[2].severity).toBe('minor');
      expect(sorted[3].severity).toBe('trivial');
    });
  });

  describe('sortMilestonesByDate', () => {
    it('should sort milestones by date (earliest first)', () => {
      const milestones = [
        createMilestone({ id: 'ms-1', date: '2024-03-01' }),
        createMilestone({ id: 'ms-2', date: '2024-01-01' }),
        createMilestone({ id: 'ms-3', date: '2024-02-01' }),
      ];

      const sorted = sortMilestonesByDate(milestones);

      expect(sorted[0].date).toBe('2024-01-01');
      expect(sorted[1].date).toBe('2024-02-01');
      expect(sorted[2].date).toBe('2024-03-01');
    });
  });

  describe('calculateProjectProgress', () => {
    it('should return 0 for empty project', () => {
      const result = calculateProjectProgress([], [], [], []);
      expect(result.overallProgress).toBe(0);
    });

    it('should calculate overall progress as average of available metrics', () => {
      const tasks = [
        createTask({ status: 'done' }),
        createTask({ status: 'todo' }),
      ]; // 50%
      const milestones = [
        createMilestone({ completed: true }),
        createMilestone({ completed: false }),
      ]; // 50%
      const modules = [
        { id: 'mod-1', name: 'Mod 1', progress: 100 },
        { id: 'mod-2', name: 'Mod 2', progress: 0 },
      ]; // 50%
      const issues = [
        createIssue({ status: 'resolved' }),
        createIssue({ status: 'open' }),
      ]; // 50%

      const result = calculateProjectProgress(tasks, milestones, modules, issues);

      expect(result.taskProgress).toBe(50);
      expect(result.milestoneProgress).toBe(50);
      expect(result.moduleProgress).toBe(50);
      expect(result.issueProgress).toBe(50);
      expect(result.overallProgress).toBe(50);
    });

    it('should ignore metrics with no data', () => {
      const tasks = [
        createTask({ status: 'done' }),
      ]; // 100%
      const milestones: Milestone[] = [];
      const modules: any[] = [];
      const issues: Issue[] = [];

      const result = calculateProjectProgress(tasks, milestones, modules, issues);

      expect(result.taskProgress).toBe(100);
      expect(result.milestoneProgress).toBe(0);
      expect(result.overallProgress).toBe(100);
    });

    it('should handle issues without affecting other metrics', () => {
      const tasks = [createTask({ status: 'done' })]; // 100%
      const issues = [createIssue({ status: 'open' })]; // 0%

      const result = calculateProjectProgress(tasks, [], [], issues);

      expect(result.taskProgress).toBe(100);
      expect(result.issueProgress).toBe(0);
      expect(result.overallProgress).toBe(50); // (100 + 0) / 2
    });
  });
});
