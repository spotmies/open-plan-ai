import { useQuery } from '@tanstack/react-query';
import { locationsService } from '@/services/locations.service';
import { queryKeys } from '@/lib/queryClient';

/** Persisted location names for an org — merged into LocationCombobox alongside the
 * hardcoded presets, so a custom location typed once shows up as a preset next time. */
export function useLocations(orgId?: string) {
  return useQuery({
    queryKey: orgId ? queryKeys.locations.list(orgId) : queryKeys.locations.list('none'),
    queryFn: () => locationsService.getByOrgId(orgId!),
    enabled: !!orgId,
  });
}
