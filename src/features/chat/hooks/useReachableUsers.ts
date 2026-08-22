import { useQuery } from '@tanstack/react-query';
import { chatService } from '@/services/chat.service';
import { useOrganization } from '@/contexts/OrganizationContext';

export function useReachableUsers() {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;

    return useQuery({
        queryKey: ['chat', 'reachable-users', orgId],
        queryFn: () => chatService.getReachableUsers(orgId),
        enabled: !!orgId,
        staleTime: 1000 * 60 * 5,
    });
}
