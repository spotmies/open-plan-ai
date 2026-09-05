import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import type { BomAttachment } from './useBomDocuments';

// Evidence files (reports, photos, logs) attached to one test_executions row —
// Requirements Traceability plan §C. Mirrors useBomDocuments.ts's hook shape,
// entityType 'test_execution' instead of 'bom_node'.

const ENTITY_TYPE = 'test_execution';

// Plain async helper — usable outside React hooks (e.g. right after a
// RecordExecutionForm submit, once the new execution's id is known).
export async function uploadTestExecutionAttachmentFile(executionId: string, file: File): Promise<BomAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityId', executionId);
  formData.append('entityType', ENTITY_TYPE);
  const res = await apiClient.raw.post<{ success: boolean; data: BomAttachment }>(
    ENDPOINTS.UPLOADS.ATTACHMENTS,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data.data;
}

export function useTestExecutionAttachments(executionId: string | undefined) {
  return useQuery({
    queryKey: ['test-execution-attachments', executionId],
    queryFn: () => apiClient.get<BomAttachment[]>(ENDPOINTS.UPLOADS.BY_ENTITY(ENTITY_TYPE, executionId!)),
    enabled: !!executionId,
  });
}

export function useUploadTestExecutionAttachment(executionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadTestExecutionAttachmentFile(executionId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-execution-attachments', executionId] });
    },
  });
}

export function useDeleteTestExecutionAttachment(executionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => apiClient.delete<void>(ENDPOINTS.UPLOADS.ATTACHMENT(attachmentId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-execution-attachments', executionId] });
    },
  });
}
