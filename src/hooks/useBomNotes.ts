import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

export interface BomNoteAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  initials: string | null;
}

export interface BomNote {
  id: string;
  content: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  updatedAt: string;
  author: BomNoteAuthor | null;
}

export function useBomNotes(nodeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bom.notes(nodeId ?? ''),
    queryFn: () => apiClient.get<BomNote[]>(ENDPOINTS.BOM.NODE_NOTES(nodeId!)),
    enabled: !!nodeId,
    staleTime: 30 * 1000,
  });
}

export function useAddBomNote(nodeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiClient.post<BomNote>(ENDPOINTS.BOM.NODE_NOTES(nodeId), { content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.bom.notes(nodeId) }),
  });
}

export function useUpdateBomNote(nodeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: string }) =>
      apiClient.put<BomNote>(ENDPOINTS.COMMENTS.UPDATE(noteId), { content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.bom.notes(nodeId) }),
  });
}

export function useDeleteBomNote(nodeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => apiClient.delete(ENDPOINTS.COMMENTS.DELETE(noteId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.bom.notes(nodeId) }),
  });
}
