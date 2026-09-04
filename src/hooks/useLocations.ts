import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locationsService, type CreateLocationInput, type ApiLocation } from '@/services/locations.service';
import { queryKeys } from '@/lib/queryClient';

export type { ApiLocation, LocationKind, CreateLocationInput } from '@/services/locations.service';

/** The org's full Warehouse -> Shelf -> Box hierarchy, flat (parentId-linked) —
 * the picker and any tree-building helper reconstruct structure from this. */
export function useLocations(orgId?: string) {
  return useQuery({
    queryKey: orgId ? queryKeys.locations.list(orgId) : queryKeys.locations.list('none'),
    queryFn: () => locationsService.getByOrgId(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateLocation(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLocationInput) => locationsService.create(orgId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.locations.list(orgId) }),
  });
}

export function useRenameLocation(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ locationId, name }: { locationId: string; name: string }) =>
      locationsService.rename(orgId, locationId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.locations.list(orgId) }),
  });
}

export function useDeleteLocation(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (locationId: string) => locationsService.remove(orgId, locationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.locations.list(orgId) }),
  });
}

/** Groups a flat location list into its 3 tiers, each keyed by parent id
 * ('' for top-level warehouses) — the shape a cascading picker wants. */
export function groupLocationsByParent(locations: ApiLocation[]): Map<string, ApiLocation[]> {
  const map = new Map<string, ApiLocation[]>();
  locations.forEach((loc) => {
    const key = loc.parentId ?? '';
    const list = map.get(key) ?? [];
    list.push(loc);
    map.set(key, list);
  });
  map.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
  return map;
}
