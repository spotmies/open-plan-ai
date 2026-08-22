import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tasksService } from '../tasks.service';

// Mock the entire API client so tests never make real HTTP calls
vi.mock('@/services/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  tokenStorage: {
    getAccessToken: vi.fn(() => 'mock-token'),
    setAccessToken: vi.fn(),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
    getRefreshToken: vi.fn(() => null),
  },
}));

import { apiClient } from '@/services/api/client';

const mockTask = {
  id: 'task-1',
  title: 'Test Task',
  description: 'A task for testing',
  status: 'todo',
  priority: 'medium',
  module: 'software',
  blockedBy: [],
  tags: ['test'],
  moduleIds: [],
  checklist: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('tasksService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMyTasks', () => {
    it('should return tasks assigned to the current user', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce([
        { ...mockTask, projectName: 'Project Alpha' },
      ]);

      const tasks = await tasksService.getMyTasks();

      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task-1');
      expect(tasks[0].projectName).toBe('Project Alpha');
    });

    it('should return an empty array when user has no tasks', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce([]);

      const tasks = await tasksService.getMyTasks();

      expect(tasks).toHaveLength(0);
    });
  });

  describe('getByProject', () => {
    it('should return tasks for a given project', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce([mockTask]);

      const tasks = await tasksService.getByProject('project-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/projects/project-1/tasks'),
        { signal: undefined }
      );
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task-1');
    });

    it('should append limit to query when provided', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce([]);

      await tasksService.getByProject('project-1', 50);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
        { signal: undefined }
      );
    });

    it('should normalise blockedBy to an array of strings', async () => {
      const rawTask = { ...mockTask, blockedBy: [{ id: 'task-2' }, { id: 'task-3' }] };
      vi.mocked(apiClient.get).mockResolvedValueOnce([rawTask]);

      const [task] = await tasksService.getByProject('project-1');

      expect(task.blockedBy).toEqual(['task-2', 'task-3']);
    });
  });

  describe('getById', () => {
    it('should return a task by ID', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockTask);

      const task = await tasksService.getById('task-1');

      expect(task?.id).toBe('task-1');
    });

    it('should return null when the API throws a 404', async () => {
      const notFound = Object.assign(new Error('Not found'), {
        response: { status: 404 },
      });
      vi.mocked(apiClient.get).mockRejectedValueOnce(notFound);

      const task = await tasksService.getById('no-such-task');

      expect(task).toBeNull();
    });
  });

  describe('create', () => {
    it('should POST to the project tasks endpoint and return the new task', async () => {
      const created = { ...mockTask, id: 'task-new' };
      vi.mocked(apiClient.post).mockResolvedValueOnce(created);

      const task = await tasksService.create('project-1', {
        title: 'New Task',
        status: 'todo',
        priority: 'high',
        module: 'hardware',
        blockedBy: [],
        tags: [],
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/projects/project-1/tasks'),
        expect.objectContaining({ title: 'New Task', priority: 'high' })
      );
      expect(task.id).toBe('task-new');
    });
  });

  describe('update', () => {
    it('should PATCH the task and return the updated result', async () => {
      const updated = { ...mockTask, title: 'Updated', status: 'in-progress' };
      vi.mocked(apiClient.patch).mockResolvedValueOnce(updated);

      const task = await tasksService.update('project-1', 'task-1', {
        title: 'Updated',
        status: 'in-progress',
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        expect.stringContaining('/tasks/task-1'),
        expect.objectContaining({ title: 'Updated' })
      );
      expect(task.title).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('should call DELETE on the task endpoint', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

      await tasksService.delete('project-1', 'task-1');

      expect(apiClient.delete).toHaveBeenCalledWith(
        expect.stringContaining('/tasks/task-1')
      );
    });
  });
});
