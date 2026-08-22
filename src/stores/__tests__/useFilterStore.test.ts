import { describe, it, expect, beforeEach } from 'vitest';
import { useFilterStore } from '../useFilterStore';

describe('useFilterStore', () => {
  beforeEach(() => {
    // Reset store to default state
    const { resetReportFilters, resetTaskFilters } = useFilterStore.getState();
    resetReportFilters();
    resetTaskFilters();
    useFilterStore.setState({ 
      searchQuery: '',
      projectViewPreferences: {} 
    });
  });

  describe('initial state', () => {
    it('should have default report filters', () => {
      const { reportFilters } = useFilterStore.getState();
      
      expect(reportFilters.timeRange).toBe('30d');
      expect(reportFilters.projectId).toBeUndefined();
      expect(reportFilters.moduleIds).toBeUndefined();
    });

    it('should have empty task filters', () => {
      const { taskFilters } = useFilterStore.getState();
      
      expect(taskFilters).toEqual({});
    });

    it('should have empty search query', () => {
      const { searchQuery } = useFilterStore.getState();
      
      expect(searchQuery).toBe('');
    });

    it('should have empty project view preferences', () => {
      const { projectViewPreferences } = useFilterStore.getState();
      
      expect(projectViewPreferences).toEqual({});
    });
  });

  describe('setReportFilters', () => {
    it('should update report filters partially', () => {
      const { setReportFilters } = useFilterStore.getState();
      
      setReportFilters({ projectId: 'proj-1' });

      const { reportFilters } = useFilterStore.getState();
      expect(reportFilters.projectId).toBe('proj-1');
      expect(reportFilters.timeRange).toBe('30d'); // Should preserve default
    });

    it('should update multiple filter properties', () => {
      const { setReportFilters } = useFilterStore.getState();
      
      setReportFilters({
        projectId: 'proj-1',
        timeRange: '7d',
        priority: ['high', 'critical'],
      });

      const { reportFilters } = useFilterStore.getState();
      expect(reportFilters.projectId).toBe('proj-1');
      expect(reportFilters.timeRange).toBe('7d');
      expect(reportFilters.priority).toEqual(['high', 'critical']);
    });

    it('should handle custom date range', () => {
      const { setReportFilters } = useFilterStore.getState();
      
      setReportFilters({
        timeRange: 'custom',
        customDateRange: {
          start: '2024-01-01',
          end: '2024-03-31',
        },
      });

      const { reportFilters } = useFilterStore.getState();
      expect(reportFilters.timeRange).toBe('custom');
      expect(reportFilters.customDateRange?.start).toBe('2024-01-01');
      expect(reportFilters.customDateRange?.end).toBe('2024-03-31');
    });

    it('should handle array filters (moduleIds, assigneeIds)', () => {
      const { setReportFilters } = useFilterStore.getState();
      
      setReportFilters({
        moduleIds: ['module-1', 'module-2'],
        assigneeIds: ['user-1', 'user-2'],
      });

      const { reportFilters } = useFilterStore.getState();
      expect(reportFilters.moduleIds).toEqual(['module-1', 'module-2']);
      expect(reportFilters.assigneeIds).toEqual(['user-1', 'user-2']);
    });
  });

  describe('resetReportFilters', () => {
    it('should reset to default report filters', () => {
      const { setReportFilters, resetReportFilters } = useFilterStore.getState();
      
      // Set some filters
      setReportFilters({
        projectId: 'proj-1',
        timeRange: '7d',
        priority: ['high'],
      });
      
      // Reset
      resetReportFilters();

      const { reportFilters } = useFilterStore.getState();
      expect(reportFilters.timeRange).toBe('30d');
      expect(reportFilters.projectId).toBeUndefined();
      expect(reportFilters.priority).toBeUndefined();
    });
  });

  describe('setTaskFilters', () => {
    it('should update task filters partially', () => {
      const { setTaskFilters } = useFilterStore.getState();
      
      setTaskFilters({ status: ['todo', 'in-progress'] });

      const { taskFilters } = useFilterStore.getState();
      expect(taskFilters.status).toEqual(['todo', 'in-progress']);
    });

    it('should update multiple task filter properties', () => {
      const { setTaskFilters } = useFilterStore.getState();
      
      setTaskFilters({
        status: ['todo'],
        priority: ['high', 'critical'],
        module: ['software', 'hardware'],
      });

      const { taskFilters } = useFilterStore.getState();
      expect(taskFilters.status).toEqual(['todo']);
      expect(taskFilters.priority).toEqual(['high', 'critical']);
      expect(taskFilters.module).toEqual(['software', 'hardware']);
    });

    it('should handle due date filter', () => {
      const { setTaskFilters } = useFilterStore.getState();
      
      setTaskFilters({ dueDate: 'overdue' });

      const { taskFilters } = useFilterStore.getState();
      expect(taskFilters.dueDate).toBe('overdue');
    });

    it('should handle hasBlockers filter', () => {
      const { setTaskFilters } = useFilterStore.getState();
      
      setTaskFilters({ hasBlockers: true });

      const { taskFilters } = useFilterStore.getState();
      expect(taskFilters.hasBlockers).toBe(true);
    });

    it('should handle milestone filter', () => {
      const { setTaskFilters } = useFilterStore.getState();
      
      setTaskFilters({ milestoneId: 'milestone-1' });

      const { taskFilters } = useFilterStore.getState();
      expect(taskFilters.milestoneId).toBe('milestone-1');
    });
  });

  describe('resetTaskFilters', () => {
    it('should reset to empty task filters', () => {
      const { setTaskFilters, resetTaskFilters } = useFilterStore.getState();
      
      // Set some filters
      setTaskFilters({
        status: ['done'],
        priority: ['low'],
        hasBlockers: true,
      });
      
      // Reset
      resetTaskFilters();

      const { taskFilters } = useFilterStore.getState();
      expect(taskFilters).toEqual({});
    });
  });

  describe('setSearchQuery', () => {
    it('should update search query', () => {
      const { setSearchQuery } = useFilterStore.getState();
      
      setSearchQuery('test search');

      const { searchQuery } = useFilterStore.getState();
      expect(searchQuery).toBe('test search');
    });

    it('should allow empty search query', () => {
      const { setSearchQuery } = useFilterStore.getState();
      
      setSearchQuery('test');
      setSearchQuery('');

      const { searchQuery } = useFilterStore.getState();
      expect(searchQuery).toBe('');
    });

    it('should handle special characters in search', () => {
      const { setSearchQuery } = useFilterStore.getState();
      
      setSearchQuery('test@#$%^&*()');

      const { searchQuery } = useFilterStore.getState();
      expect(searchQuery).toBe('test@#$%^&*()');
    });
  });

  describe('setProjectViewPreference', () => {
    it('should set view preferences for a project', () => {
      const { setProjectViewPreference } = useFilterStore.getState();
      
      setProjectViewPreference('proj-1', {
        section: 'tasks',
        taskViewMode: 'list',
      });

      const { projectViewPreferences } = useFilterStore.getState();
      expect(projectViewPreferences['proj-1']).toBeDefined();
      expect(projectViewPreferences['proj-1']?.section).toBe('tasks');
      expect(projectViewPreferences['proj-1']?.taskViewMode).toBe('list');
    });

    it('should set defaults for unspecified properties', () => {
      const { setProjectViewPreference } = useFilterStore.getState();
      
      setProjectViewPreference('proj-1', { section: 'modules' });

      const { projectViewPreferences } = useFilterStore.getState();
      expect(projectViewPreferences['proj-1']?.section).toBe('modules');
      expect(projectViewPreferences['proj-1']?.taskViewMode).toBe('kanban'); // Default
      expect(projectViewPreferences['proj-1']?.moduleViewMode).toBe('kanban'); // Default
    });

    it('should update existing preferences without losing others', () => {
      const { setProjectViewPreference } = useFilterStore.getState();
      
      // Set initial preferences
      setProjectViewPreference('proj-1', {
        section: 'tasks',
        taskViewMode: 'list',
        moduleViewMode: 'list',
      });
      
      // Update just one property
      setProjectViewPreference('proj-1', { section: 'milestones' });

      const { projectViewPreferences } = useFilterStore.getState();
      expect(projectViewPreferences['proj-1']?.section).toBe('milestones');
      expect(projectViewPreferences['proj-1']?.taskViewMode).toBe('list'); // Preserved
      expect(projectViewPreferences['proj-1']?.moduleViewMode).toBe('list'); // Preserved
    });

    it('should handle multiple project preferences', () => {
      const { setProjectViewPreference } = useFilterStore.getState();
      
      setProjectViewPreference('proj-1', { section: 'tasks' });
      setProjectViewPreference('proj-2', { section: 'issues' });
      setProjectViewPreference('proj-3', { section: 'modules' });

      const { projectViewPreferences } = useFilterStore.getState();
      expect(projectViewPreferences['proj-1']?.section).toBe('tasks');
      expect(projectViewPreferences['proj-2']?.section).toBe('issues');
      expect(projectViewPreferences['proj-3']?.section).toBe('modules');
    });

    it('should handle view mode changes', () => {
      const { setProjectViewPreference } = useFilterStore.getState();
      
      setProjectViewPreference('proj-1', { taskViewMode: 'kanban' });
      expect(useFilterStore.getState().projectViewPreferences['proj-1']?.taskViewMode).toBe('kanban');
      
      setProjectViewPreference('proj-1', { taskViewMode: 'list' });
      expect(useFilterStore.getState().projectViewPreferences['proj-1']?.taskViewMode).toBe('list');
    });
  });

  describe('filter combinations', () => {
    it('should handle complex filter combinations', () => {
      const { setReportFilters, setTaskFilters, setSearchQuery } = useFilterStore.getState();
      
      setReportFilters({
        projectId: 'proj-1',
        timeRange: '90d',
        priority: ['high', 'critical'],
        status: ['in-progress', 'review'],
      });
      
      setTaskFilters({
        assigneeIds: ['user-1'],
        dueDate: 'this-week',
        hasBlockers: false,
      });
      
      setSearchQuery('important task');

      const state = useFilterStore.getState();
      
      expect(state.reportFilters.projectId).toBe('proj-1');
      expect(state.taskFilters.dueDate).toBe('this-week');
      expect(state.searchQuery).toBe('important task');
    });
  });
});
