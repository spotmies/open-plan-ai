import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attachmentsService, AttachmentRecord, UploadAttachmentInput } from '@/services/attachments.service';
import { toast } from 'sonner';

/**
 * Query attachments for a project
 */
export function useProjectAttachments(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-attachments', projectId],
    queryFn: () => attachmentsService.getByEntity(projectId!, 'project'),
    enabled: !!projectId,
  });
}

/**
 * Query attachments for a specific entity (task, issue, etc.)
 */
export function useEntityAttachments(entityId: string | undefined, entityType: string) {
  return useQuery({
    queryKey: ['entity-attachments', entityType, entityId],
    queryFn: () => attachmentsService.getByEntity(entityId!, entityType),
    enabled: !!entityId,
  });
}

/**
 * Create attachment mutation (uploads file and creates DB record in one call)
 */
export function useCreateAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UploadAttachmentInput) => attachmentsService.upload(input),
    onSuccess: (data) => {
      if (data.project_id) {
        queryClient.invalidateQueries({ queryKey: ['project-attachments', data.project_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['entity-attachments', data.entity_type, data.entity_id] });
    },
    onError: (error) => {
      toast.error('Failed to create attachment', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}

/**
 * Create multiple attachments mutation
 */
export function useCreateAttachments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inputs: CreateAttachmentInput[]) => attachmentsService.createMany(inputs),
    onSuccess: (data) => {
      // Invalidate all relevant queries
      const projectIds = [...new Set(data.filter(a => a.project_id).map(a => a.project_id))];
      projectIds.forEach(projectId => {
        queryClient.invalidateQueries({ queryKey: ['project-attachments', projectId] });
      });
    },
    onError: (error) => {
      toast.error('Failed to create attachments', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}

/**
 * Delete attachment mutation
 */
export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) => attachmentsService.delete(attachmentId),
    onSuccess: () => {
      // Invalidate all attachment queries as we don't know which one was deleted
      queryClient.invalidateQueries({ queryKey: ['project-attachments'] });
      queryClient.invalidateQueries({ queryKey: ['entity-attachments'] });
      toast.success('Attachment deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete attachment', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}
