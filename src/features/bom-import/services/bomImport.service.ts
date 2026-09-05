import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import type { BomImportJobStatusDto, CommitImportResult } from '../bomImportData';

export const bomImportService = {
  async startImport(projectId: string, files: File[], parentNodeId?: string): Promise<BomImportJobStatusDto> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (parentNodeId) formData.append('parentNodeId', parentNodeId);
    const res = await apiClient.raw.post<{ success: boolean; data: BomImportJobStatusDto }>(
      ENDPOINTS.BOM_IMPORTS.START(projectId),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },

  async getStatus(projectId: string, jobId: string): Promise<BomImportJobStatusDto> {
    return apiClient.get<BomImportJobStatusDto>(ENDPOINTS.BOM_IMPORTS.STATUS(projectId, jobId));
  },

  async getConversation(projectId: string, jobId: string): Promise<unknown> {
    return apiClient.get(ENDPOINTS.BOM_IMPORTS.CONVERSATION(projectId, jobId));
  },

  async sendMessage(projectId: string, jobId: string, content: string): Promise<{ messageId: string }> {
    return apiClient.post(ENDPOINTS.BOM_IMPORTS.MESSAGES(projectId, jobId), { content });
  },

  async uploadMessageAttachment(
    projectId: string,
    jobId: string,
    file: File,
  ): Promise<{ messageId: string; attachmentId: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.raw.post<{ success: boolean; data: { messageId: string; attachmentId: string } }>(
      ENDPOINTS.BOM_IMPORTS.MESSAGE_ATTACHMENTS(projectId, jobId),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },

  async commit(projectId: string, jobId: string, proposalId: string): Promise<CommitImportResult> {
    // Longer than the client's default 15s — committing writes every row's
    // part/revision/node rows inside one transaction.
    return apiClient.post(ENDPOINTS.BOM_IMPORTS.COMMIT(projectId, jobId), { proposalId }, { timeout: 60000 });
  },
};
