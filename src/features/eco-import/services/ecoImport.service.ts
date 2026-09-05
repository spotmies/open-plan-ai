import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import type { EcoImportJobStatusDto, CommitEcoImportResult } from '../ecoImportData';

export const ecoImportService = {
  async startImport(projectId: string, files: File[]): Promise<EcoImportJobStatusDto> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const res = await apiClient.raw.post<{ success: boolean; data: EcoImportJobStatusDto }>(
      ENDPOINTS.ECO_IMPORTS.START(projectId),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },

  async getStatus(projectId: string, jobId: string): Promise<EcoImportJobStatusDto> {
    return apiClient.get<EcoImportJobStatusDto>(ENDPOINTS.ECO_IMPORTS.STATUS(projectId, jobId));
  },

  async getConversation(projectId: string, jobId: string): Promise<unknown> {
    return apiClient.get(ENDPOINTS.ECO_IMPORTS.CONVERSATION(projectId, jobId));
  },

  async sendMessage(projectId: string, jobId: string, content: string): Promise<{ messageId: string }> {
    return apiClient.post(ENDPOINTS.ECO_IMPORTS.MESSAGES(projectId, jobId), { content });
  },

  async uploadMessageAttachment(
    projectId: string,
    jobId: string,
    file: File,
  ): Promise<{ messageId: string; attachmentId: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.raw.post<{ success: boolean; data: { messageId: string; attachmentId: string } }>(
      ENDPOINTS.ECO_IMPORTS.MESSAGE_ATTACHMENTS(projectId, jobId),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },

  async commit(projectId: string, jobId: string, proposalId: string): Promise<CommitEcoImportResult> {
    // Longer than the client's default 15s — see issueImport.service.ts's
    // commit() comment for why.
    return apiClient.post(ENDPOINTS.ECO_IMPORTS.COMMIT(projectId, jobId), { proposalId }, { timeout: 60000 });
  },
};
