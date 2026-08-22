import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import type { ProjectRole } from '@/types';

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  added_at: string | null;
  added_by: string | null;
}

export interface ProjectMemberWithProfile extends ProjectMember {
  profile?: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    initials: string;
  };
}

export interface AddProjectMemberInput {
  project_id: string;
  user_id: string;
  role?: ProjectRole;
}

export const projectMembersService = {
  async getByProject(projectId: string): Promise<ProjectMemberWithProfile[]> {
    return apiClient.get(ENDPOINTS.PROJECTS.MEMBERS(projectId));
  },

  async addMember(input: AddProjectMemberInput): Promise<ProjectMember> {
    return apiClient.post(ENDPOINTS.PROJECTS.MEMBERS(input.project_id), {
      userId: input.user_id,
      role: input.role,
    });
  },

  async addMembers(
    projectId: string,
    members: { userId: string; role?: ProjectRole }[]
  ): Promise<ProjectMember[]> {
    if (members.length === 0) return [];
    return Promise.all(
      members.map((m) =>
        this.addMember({ project_id: projectId, user_id: m.userId, role: m.role })
      )
    );
  },

  async updateRole(projectId: string, userId: string, role: ProjectRole): Promise<void> {
    await apiClient.put(ENDPOINTS.PROJECTS.MEMBER_ROLE(projectId, userId), { role });
  },

  async removeMember(projectId: string, userId: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.PROJECTS.MEMBER(projectId, userId));
  },

  async removeMembers(projectId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await Promise.all(userIds.map((uid) => this.removeMember(projectId, uid)));
  },

  async isMember(projectId: string, userId: string): Promise<boolean> {
    try {
      const members = await this.getByProject(projectId);
      return members.some((m) => m.user_id === userId);
    } catch {
      return false;
    }
  },
};
