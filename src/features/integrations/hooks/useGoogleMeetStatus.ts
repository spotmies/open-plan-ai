import { useQuery } from '@tanstack/react-query';
import { googleMeetService } from '@/services/googleMeet.service';

/**
 * Real (backend-persisted) Google Meet connection status for a set of other
 * users — e.g. the members of a DM/group — so the caller can tell whether
 * they're actually reachable for a call, rather than trusting anything
 * stored in the local browser.
 */
export function useGoogleMeetStatus(userIds: string[]) {
  const sortedIds = [...userIds].sort();

  return useQuery({
    queryKey: ['google-meet', 'status', sortedIds],
    queryFn: () => googleMeetService.getStatus(sortedIds),
    enabled: sortedIds.length > 0,
    staleTime: 1000 * 30,
  });
}
