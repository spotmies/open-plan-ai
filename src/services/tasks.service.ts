import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { Task, TeamMember } from '@/types';

// Persists creator info across React Query refetches since the backend doesn't return it.
const creatorByTaskId = new Map<string, TeamMember>();

/** Map legacy underscore status values to the canonical hyphenated DB values. */
function normalizeStatus(status: string | undefined): string {
  const map: Record<string, string> = {
    in_progress:  'in-progress',
    in_review:    'review',
    in_progress_: 'in-progress',
  };
  return map[status ?? ''] ?? status ?? 'todo';
}

/**
 * Normalize a raw API task response so that `moduleIds` is always populated
 * from the `modules` array the backend returns.
 */
export function fromApi(raw: any): Task {
  const apiModules: { id: string }[] = raw.modules || [];
  const moduleIds: string[] =
    raw.moduleIds?.length > 0
      ? raw.moduleIds
      : apiModules.map((m) => m.id);

  const creator = raw.createdBy as { id?: string; name?: string; avatarUrl?: string | null } | null | undefined;
  const hasRealCreator = !!(creator?.id && creator?.name && creator.name !== 'Unknown');

  const resolvedCreator = hasRealCreator
    ? {
        id: creator!.id!,
        name: creator!.name!,
        email: '',
        role: 'member',
        initials: creator!.name!.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
        avatar: creator!.avatarUrl || '',
      }
    : creatorByTaskId.get(raw.id);

  const assignees = (raw.assignees || []).map((a: any) => ({
    ...a,
    avatar: a.avatar ?? a.avatarUrl ?? '',
  }));

  const updater = raw.updatedBy as { id?: string; name?: string; avatarUrl?: string | null } | null | undefined;
  const resolvedUpdater = updater?.id && updater?.name
    ? {
        id: updater.id,
        name: updater.name,
        email: '',
        role: 'member',
        initials: updater.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
        avatar: updater.avatarUrl || '',
      }
    : null;

  return {
    ...raw,
    moduleIds,
    blockedBy: (raw.blockedBy || []).map((d: any) => (typeof d === 'string' ? d : d.id)),
    checklist: Array.isArray(raw.checklist) ? raw.checklist : [],
    createdBy: resolvedCreator,
    updatedBy: resolvedUpdater,
    assignees,
  };
}

/** Build a clean payload that satisfies the backend createTaskSchema. */
function toCreatePayload(task: Partial<Task>): Record<string, unknown> {
  return {
    title: task.title?.trim() || '',
    description: task.description || undefined,
    descriptionBlocks: task.descriptionBlocks ?? undefined,
    status: normalizeStatus(task.status),
    priority: task.priority ?? 'minor',
    milestoneId: task.milestoneId ?? task.milestone?.id ?? undefined,
    dueDate: task.dueDate ?? undefined,
    startDate: task.startDate ?? undefined,
    tags: task.tags ?? [],
    assigneeIds: (task.assignees ?? []).map((a: any) => a.id ?? a).filter(Boolean),
    moduleIds: task.moduleIds ?? [],
    dependsOnIds: task.blockedBy ?? [],
    createdById: task.createdBy?.id ?? undefined,
    checklist: (task.checklist ?? []).map((item: any) => ({
      id: item.id,
      text: item.text,
      completed: item.completed,
      showInBoardView: item.showInBoardView ?? false,
    })),
  };
}

/** Build a clean payload that satisfies the backend createPersonalTaskSchema — no project-scoped fields (milestone/assignees/modules/dependencies). */
function toCreatePersonalPayload(task: Partial<Task>, organizationId: string): Record<string, unknown> {
  return {
    organizationId,
    title: task.title?.trim() || '',
    description: task.description || undefined,
    descriptionBlocks: task.descriptionBlocks ?? undefined,
    status: normalizeStatus(task.status),
    priority: task.priority ?? 'minor',
    dueDate: task.dueDate ?? undefined,
    startDate: task.startDate ?? undefined,
    tags: task.tags ?? [],
    checklist: (task.checklist ?? []).map((item: any) => ({
      id: item.id,
      text: item.text,
      completed: item.completed,
      showInBoardView: item.showInBoardView ?? false,
    })),
  };
}

