import { describe, it, expect, beforeEach, vi } from 'vitest';
import { issuesService } from '../issues.service';

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

const mockIssue = {
  id: 'issue-1',
  title: 'PCB Short Circuit',
  description: 'Short detected on power rail',
  projectId: 'proj-1',
  category: 'defect',
  severity: 'critical',
  status: 'open',
  reportedAt: '2026-01-01T00:00:00Z',
  reportedBy: { id: 'u-1', name: 'Alice', email: 'alice@test.com', role: 'HW Engineer', initials: 'A' },
  assignees: [],
};

describe('issuesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getByProject ─────────────────────────────────────────────────────────────

  describe('getByProject', () => {
    it('should return issues for the given project', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce([mockIssue]);

      const issues = await issuesService.getByProject('proj-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/projects/proj-1/issues')
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('issue-1');
    });

    it('should return an empty array when the project has no issues', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce([]);

      const issues = await issuesService.getByProject('proj-empty');

      expect(issues).toHaveLength(0);
    });
  });

  // ── getById ──────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return an issue by ID', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockIssue);

      const issue = await issuesService.getById('issue-1');

      expect(issue?.id).toBe('issue-1');
    });

    it('should return null when the API returns a 404', async () => {
      vi.mocked(apiClient.get).mockRejectedValueOnce(
        Object.assign(new Error('Not found'), { response: { status: 404 } })
      );

      const issue = await issuesService.getById('no-such-issue');

      expect(issue).toBeNull();
    });
  });

  // ── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should POST and return the created issue', async () => {
      const created = { ...mockIssue, id: 'issue-new' };
      vi.mocked(apiClient.post).mockResolvedValueOnce(created);

      const issue = await issuesService.create('proj-1', {
        title: 'New Issue',
        description: 'desc',
        category: 'defect',
        severity: 'major',
        status: 'open',
        projectId: 'proj-1',
        reportedBy: { id: 'u-1', name: 'Alice', email: '', role: 'HW', initials: 'A' },
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/projects/proj-1/issues'),
        expect.objectContaining({ title: 'New Issue' })
      );
      expect(issue.id).toBe('issue-new');
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should PATCH the issue and return the updated result', async () => {
      const updated = { ...mockIssue, status: 'in-progress', title: 'Updated' };
      vi.mocked(apiClient.patch).mockResolvedValueOnce(updated);

      const issue = await issuesService.update('issue-1', {
        status: 'in-progress',
        title: 'Updated',
      });

      expect(issue.status).toBe('in-progress');
      expect(issue.title).toBe('Updated');
    });

    it('should PATCH the issue status using the dedicated status endpoint', async () => {
      const updated = { ...mockIssue, status: 'resolved' };
      vi.mocked(apiClient.patch).mockResolvedValueOnce(updated);

      await issuesService.updateStatus('issue-1', 'resolved');

      expect(apiClient.patch).toHaveBeenCalledWith(
        expect.stringContaining('/issues/issue-1/status'),
        expect.objectContaining({ status: 'resolved' })
      );
    });
  });

  // ── delete ───────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should DELETE the issue', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

      await issuesService.delete('issue-1');

      expect(apiClient.delete).toHaveBeenCalledWith(
        expect.stringContaining('/issues/issue-1')
      );
    });
  });
});
