import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

export interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  entityType: string | null;
  entityId: string | null;
  projectId: string | null;
  orgId: string | null;
  metadata: unknown;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null } | null;
}

export type ActivityInsert = Omit<Activity, 'id' | 'createdAt' | 'user'>;

export interface OrgActivitiesPage {
  data: Activity[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const activitiesService = {
  async getAll(orgId?: string): Promise<Activity[]> {
    if (orgId) return apiClient.get(ENDPOINTS.ORGANIZATIONS.ACTIVITIES(orgId));
    return [];
  },

  async getByProjectId(projectId: string): Promise<Activity[]> {
    return apiClient.get(ENDPOINTS.PROJECTS.ACTIVITIES(projectId));
  },

  async getRecent(orgId: string, limit = 10): Promise<Activity[]> {
    try {
      const data = await apiClient.get<Activity[]>(ENDPOINTS.ORGANIZATIONS.ACTIVITIES(orgId));
      return (data || []).slice(0, limit);
    } catch {
      return [];
    }
  },

  // The activities endpoint supports real server-side pagination (?page=&limit=,
  // capped at 100/page) — this is the only caller that actually sends those params
  // and reads back the `meta` envelope, so it goes through `apiClient.raw` instead
  // of the `apiClient.get` wrapper (which unwraps `data` and drops `meta`).
  async getOrgActivitiesPage(orgId: string, page: number, limit: number): Promise<OrgActivitiesPage> {
    const res = await apiClient.raw.get(ENDPOINTS.ORGANIZATIONS.ACTIVITIES(orgId), {
      params: { page, limit },
    });
    return { data: res.data.data ?? [], meta: res.data.meta };
  },

  async create(_activity: ActivityInsert): Promise<Activity> {
    throw new Error('Activities are created server-side');
  },

  async getByEntityId(_entityId: string, _entityType: string): Promise<Activity[]> {
    return [];
  },
};
