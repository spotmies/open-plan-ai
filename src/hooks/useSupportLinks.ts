import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryClient';
import {
  supportLinksService,
  type SupportLink,
  type SupportLinkDetail,
  type CreateSupportLinkInput,
  type UpdateSupportLinkInput,
} from '@/services/supportLinks.service';

export function useSupportLinks(projectId: string | undefined) {
  return useQuery<SupportLink[]>({
    queryKey: queryKeys.supportLinks.list(projectId ?? ''),
    queryFn: () => supportLinksService.list(projectId as string),
    enabled: !!projectId,
  });
}

export function useSupportLink(projectId: string | undefined, linkId: string | undefined) {
  return useQuery<SupportLinkDetail>({
    queryKey: queryKeys.supportLinks.detail(linkId ?? ''),
    queryFn: () => supportLinksService.getById(projectId as string, linkId as string),
    enabled: !!projectId && !!linkId,
  });
}

export function useCreateSupportLink(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupportLinkInput) => supportLinksService.create(projectId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.supportLinks.listRoot(projectId) });
      toast.success('API key created');
    },
    onError: () => toast.error('Failed to create API key'),
  });
}

export function useUpdateSupportLink(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, input }: { linkId: string; input: UpdateSupportLinkInput }) =>
      supportLinksService.update(projectId, linkId, input),
    onSuccess: (_data, { linkId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.supportLinks.listRoot(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.supportLinks.detail(linkId) });
    },
    onError: () => toast.error('Failed to update support link'),
  });
}

export function useRegenerateSupportLinkToken(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => supportLinksService.regenerate(projectId, linkId),
    onSuccess: (_data, linkId) => {
      qc.invalidateQueries({ queryKey: queryKeys.supportLinks.listRoot(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.supportLinks.detail(linkId) });
      toast.success('New API key generated — the old key no longer works');
    },
    onError: () => toast.error('Failed to regenerate key'),
  });
}

export function useDeleteSupportLink(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => supportLinksService.remove(projectId, linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.supportLinks.listRoot(projectId) });
      toast.success('API key deleted');
    },
    onError: () => toast.error('Failed to delete API key'),
  });
}
