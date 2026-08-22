import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { partsService, type CreatePartDto, type UpdatePartDto, type CreateRevisionDto } from '@/services/parts.service';

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
