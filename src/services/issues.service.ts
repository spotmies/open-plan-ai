import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { fromApiIssue } from '@/services/projects.service';
import { Issue } from '@/types';

export const issuesService = {
  /**
   * Get all issues — returns empty array; use getByProject for actual data.
   */
  async getAll(): Promise<Issue[]> {
    return [];
  },

  /**
   * Get issues for a specific project
   */
  async getByProject(projectId: string): Promise<Issue[]> {
    const data = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.ISSUES.LIST(projectId));
    return (data || []).map(fromApiIssue);
  },

  /**
   * Issues assigned to the current user across every project in an org, in
   * one request — backs My Day. Replaces the previous per-project fan-out
   * (see useMyDayTasks.ts), which fired one /projects/:id/issues/all call
   * per project on every load.
   */
  async getMyIssues(
    organizationId?: string,
    options?: { includeResolved?: boolean; resolvedSince?: string }
  ): Promise<Array<Issue & { projectName: string; projectCode: string | null }>> {
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);
    if (options?.includeResolved) params.set('includeResolved', 'true');
    else if (options?.resolvedSince) params.set('resolvedSince', options.resolvedSince);
    const qs = params.toString();
    const url = qs ? `${ENDPOINTS.ISSUES.MY_ALL}?${qs}` : ENDPOINTS.ISSUES.MY_ALL;
    const data = await apiClient.get<Array<Record<string, unknown>>>(url);
    return (data || []).map((raw) => ({
      ...fromApiIssue(raw),
      projectName: (raw.projectName as string) ?? '',
      projectCode: (raw.projectCode as string) ?? null,
    }));
  },

  /**
   * Get issue by ID
   */
  async getById(issueId: string): Promise<Issue | null> {
    try {
      const data = await apiClient.get<Record<string, unknown>>(ENDPOINTS.ISSUES.BY_ID(issueId));
      return data ? fromApiIssue(data) : null;
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) return null;
      throw err;
    }
  },

  /**
   * Create new issue
   */
  async create(projectId: string, issue: Omit<Issue, 'id' | 'reportedAt'>): Promise<Issue> {
    const payload: Record<string, unknown> = {
      title: issue.title,
      category: issue.category,
    };
    if (issue.category === 'other' && issue.categoryOther) payload.categoryOther = issue.categoryOther;
    if (issue.description) payload.description = issue.description;
    if (issue.severity) payload.severity = issue.severity;
    if (issue.status) payload.status = issue.status;
    if ((issue as any).moduleId) payload.moduleId = (issue as any).moduleId;
    // Normalise dueDate to YYYY-MM-DD — the backend rejects full ISO timestamps
    // (see the same normalisation in update() below).
    if ((issue as any).dueDate) payload.dueDate = String((issue as any).dueDate).substring(0, 10);
    const assigneeIds = ((issue as any).assignees || []).map((a: any) => a.id).filter(Boolean);
    if (assigneeIds.length > 0) payload.assigneeIds = assigneeIds;
    const blocksTaskIds = (issue.blocksTaskIds || []).filter(Boolean);
    if (blocksTaskIds.length > 0) payload.blocksTaskIds = blocksTaskIds;
    const blockedByTaskIds = (issue.blockedBy || []).filter(Boolean);
    if (blockedByTaskIds.length > 0) payload.blockedByTaskIds = blockedByTaskIds;
    const blocksMilestoneIds = (issue.blocksMilestoneIds || []).filter(Boolean);
    if (blocksMilestoneIds.length > 0) payload.blocksMilestoneIds = blocksMilestoneIds;
    if (issue.tags && issue.tags.length > 0) payload.tags = issue.tags;
    if (issue.checklist && issue.checklist.length > 0) payload.checklist = issue.checklist;
    if (issue.descriptionBlocks && issue.descriptionBlocks.length > 0) payload.descriptionBlocks = issue.descriptionBlocks;
    if (issue.videoLinks && issue.videoLinks.length > 0) payload.videoLinks = issue.videoLinks;
    // Through fromApiIssue, not returned raw — the backend's create response
    // carries blockedByTasks/blocksTasks as {id,title,status} objects, and
    // only the adapter converts those into the blockedBy/blocksTaskIds string
    // arrays the UI's dependency logic (IssuesView's isDependencyIssue)
    // actually reads. Without it, useCreateIssue's optimistic cache insert
    // has no blockedBy at all, so a just-created blocked issue renders in
    // "Open" for a moment until the next refetch corrects it.
    const raw = await apiClient.post<Record<string, unknown>>(ENDPOINTS.ISSUES.LIST(projectId), payload);
    return fromApiIssue(raw);
  },

  /**
   * Update existing issue
   */
  async update(issueId: string, updates: Partial<Issue>): Promise<Issue> {
    // Only send fields the backend update schema accepts — sending the full
    // Issue object can trigger Zod validation errors (e.g. dueDate as an ISO
    // timestamp instead of YYYY-MM-DD, or unknown fields).
    const payload: Record<string, unknown> = {};
    const u = updates as any;

    if (u.title !== undefined) payload.title = u.title;
    if (u.description !== undefined) payload.description = u.description;
    if (u.category !== undefined) payload.category = u.category;
    if (u.categoryOther !== undefined) payload.categoryOther = u.categoryOther;
    if (u.severity !== undefined) payload.severity = u.severity;
    if (u.status !== undefined) payload.status = u.status;
    if ('moduleId' in updates) payload.moduleId = u.moduleId ?? null;
    if ('resolution' in updates) payload.resolution = u.resolution ?? null;
    if (u.tags !== undefined) payload.tags = u.tags;

    // Normalise dueDate to YYYY-MM-DD (server may return full ISO timestamps)
    if ('dueDate' in updates) {
      payload.dueDate = u.dueDate
        ? String(u.dueDate).substring(0, 10)
        : null;
    }

    // Backend expects assigneeIds (uuid[]); frontend tracks full TeamMember objects.
    if (u.assignees !== undefined) {
      payload.assigneeIds = (u.assignees || []).map((a: any) => a.id).filter(Boolean);
    } else if (u.assigneeIds !== undefined) {
      payload.assigneeIds = u.assigneeIds;
    }

    if (u.blocksTaskIds !== undefined) {
      payload.blocksTaskIds = u.blocksTaskIds;
    }

    if (u.blockedBy !== undefined) {
      payload.blockedByTaskIds = u.blockedBy;
    }

    if (u.blocksMilestoneIds !== undefined) {
      payload.blocksMilestoneIds = u.blocksMilestoneIds;
    }

    if (u.checklist !== undefined) {
      payload.checklist = u.checklist;
    }

    if (u.descriptionBlocks !== undefined) {
      payload.descriptionBlocks = u.descriptionBlocks;
    }

    if (u.videoLinks !== undefined) {
      payload.videoLinks = u.videoLinks;
    }

    return apiClient.patch<Issue>(ENDPOINTS.ISSUES.BY_ID(issueId), payload);
  },

  /**
   * Update issue status
   */
  async updateStatus(issueId: string, status: Issue['status']): Promise<Issue> {
    return apiClient.patch<Issue>(ENDPOINTS.ISSUES.STATUS(issueId), { status });
  },

  /**
   * Delete issue
   */
  async delete(issueId: string): Promise<void> {
    return apiClient.delete<void>(ENDPOINTS.ISSUES.BY_ID(issueId));
  },

  /**
   * Add assignee to issue
   */
  async addAssignee(issueId: string, userId: string): Promise<void> {
    return apiClient.post<void>(ENDPOINTS.ISSUES.ASSIGNEES(issueId), { userId });
  },

  /**
   * Remove assignee from issue
   */
  async removeAssignee(issueId: string, userId: string): Promise<void> {
    return apiClient.delete<void>(ENDPOINTS.ISSUES.ASSIGNEE(issueId, userId));
  },

  /**
   * Get open issues count for an org (fan-out across projects)
   */
  async getOpenCount(orgId?: string): Promise<{ total: number; critical: number }> {
    if (!orgId) return { total: 0, critical: 0 };
    try {
      const { projectsService } = await import('./projects.service');
      const projects = await projectsService.getAll(orgId);
      const allResults = await Promise.all(projects.map(p => this.getByProject(p.id).catch(() => [])));
      const allIssues = allResults.flat();
      const open = allIssues.filter(i => i.status !== 'resolved' && i.status !== 'wont-fix');
      const critical = open.filter(i => (i as any).severity === 'critical' || (i as any).priority === 'critical');
      return { total: open.length, critical: critical.length };
    } catch {
      return { total: 0, critical: 0 };
    }
  },
};
