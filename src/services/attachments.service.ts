import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

export interface AttachmentRecord {
  id: string;
  entityId?: string;
  entityType?: string;
  projectId?: string | null;
  fileName?: string;
  fileKey?: string;
  fileUrl?: string;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedBy?: string | null;
  createdAt?: string;
  // Legacy snake_case aliases
  entity_id?: string;
  entity_type?: string;
  file_name?: string;
  file_path?: string;
  file_size?: number | null;
  mime_type?: string | null;
  project_id?: string | null;
  uploaded_by?: string | null;
  uploaded_at?: string | null;
  url?: string;
}

export interface UploadAttachmentInput {
  entityId: string;
  entityType: 'project' | 'task' | 'issue' | 'milestone' | 'module' | 'organization';
  projectId?: string;
  file: File;
}

export const attachmentsService = {
  async upload(input: UploadAttachmentInput): Promise<AttachmentRecord> {
    const formData = new FormData();
    formData.append('file', input.file);
    formData.append('entityId', input.entityId);
    formData.append('entityType', input.entityType);
    if (input.projectId) formData.append('projectId', input.projectId);

    const res = await apiClient.raw.post<{ success: boolean; data: AttachmentRecord }>(
      ENDPOINTS.UPLOADS.ATTACHMENTS,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },

  async getByEntity(entityId: string, entityType: string): Promise<AttachmentRecord[]> {
    try {
      return await apiClient.get<AttachmentRecord[]>(
        ENDPOINTS.UPLOADS.BY_ENTITY(entityType, entityId),
      );
    } catch {
      return [];
    }
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete<void>(ENDPOINTS.UPLOADS.ATTACHMENT(id));
  },
};
