import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

export interface ProjectIssueColumn {
  id: string;
  status: string;
  label: string;
  color: string;
  isSpecial?: boolean;
}

export interface CreateIssueColumnInput {
  label: string;
  color: string;
}

export interface UpdateIssueColumnInput {
  label?: string;
  color?: string;
}

// Client-side fallback used before the backend-persisted columns load.
// Mirrors DEFAULT_ISSUE_COLUMNS in issue-columns.service.ts.
export const DEFAULT_ISSUE_COLUMNS: ProjectIssueColumn[] = [
  { id: 'open',          status: 'open',          label: 'Open',          color: '#ef4444', isSpecial: true },
  { id: 'in-progress',   status: 'in-progress',   label: 'In Progress',   color: '#f97316', isSpecial: true },
  { id: 'resolved',      status: 'resolved',      label: 'Resolved',      color: '#10b981', isSpecial: true },
  { id: 'wont-fix',      status: 'wont-fix',       label: "Won't Fix",     color: '#6b7280', isSpecial: true },
];

interface ApiIssueColumn {
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

function fromApi(raw: ApiIssueColumn): ProjectIssueColumn {
  return {
    id: raw.id,
    status: raw.key,
    label: raw.label,
    color: raw.color,
    isSpecial: raw.isSpecial,
  };
}

export const issueColumnsService = {
  async getByProjectId(projectId: string): Promise<ProjectIssueColumn[]> {
    const data = await apiClient.get<ApiIssueColumn[]>(ENDPOINTS.ISSUE_COLUMNS.LIST(projectId));
    return (data || []).map(fromApi);
  },

  async create(projectId: string, input: CreateIssueColumnInput): Promise<ProjectIssueColumn> {
    const data = await apiClient.post<ApiIssueColumn>(ENDPOINTS.ISSUE_COLUMNS.CREATE(projectId), input);
    return fromApi(data);
  },

  async update(columnId: string, input: UpdateIssueColumnInput): Promise<ProjectIssueColumn> {
    const data = await apiClient.patch<ApiIssueColumn>(ENDPOINTS.ISSUE_COLUMNS.BY_ID(columnId), input);
    return fromApi(data);
  },

  async remove(columnId: string): Promise<void> {
    return apiClient.delete<void>(ENDPOINTS.ISSUE_COLUMNS.BY_ID(columnId));
  },

  async reorder(projectId: string, columnIds: string[]): Promise<ProjectIssueColumn[]> {
    const data = await apiClient.patch<ApiIssueColumn[]>(ENDPOINTS.ISSUE_COLUMNS.REORDER(projectId), {
      columnIds,
    });
    return (data || []).map(fromApi);
  },
};
