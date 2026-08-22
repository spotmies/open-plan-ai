import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

// Single source of truth for tag name -> color within a project. A tag
// created here (via an issue, a task, or any future entity) gets a random
// color once, then reuses that same color everywhere it's referenced.
export interface ProjectTag {
  id: string;
  projectId: string;
  name: string;
  color: string;
  /** Live task/issue usage, from the list endpoint — 0 means the tag is deletable. */
  taskCount: number;
  issueCount: number;
}

export interface CreateTagInput {
  name: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

interface ApiTag {
  id: string;
  projectId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
  issueCount?: number;
}

function fromApi(raw: ApiTag): ProjectTag {
  return {
    id: raw.id,
    projectId: raw.projectId,
    name: raw.name,
    color: raw.color,
    // Only the list endpoint reports usage; create/update responses omit it.
    taskCount: raw.taskCount ?? 0,
    issueCount: raw.issueCount ?? 0,
  };
}

export const projectTagsService = {
  async getByProjectId(projectId: string): Promise<ProjectTag[]> {
    const data = await apiClient.get<ApiTag[]>(ENDPOINTS.TAGS.LIST(projectId));
    return (data || []).map(fromApi);
  },

  /**
   * Idempotent "ensure tag exists" call — if a tag with this name (case-insensitive)
   * already exists in the project, the backend returns it unchanged instead of
   * erroring. This is what makes a tag created in one entity reusable in another.
   */
  async create(projectId: string, input: CreateTagInput): Promise<ProjectTag> {
    const data = await apiClient.post<ApiTag>(ENDPOINTS.TAGS.CREATE(projectId), input);
    return fromApi(data);
  },

  /** Renaming cascades server-side into every task/issue that used the old name. */
  async update(tagId: string, input: UpdateTagInput): Promise<ProjectTag> {
    const data = await apiClient.patch<ApiTag>(ENDPOINTS.TAGS.BY_ID(tagId), input);
    return fromApi(data);
  },

  async remove(tagId: string): Promise<void> {
    return apiClient.delete<void>(ENDPOINTS.TAGS.BY_ID(tagId));
  },
};
