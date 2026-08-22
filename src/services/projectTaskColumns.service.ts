import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

export interface ProjectTaskColumn {
  id: string;
  status: string;
  label: string;
  color: string;
  isSpecial?: boolean;
}

export interface CreateTaskColumnInput {
  label: string;
  color: string;
}

export interface UpdateTaskColumnInput {
  label?: string;
  color?: string;
}

// Client-side fallback used before the backend-persisted columns load (or
// when there's no projectId yet, e.g. mock/demo mode). Mirrors the columns
// the backend seeds for every new project — see DEFAULT_TASK_COLUMNS in
// open-plan-ai-backend/src/modules/task-columns/task-columns.service.ts.
export const DEFAULT_COLUMNS: ProjectTaskColumn[] = [
  { id: 'blocked', status: 'blocked', label: 'Dependencies', color: '#ef4444', isSpecial: true },
  { id: 'backlog', status: 'backlog', label: 'Backlog', color: '#6b7280' },
  { id: 'todo', status: 'todo', label: 'To Do', color: '#3b82f6' },
  { id: 'in-progress', status: 'in-progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'review', status: 'review', label: 'In Review', color: '#8b5cf6' },
  { id: 'done', status: 'done', label: 'Done', color: '#10b981', isSpecial: true },
];

interface ApiTaskColumn {
  id: string;
  projectId: string;
  key: string;
  label: string;
  color: string;
  position: number;
  isSpecial: boolean;
  createdAt: string;
  updatedAt: string;
}

function fromApi(raw: ApiTaskColumn): ProjectTaskColumn {
  return {
    id: raw.id,
    status: raw.key,
    label: raw.label,
    color: raw.color,
    isSpecial: raw.isSpecial,
  };
}

export const projectTaskColumnsService = {
  async getByProjectId(projectId: string): Promise<ProjectTaskColumn[]> {
    const data = await apiClient.get<ApiTaskColumn[]>(ENDPOINTS.TASK_COLUMNS.LIST(projectId));
    return (data || []).map(fromApi);
  },

  async create(projectId: string, input: CreateTaskColumnInput): Promise<ProjectTaskColumn> {
    const data = await apiClient.post<ApiTaskColumn>(ENDPOINTS.TASK_COLUMNS.CREATE(projectId), input);
    return fromApi(data);
  },

  async update(columnId: string, input: UpdateTaskColumnInput): Promise<ProjectTaskColumn> {
    const data = await apiClient.patch<ApiTaskColumn>(ENDPOINTS.TASK_COLUMNS.BY_ID(columnId), input);
    return fromApi(data);
  },

  async remove(columnId: string): Promise<void> {
    return apiClient.delete<void>(ENDPOINTS.TASK_COLUMNS.BY_ID(columnId));
  },

  async reorder(projectId: string, columnIds: string[]): Promise<ProjectTaskColumn[]> {
    const data = await apiClient.patch<ApiTaskColumn[]>(ENDPOINTS.TASK_COLUMNS.REORDER(projectId), {
      columnIds,
    });
    return (data || []).map(fromApi);
  },
};
