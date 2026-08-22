import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

export interface ProjectLink {
  id: string;
  projectId: string;
  // Legacy snake_case compat
  project_id?: string;
  title: string;
  /** @deprecated use title */
  name?: string;
  url: string;
  createdBy: string | null;
  created_by?: string | null;
  createdAt: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
}

export interface CreateProjectLinkInput {
  project_id: string;
  title: string;
  url: string;
}

export interface UpdateProjectLinkInput {
  title?: string;
  url?: string;
}

export const projectLinksService = {
  async create(input: CreateProjectLinkInput): Promise<ProjectLink> {
    return apiClient.post(ENDPOINTS.PROJECTS.LINKS(input.project_id), {
      title: input.title,
      url: input.url,
    });
  },

  async createMany(
    projectId: string,
    links: { title: string; url: string }[]
  ): Promise<ProjectLink[]> {
    if (links.length === 0) return [];
    return Promise.all(
      links.map((l) => this.create({ project_id: projectId, ...l }))
    );
  },

  async getByProject(projectId: string): Promise<ProjectLink[]> {
    return apiClient.get(ENDPOINTS.PROJECTS.LINKS(projectId));
  },

  async update(linkId: string, input: UpdateProjectLinkInput): Promise<ProjectLink> {
    return apiClient.patch(ENDPOINTS.LINKS.UPDATE(linkId), input);
  },

  async delete(linkId: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.LINKS.DELETE(linkId));
  },

  async hardDelete(linkId: string): Promise<void> {
    return this.delete(linkId);
  },
};
