import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

// Snake_case insert/update shapes to maintain compatibility with existing call sites.
export interface ModuleInsert {
  project_id: string;
  name: string;
  module_type?: string;
  description?: string | null;
  status?: string;
  progress?: number;
  milestone_id?: string | null;
  owner_id?: string | null;
}

export interface ModuleUpdate {
  name?: string;
  module_type?: string;
  description?: string | null;
  status?: string;
  progress?: number;
  milestone_id?: string | null;
  owner_id?: string | null;
}

// DB-shape type exported for consumers that do their own adapter mapping.
export interface Module {
  id: string;
  project_id: string;
  name: string;
  module_type: string | null;
  description: string | null;
  status: string | null;
  progress: number | null;
  milestone_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  owner_id: string | null;
  owner: { name: string; avatarUrl: string | null } | null;
  created_by: { id: string; name: string; avatarUrl: string | null } | null;
}

/** Map snake_case insert payload to camelCase for the REST backend. */
function toApiPayload(data: ModuleInsert | ModuleUpdate): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('name' in data && data.name !== undefined) out.name = data.name;
  if ('module_type' in data) out.type = data.module_type;
  if ('description' in data) out.description = data.description;
  if ('status' in data) out.status = data.status;
  if ('progress' in data) out.progress = data.progress;
  if ('milestone_id' in data) out.milestoneId = data.milestone_id;
  if ('owner_id' in data) out.ownerId = data.owner_id;
  if ('project_id' in data) out.projectId = (data as ModuleInsert).project_id;
  return out;
}

/** Map camelCase API response back to the snake_case Module shape. */
function fromApi(raw: Record<string, unknown>): Module {
  return {
    id: raw.id as string,
    project_id: (raw.projectId ?? raw.project_id) as string,
    name: raw.name as string,
    module_type: (raw.type ?? raw.module_type ?? null) as string | null,
    description: (raw.description ?? null) as string | null,
    status: (raw.status ?? null) as string | null,
    progress: (raw.progress ?? null) as number | null,
    milestone_id: (raw.milestoneId ?? raw.milestone_id ?? null) as string | null,
    created_at: (raw.createdAt ?? raw.created_at ?? null) as string | null,
    updated_at: (raw.updatedAt ?? raw.updated_at ?? null) as string | null,
    owner_id: (raw.ownerId ?? raw.owner_id ?? null) as string | null,
    owner: (raw.owner ?? null) as { name: string; avatarUrl: string | null } | null,
    created_by: (raw.createdBy ?? raw.created_by ?? null) as { id: string; name: string; avatarUrl: string | null } | null,
  };
}

export const modulesService = {
  async getAll(): Promise<Module[]> {
    return [];
  },

  async getByProjectId(projectId: string): Promise<Module[]> {
    const data = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.MODULES.LIST(projectId));
    return (data || []).map(fromApi);
  },

  async getById(id: string): Promise<Module | null> {
    const data = await apiClient.get<Record<string, unknown>>(ENDPOINTS.MODULES.BY_ID(id));
    return data ? fromApi(data) : null;
  },

  async create(module: ModuleInsert): Promise<Module> {
    const data = await apiClient.post<Record<string, unknown>>(
      ENDPOINTS.MODULES.LIST(module.project_id),
      toApiPayload(module)
    );
    return fromApi(data);
  },

  async createMany(modules: ModuleInsert[]): Promise<Module[]> {
    return Promise.all(modules.map(m => this.create(m)));
  },

  async update(id: string, updates: ModuleUpdate): Promise<Module> {
    const data = await apiClient.patch<Record<string, unknown>>(
      ENDPOINTS.MODULES.BY_ID(id),
      toApiPayload(updates)
    );
    return fromApi(data);
  },

  async updateMany(updates: { id: string; name?: string; milestone_id?: string | null }[]): Promise<void> {
    await Promise.all(updates.map(u => this.update(u.id, { name: u.name, milestone_id: u.milestone_id })));
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(ENDPOINTS.MODULES.BY_ID(id));
  },

  async deleteMany(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => this.delete(id)));
  },
};
