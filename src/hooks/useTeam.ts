import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamService, type TeamMember, type TeamInvitation } from '@/services/team.service';
import { queryKeys } from '@/lib/queryClient';

export function useTeamMembers(orgId?: string) {
  return useQuery({
    queryKey: orgId ? [...queryKeys.team.members(), orgId] : queryKeys.team.members(),
    queryFn: () => orgId ? teamService.getByOrganization(orgId) : teamService.getAll(),
    enabled: orgId ? !!orgId : true,
  });
}

export function useTeamMembersPaginated(
  orgId: string | undefined,
  params: { page: number; limit: number; search?: string },
) {
  return useQuery({
    queryKey: [...queryKeys.team.members(), 'page', orgId, params] as const,
    queryFn: () => teamService.getByOrganizationPaginated(orgId!, params),
    enabled: !!orgId,
    placeholderData: (previousData) => previousData,
  });
}

export function useOrganizationTeamMembers(orgId: string) {
  return useQuery({
    queryKey: [...queryKeys.team.all, 'org', orgId] as const,
    queryFn: () => teamService.getByOrganization(orgId),
    enabled: !!orgId,
  });
}

export function useTeamMember(memberId: string) {
  return useQuery({
    queryKey: [...queryKeys.team.all, 'member', memberId] as const,
    queryFn: () => teamService.getById(memberId),
    enabled: !!memberId,
  });
}

export function usePendingInvitations(orgId: string) {
  return useQuery({
    queryKey: [...queryKeys.team.all, 'invitations', orgId] as const,
    queryFn: () => teamService.getPendingInvitations(orgId),
    enabled: !!orgId,
  });
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, role, orgId, department }: { email: string; role: string; orgId: string; department?: string }) =>
      teamService.invite(email, role, orgId, department),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
    },
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invitationId, orgId }: { invitationId: string; orgId: string }) =>
      teamService.cancelInvitation(invitationId, orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => teamService.acceptInvitation(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
    },
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, role, orgId }: { memberId: string; role: string; orgId: string }) =>
      teamService.updateRole(memberId, role, orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
    },
  });
}

export function useUpdateTeamMemberDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, orgId, updates }: { memberId: string; orgId: string; updates: { role?: string; department?: string } }) =>
      teamService.updateMember(memberId, orgId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, orgId }: { memberId: string; orgId: string }) =>
      teamService.remove(memberId, orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
    },
  });
}

export type { TeamMember, TeamInvitation };
