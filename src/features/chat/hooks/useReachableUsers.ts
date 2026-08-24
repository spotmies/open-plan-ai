import { useQuery } from '@tanstack/react-query';
import { chatService } from '@/services/chat.service';
import { useOrganization } from '@/contexts/OrganizationContext';

export function useReachableUsers() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: ['chat', 'reachable-users', orgId ?? 'all'],
    queryFn: () => chatService.getReachableUsers(orgId),
    enabled: !isOrgLoading,
    staleTime: 1000 * 60 * 5,
  });
}
