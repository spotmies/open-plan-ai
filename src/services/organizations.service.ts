import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { resolveFileUrl } from '@/utils/fileUrl';
import type { OrgRole } from '@/types';

export interface OrganizationSettings {
  companyName?: string;
  companySize?: string;
  timezone?: string;
  dateFormat?: string;
  currency?: string;
  logoUrl?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  settings: Record<string, unknown>;
  myRole: OrgRole | null;
  status?: 'active' | 'suspended';
  suspendedReason?: string | null;
  suspendedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  joinedAt: string;
  profile?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    initials: string;
  };
}

export const organizationsService = {
  /**
   * Get all organizations the current user belongs to.
   */
  async getAll(): Promise<Organization[]> {
    return apiClient.get<Organization[]>(ENDPOINTS.ORGANIZATIONS.MY);
  },

  /**
   * Get organization by ID
   */
  async getById(id: string): Promise<Organization | null> {
    return apiClient.get<Organization>(ENDPOINTS.ORGANIZATIONS.BY_ID(id));
  },

  /**
   * Create a new organization
   */
  async create(org: { name: string; slug: string; description?: string }): Promise<Organization> {
    return apiClient.post<Organization>(ENDPOINTS.ORGANIZATIONS.CREATE, {
      name: org.name,
      slug: org.slug,
      description: org.description || null,
    });
  },

  /**
   * Update organization
   */
  async update(id: string, updates: { name?: string; description?: string | null; settings?: Record<string, unknown> }): Promise<Organization> {
    return apiClient.put<Organization>(ENDPOINTS.ORGANIZATIONS.BY_ID(id), updates);
  },

  /**
   * Delete organization
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(ENDPOINTS.ORGANIZATIONS.BY_ID(id));
  },

  /**
   * Get members of an organization
   */
  async getMembers(orgId: string): Promise<OrganizationMember[]> {
    return apiClient.get<OrganizationMember[]>(ENDPOINTS.ORGANIZATIONS.MEMBERS(orgId));
  },

  /**
   * Update member role
   */
  async updateMemberRole(orgId: string, userId: string, role: OrgRole): Promise<void> {
    return apiClient.put<void>(ENDPOINTS.ORGANIZATIONS.MEMBER_ROLE(orgId, userId), { role });
  },

  /**
   * Remove member from organization
   */
  async removeMember(orgId: string, userId: string): Promise<void> {
    return apiClient.delete<void>(ENDPOINTS.ORGANIZATIONS.REMOVE_MEMBER(orgId, userId));
  },

  /**
   * Merge-patch organization settings (preserves keys not in patch).
   */
  async updateSettings(orgId: string, patch: Partial<OrganizationSettings>): Promise<Organization> {
    return apiClient.put<Organization>(ENDPOINTS.ORGANIZATIONS.BY_ID(orgId), { settings: patch });
  },

  /**
   * Add member to organization
   */
  async addMember(orgId: string, userId: string, role: OrgRole = 'maintainer'): Promise<void> {
    return apiClient.post<void>(ENDPOINTS.ORGANIZATIONS.MEMBERS(orgId), { userId, role });
  },

  /**
   * Get all organizations a specific user belongs to
   */
  async getMemberOrganizations(userId: string): Promise<{ organization_id: string; role: string }[]> {
    return apiClient.get<{ organization_id: string; role: string }[]>(ENDPOINTS.USERS.ORGS(userId));
  },

  /**
   * Upload organization logo — single-step endpoint handles S3 + settings update.
   */
  async uploadLogo(orgId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.raw.post<{ success: boolean; data: { logoUrl: string } }>(
      ENDPOINTS.ORGANIZATIONS.LOGO(orgId),
      formData,
      { headers: { 'Content-Type': undefined } },
    );
    const rawUrl = res.data.data.logoUrl;
    return resolveFileUrl(rawUrl) ?? rawUrl;
  },

  /**
   * Remove organization logo.
   */
  async deleteLogo(orgId: string): Promise<void> {
    await apiClient.delete<void>(ENDPOINTS.ORGANIZATIONS.LOGO(orgId));
  },

  /**
   * Generate a unique slug from name
   */
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);
  },
};
