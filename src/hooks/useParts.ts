import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { partsService, type CreatePartDto, type UpdatePartDto, type CreateRevisionDto } from '@/services/parts.service';
import type { ApiPartResponse } from '@/features/projects/components/bomData';

export function useOrgParts(
  orgId: string | undefined,
  params?: { search?: string; category?: string; page?: number; limit?: number },
) {
  return useQuery({
    queryKey: queryKeys.parts.list(orgId ?? '', params),
    queryFn:  () => partsService.list(orgId!, params),
    enabled:  !!orgId,
  });
}

/**
 * Live server-side search for part pickers (Add Part, Place Order, Receive
 * Stock, Add Stock On Hand). Those pickers used to only filter `fallback` —
 * the org's parts fetched once, capped at the shared MAX_PAGE_SIZE (100) and
 * sorted alphabetically — client-side. Once an org passes 100 parts, any part
 * sorting past that page (e.g. a newly-created "PWR-..." part in an org with
 * 200+ existing parts) became permanently unfindable by search, since typing
 * into the box could only ever narrow a page that never contained it.
 * Typing now queries the server directly, so the match is decided by the
 * full catalog, not by whatever happened to already be in memory.
 */
export function usePartCatalogSearch(orgId: string | undefined, fallback: ApiPartResponse[]) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const searchResult = useOrgParts(debounced ? orgId : undefined, { search: debounced, limit: 50 });

  const results = useMemo(
    () => (debounced ? (searchResult.data?.data ?? []) : fallback),
    [debounced, searchResult.data, fallback],
  );

  return { query, setQuery, results, isSearching: !!debounced && searchResult.isFetching };
}

export function usePartRevisions(partId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.parts.revisions(partId ?? ''),
    queryFn:  () => partsService.getRevisions(partId!),
    enabled:  !!partId,
  });
}

export function useCreatePart(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePartDto) => partsService.create(orgId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.listRoot(orgId) });
    },
  });
}

export function useUpdatePart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ partId, dto }: { partId: string; dto: UpdatePartDto }) =>
      partsService.update(partId, dto),
    onSuccess: (_data, { partId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.detail(partId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.all });
    },
  });
}

export function useCreateRevision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ partId, dto }: { partId: string; dto: CreateRevisionDto }) =>
      partsService.createRevision(partId, dto),
    onSuccess: (_data, { partId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.revisions(partId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.detail(partId) });
      // Invalidate bom tree so latest revision shows in the tree
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.all });
    },
  });
}
