import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import type { IssueImportJobStatusDto, CommitImportResult } from '../issueImportData';

export const issueImportService = {
  async startImport(projectId: string, file: File): Promise<IssueImportJobStatusDto> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.raw.post<{ success: boolean; data: IssueImportJobStatusDto }>(
      ENDPOINTS.ISSUE_IMPORTS.START(projectId),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },

  async getStatus(projectId: string, jobId: string): Promise<IssueImportJobStatusDto> {
    return apiClient.get<IssueImportJobStatusDto>(ENDPOINTS.ISSUE_IMPORTS.STATUS(projectId, jobId));
  },

  async getConversation(projectId: string, jobId: string): Promise<unknown> {
    return apiClient.get(ENDPOINTS.ISSUE_IMPORTS.CONVERSATION(projectId, jobId));
  },

  async sendMessage(projectId: string, jobId: string, content: string): Promise<{ messageId: string }> {
    return apiClient.post(ENDPOINTS.ISSUE_IMPORTS.MESSAGES(projectId, jobId), { content });
  },

  async uploadMessageAttachment(
    projectId: string,
    jobId: string,
    file: File,
  ): Promise<{ messageId: string; attachmentId: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.raw.post<{ success: boolean; data: { messageId: string; attachmentId: string } }>(
      ENDPOINTS.ISSUE_IMPORTS.MESSAGE_ATTACHMENTS(projectId, jobId),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },

  async commit(projectId: string, jobId: string, proposalId: string): Promise<CommitImportResult> {
    // Longer than the client's default 15s — committing writes every row's
    // issue/assignee rows inside one transaction, so a big batch can
    // legitimately take longer than a typical request.
    return apiClient.post(ENDPOINTS.ISSUE_IMPORTS.COMMIT(projectId, jobId), { proposalId }, { timeout: 60000 });
  },
};