export const tasksService = {
  /**
   * Get all tasks assigned to the current user across all projects.
   */
  async getMyTasks(organizationId?: string): Promise<(Task & { projectName?: string })[]> {
    const url = organizationId
      ? `${ENDPOINTS.TASKS.ME_ALL}?limit=100&organizationId=${encodeURIComponent(organizationId)}`
      : `${ENDPOINTS.TASKS.ME_ALL}?limit=100`;
    const data = await apiClient.get<any>(url);
    const rows: any[] = data?.data ?? data ?? [];
    return rows.map((raw: any) => ({ ...fromApi(raw), projectName: raw.projectName ?? raw.project_name ?? '' }));
  },

  /**
   * Get tasks for a specific project
   */
  async getByProject(projectId: string, limit?: number, signal?: AbortSignal): Promise<Task[]> {
    const url = limit
      ? `${ENDPOINTS.TASKS.LIST(projectId)}?limit=${limit}`
      : ENDPOINTS.TASKS.LIST(projectId);
    const data = await apiClient.get<any[]>(url, { signal });
    return (data || []).map(fromApi);
  },

  /**
   * Get task by ID
   */
  async getById(taskId: string): Promise<Task | null> {
    try {
      const data = await apiClient.get<any>(ENDPOINTS.TASKS.BY_ID(taskId));
      return data ? fromApi(data) : null;
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) return null;
      throw err;
    }
  },

  /**
   * Create new task
   */
  async create(projectId: string, task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const data = await apiClient.post<any>(ENDPOINTS.TASKS.LIST(projectId), toCreatePayload(task));
    const created = fromApi(data);
    if (task.createdBy && !created.createdBy) {
      created.createdBy = task.createdBy;
      // Cache so every future refetch of this task still shows the creator
      creatorByTaskId.set(created.id, task.createdBy);
    }
    return created;
  },

  /**
   * Create a personal "My Tasks" item — not tied to any project, private to its creator.
   */
  async createPersonal(organizationId: string, task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const data = await apiClient.post<any>(ENDPOINTS.TASKS.CREATE_PERSONAL, toCreatePersonalPayload(task, organizationId));
    return fromApi(data);
  },

  /**
   * Update existing task
   */
  async update(projectId: string, taskId: string, updates: Partial<Task>): Promise<Task> {
    const payload: any = { ...updates };
    if (payload.blockedBy !== undefined) {
      payload.dependsOnIds = payload.blockedBy;
      delete payload.blockedBy;
    }
    if (payload.assignees !== undefined) {
      payload.assigneeIds = (payload.assignees as any[]).map((a: any) => a.id ?? a).filter(Boolean);
      delete payload.assignees;
    }
    const data = await apiClient.patch<any>(ENDPOINTS.TASKS.BY_ID(taskId), payload);
    return fromApi(data);
  },

  /**
   * Update task status
   */
  async updateStatus(taskId: string, status: Task['status']): Promise<Task> {
    return apiClient.patch<Task>(ENDPOINTS.TASKS.STATUS(taskId), { status });
  },

  /**
   * Delete task
   */
  async delete(projectId: string, taskId: string): Promise<void> {
    return apiClient.delete<void>(ENDPOINTS.TASKS.BY_ID(taskId));
  },

  /**
   * Add assignee to task
   */
  async addAssignee(taskId: string, userId: string): Promise<void> {
    return apiClient.post<void>(ENDPOINTS.TASKS.ASSIGNEES(taskId), { userId });
  },

  /**
   * Remove assignee from task
   */
  async removeAssignee(taskId: string, userId: string): Promise<void> {
    return apiClient.delete<void>(ENDPOINTS.TASKS.ASSIGNEE(taskId, userId));
  },

  /**
   * Batch update tasks (e.g., for drag-and-drop reordering)
   */
  async batchUpdate(projectId: string, updates: Array<{ id: string; updates: Partial<Task> }>): Promise<Task[]> {
    const results = await Promise.all(
      updates.map(({ id, updates: taskUpdates }) => this.update(projectId, id, taskUpdates))
    );
    return results;
  },
};
