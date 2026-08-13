import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { queryKeys } from '@/lib/queryClient';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface Meeting {
  id: string;
  organizerId: string;
  title: string;
  startTime: string; // ISO
  endTime: string; // ISO
  meetingUri: string;
  htmlLink: string;
  attendeeEmails: string[];
  createdAt: string;
}

export interface CreateMeetingInput {
  title: string;
  startTime: string; // ISO
  endTime: string; // ISO
  meetingUri: string;
  htmlLink: string;
  attendeeEmails: string[];
}

/**
 * Meetings scheduled via the Calendar page's "Schedule a Meet" dialog,
 * persisted so they show up alongside tasks/milestones/issues — mirrors
 * useAllTasks' single-endpoint aggregation.
 */
export function useAllMeetings() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: queryKeys.meetings.org(orgId),
    queryFn: async (): Promise<Meeting[]> => {
      if (!orgId) return [];
      return apiClient.get<Meeting[]>(ENDPOINTS.ORGANIZATIONS.ALL_MEETINGS(orgId));
    },
    enabled: !!orgId,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useMutation({
    mutationFn: (input: CreateMeetingInput): Promise<Meeting> => {
      if (!orgId) throw new Error('No organization selected');
      return apiClient.post<Meeting>(ENDPOINTS.ORGANIZATIONS.ALL_MEETINGS(orgId), input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.org(orgId) });
    },
  });
}
