import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import type { TaskImportJobStatusDto, CommitImportResult } from '../taskImportData';

export const taskImportService = {
  async startImport(projectId: string, file: File): Promise<TaskImportJobStatusDto> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.raw.post<{ success: boolean; data: TaskImportJobStatusDto }>(
      ENDPOINTS.TASK_IMPORTS.START(projectId),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },

  async getStatus(projectId: string, jobId: string): Promise<TaskImportJobStatusDto> {
    return apiClient.get<TaskImportJobStatusDto>(ENDPOINTS.TASK_IMPORTS.STATUS(projectId, jobId));
  },

  async getConversation(projectId: string, jobId: string): Promise<unknown> {
    return apiClient.get(ENDPOINTS.TASK_IMPORTS.CONVERSATION(projectId, jobId));
  },

  async sendMessage(projectId: string, jobId: string, content: string): Promise<{ messageId: string }> {
    return apiClient.post(ENDPOINTS.TASK_IMPORTS.MESSAGES(projectId, jobId), { content });
  },

  async uploadMessageAttachment(
    projectId: string,
    jobId: string,
    file: File,
  ): Promise<{ messageId: string; attachmentId: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.raw.post<{ success: boolean; data: { messageId: string; attachmentId: string } }>(
      ENDPOINTS.TASK_IMPORTS.MESSAGE_ATTACHMENTS(projectId, jobId),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },

  async commit(projectId: string, jobId: string, proposalId: string): Promise<CommitImportResult> {
    return apiClient.post(ENDPOINTS.TASK_IMPORTS.COMMIT(projectId, jobId), { proposalId });
  },
};
