import { attachmentsService, type AttachmentRecord } from './attachments.service';

export interface UploadedProjectFile {
  id: string;
  name: string;
  size: number | null;
  type: string | null;
  url: string;
  path: string;
  uploadedAt: string;
}

function toProjectFile(r: AttachmentRecord): UploadedProjectFile {
  return {
    id: r.id,
    name: r.fileName ?? r.file_name ?? 'Unknown',
    size: r.fileSize ?? r.file_size ?? null,
    type: r.mimeType ?? r.mime_type ?? null,
    url: r.fileUrl ?? r.url ?? '',
    path: r.fileKey ?? r.file_path ?? '',
    uploadedAt: r.createdAt ?? r.uploaded_at ?? new Date().toISOString(),
  };
}

export const projectStorageService = {
  async upload(projectId: string, file: File): Promise<UploadedProjectFile> {
    const record = await attachmentsService.upload({
      entityId: projectId,
      entityType: 'project',
      projectId,
      file,
    });
    return toProjectFile(record);
  },

  async delete(attachmentId: string): Promise<void> {
    await attachmentsService.delete(attachmentId);
  },

  async getFiles(projectId: string): Promise<UploadedProjectFile[]> {
    const records = await attachmentsService.getByEntity(projectId, 'project');
    return records.map(toProjectFile);
  },
};
