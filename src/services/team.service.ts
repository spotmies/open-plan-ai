import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { resolveFileUrl } from '@/utils/fileUrl';
import {
  normalizeInviteEmail,
  inviteMatchesAnyEmail,
  candidateEmailsFromAuthUser,
} from '@/utils/inviteEmail';

export { normalizeInviteEmail, inviteMatchesAnyEmail, candidateEmailsFromAuthUser };

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  department?: string;
  projectCount: number;
  joinedAt: string | null;
  // Kept for backward compatibility with consumers that read avatar_url (e.g. Reports.tsx)
  avatar_url?: string | null;
  initials: string;
}

export interface TeamInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  token: string;
  invited_by: string | null;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string | null;
  organizations?: { name?: string | null };
}

export type InviteOutcome = 'sent' | 'already_pending' | 'created_without_email';

export interface InviteResult {
  outcome: InviteOutcome;
  message?: string;
}

export const normalizeEmail = normalizeInviteEmail;

/** Map an API member response to the TeamMember shape.
 * Backend returns profile data nested under `user`; also handles flat shape. */
function fromApi(raw: Record<string, unknown>): TeamMember {
  const u = (raw.user ?? {}) as Record<string, unknown>;
  const email = (u.email ?? raw.email ?? '') as string;
  const name = ((u.name ?? raw.name ?? '') as string).trim() || email.split('@')[0] || '';
  const avatarUrl = resolveFileUrl(
    (u.avatarUrl ?? u.avatar_url ?? raw.avatarUrl ?? raw.avatar_url ?? null) as string | null
  );
  const initials = ((u.initials ?? raw.initials ?? '') as string) ||
    name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return {
    id: raw.id as string,
    userId: (raw.userId ?? raw.user_id ?? raw.id) as string,
    name,
    email,
    role: (raw.role ?? 'member') as string,
    status: ((raw.status as string) ?? 'active') as 'active' | 'inactive' | 'pending',
    department: raw.department as string | undefined,
    projectCount: (raw.projectCount ?? 0) as number,
    joinedAt: (raw.joinedAt ?? raw.joined_at ?? null) as string | null,
    avatar_url: avatarUrl,
    initials,
  };
}

export interface TeamMembersPage {
  data: TeamMember[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const teamService = {
  async getAll(orgId?: string): Promise<TeamMember[]> {
    if (orgId) return this.getByOrganization(orgId);
    return [];
  },

  // Walks every page — the backend caps a single request at 100 members — so
  // callers that need the full roster (stats, assignee pickers) never see a
  // silently truncated list.
  async getByOrganization(orgId: string): Promise<TeamMember[]> {
    const limit = 100;
    let page = 1;
    const members: TeamMember[] = [];
    for (;;) {
      const r = await apiClient.raw.get(ENDPOINTS.ORGANIZATIONS.MEMBERS(orgId), {
        params: { page, limit },
      });
      const batch = ((r.data.data ?? []) as Record<string, unknown>[]).map(fromApi);
      members.push(...batch);
      const total = r.data.meta?.total ?? members.length;
      if (batch.length < limit || members.length >= total) break;
      page += 1;
    }
    return members;
  },

  async getByOrganizationPaginated(
    orgId: string,
    params: { page: number; limit: number; search?: string },
  ): Promise<TeamMembersPage> {
    const r = await apiClient.raw.get(ENDPOINTS.ORGANIZATIONS.MEMBERS(orgId), {
      params: {
        page: params.page,
        limit: params.limit,
        search: params.search || undefined,
      },
    });
    return {
      data: ((r.data.data ?? []) as Record<string, unknown>[]).map(fromApi),
      meta: r.data.meta,
    };
  },

  async getById(_id: string): Promise<TeamMember | null> {
    // No dedicated per-user endpoint in current API; return null gracefully.
    return null;
  },

  async invite(email: string, role: string, orgId: string, department?: string): Promise<InviteResult> {
    try {
      await apiClient.post<unknown>(ENDPOINTS.ORGANIZATIONS.INVITATIONS(orgId), {
        email,
        role,
        department: department?.trim() || undefined,
      });
      return { outcome: 'sent' };
    } catch (err: any) {
      const raw = err?.response?.data?.error;
      const message: string = typeof raw?.message === 'string'
        ? raw.message
        : typeof raw === 'string'
          ? raw
          : typeof err?.message === 'string'
            ? err.message
            : '';
      const lowered = message.toLowerCase();
      if (lowered.includes('already pending')) {
        return { outcome: 'already_pending', message };
      }
      if (lowered.includes('app_url is not configured')) {
        return { outcome: 'created_without_email', message };
      }
      throw new Error(message || 'Failed to send invitation');
    }
  },

  async getPendingInvitations(orgId: string): Promise<TeamInvitation[]> {
    const data = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.ORGANIZATIONS.INVITATIONS(orgId));
    return (data || []) as TeamInvitation[];
  },

  async getPendingInvitationsForUser(_email: string): Promise<TeamInvitation[]> {
    const data = await apiClient.get<any[]>(ENDPOINTS.ORGANIZATIONS.MY_INVITATIONS);
    return (data || []).map((inv: any) => ({
      id: inv.id,
      organization_id: inv.orgId,
      email: '',
      role: inv.role,
      token: inv.token,
      invited_by: null,
      status: 'pending',
      expires_at: inv.expiresAt,
      accepted_at: null,
      created_at: inv.createdAt,
      organizations: { name: inv.organizationName },
    }));
  },

  async cancelInvitation(invitationId: string, orgId: string): Promise<void> {
    await apiClient.delete<void>(ENDPOINTS.ORGANIZATIONS.REVOKE_INVITATION(orgId, invitationId));
  },

  async getInvitationByToken(_token: string): Promise<TeamInvitation | null> {
    return null;
  },

  async acceptInvitation(invitationIdentifier: string): Promise<void> {
    await apiClient.post<void>(ENDPOINTS.ORGANIZATIONS.ACCEPT_INVITATION, {
      token: invitationIdentifier,
    });
  },

  async updateRole(memberId: string, role: string, orgId: string): Promise<void> {
    await apiClient.patch<void>(ENDPOINTS.ORGANIZATIONS.MEMBER_ROLE(orgId, memberId), { role });
  },

  async updateMember(memberId: string, orgId: string, updates: { role?: string; department?: string }): Promise<void> {
    await apiClient.put<void>(ENDPOINTS.ORGANIZATIONS.MEMBER_ROLE(orgId, memberId), updates);
  },

  async remove(memberId: string, orgId: string): Promise<void> {
    await apiClient.delete<void>(ENDPOINTS.ORGANIZATIONS.REMOVE_MEMBER(orgId, memberId));
  },
};
