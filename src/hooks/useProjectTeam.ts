import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { queryKeys } from '@/lib/queryClient';
import { TeamMember } from '@/types';
import { resolveFileUrl } from '@/utils/fileUrl';

const isValidUuid = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
    /^[0-9a-f]{32}$/i.test(value)
  );
};

/**
 * Fetch all team members (profiles) - for assignment dropdowns
 * Uses org members since there's no global users endpoint.
 */
export function useTeamMembers(orgId?: string) {
  return useOrganizationMembers(orgId);
}

/**
 * Fetch organization members with roles
 */
export function useOrganizationMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.members(orgId || ''),
    queryFn: async (): Promise<TeamMember[]> => {
      if (!orgId) return [];

      // Walks every page — the backend caps a single request at 100 members —
      // so this dropdown never silently drops members beyond the default page size.
      const limit = 100;
      let page = 1;
      const members: Record<string, unknown>[] = [];
      for (;;) {
        const r = await apiClient.raw.get(ENDPOINTS.ORGANIZATIONS.MEMBERS(orgId), {
          params: { page, limit },
        });
        const batch = (r.data.data ?? []) as Record<string, unknown>[];
        members.push(...batch);
        const total = r.data.meta?.total ?? members.length;
        if (batch.length < limit || members.length >= total) break;
        page += 1;
      }

      return members
        .map((m) => {
          const profileId = (m.userId ?? m.user_id ?? m.id) as string | undefined;
          if (!profileId || !isValidUuid(profileId)) return null;

          // Backend nests profile data under `user`; also handle flat shape for flexibility
          const u = (m.user ?? {}) as Record<string, unknown>;
          const email = (u.email ?? m.email ?? '') as string;
          const name = ((u.name ?? m.name ?? '') as string).trim() || email.split('@')[0] || 'Member';
          const rawAvatarUrl = (u.avatarUrl ?? u.avatar_url ?? u.avatar ?? m.avatarUrl ?? m.avatar_url ?? m.avatar ?? undefined) as string | undefined;
          const avatarUrl = resolveFileUrl(rawAvatarUrl) ?? rawAvatarUrl;
          const initials = ((u.initials ?? m.initials ?? name.slice(0, 2).toUpperCase()) as string);

          return {
            id: profileId,
            name,
            email,
            role: (m.role ?? 'member') as string,
            avatar: avatarUrl,
            initials,
          } satisfies TeamMember;
        })
        .filter((member): member is TeamMember => member !== null);
    },
    enabled: !!orgId,
  });
}

/**
 * Fetch project members specifically
 */
export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async (): Promise<TeamMember[]> => {
      if (!projectId) return [];

      const data = await apiClient.get<Record<string, unknown>[]>(ENDPOINTS.PROJECTS.MEMBERS(projectId));
      const members = data || [];

      const seen = new Set<string>();
      return members
        .map((m) => {
          const profileId = (m.userId ?? m.user_id ?? m.id) as string | undefined;
          if (!profileId || !isValidUuid(profileId)) return null;

          if (seen.has(profileId)) return null;
          seen.add(profileId);

          const u = (m.user ?? {}) as Record<string, unknown>;
          const email = (u.email ?? m.email ?? '') as string;
          const name = ((u.name ?? m.name ?? '') as string).trim() || email.split('@')[0] || 'Member';
          const rawAvatarUrl = (u.avatarUrl ?? u.avatar_url ?? u.avatar ?? m.avatarUrl ?? m.avatar_url ?? m.avatar ?? undefined) as string | undefined;
          const avatarUrl = resolveFileUrl(rawAvatarUrl) ?? rawAvatarUrl;
          const initials = ((u.initials ?? m.initials ?? name.slice(0, 2).toUpperCase()) as string);

          return {
            id: profileId,
            name,
            email,
            role: (m.role ?? 'member') as string,
            avatar: avatarUrl,
            initials,
          } satisfies TeamMember;
        })
        .filter((member): member is TeamMember => member !== null);
    },
    enabled: !!projectId,
  });
}
