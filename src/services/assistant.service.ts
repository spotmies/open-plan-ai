import { apiClient } from './api/client';
import { ENDPOINTS } from './api/endpoints';
import type {
  AssistantConversationSummary,
  AssistantConversationDetail,
  AssistantSharedConversation,
  BackendAiScope,
  AssistantFocusEntity,
  AiMessageAttachment,
  AssistantProposal,
  AssistantProposalStatus,
} from '@/features/assistant/assistantData';

export interface CreateConversationInput {
  scope: BackendAiScope;
  projectId?: string;
  orgId?: string;
  message: string;
  focusEntities?: AssistantFocusEntity[];
  attachments?: AiMessageAttachment[];
}

export interface AnswerQuestionInput {
  answers: Array<{ header: string; selected: string[] }>;
}

export const assistantService = {
  listConversations: () =>
    apiClient.get<AssistantConversationSummary[]>(ENDPOINTS.AI_CONVERSATIONS.LIST),

  createConversation: (input: CreateConversationInput) =>
    apiClient.post<AssistantConversationSummary>(ENDPOINTS.AI_CONVERSATIONS.CREATE, input),

  getConversation: (id: string) =>
    apiClient.get<AssistantConversationDetail>(ENDPOINTS.AI_CONVERSATIONS.BY_ID(id)),

  updateConversation: (id: string, input: { title?: string; pinned?: boolean; projectId?: string }) =>
    apiClient.patch<AssistantConversationSummary>(ENDPOINTS.AI_CONVERSATIONS.BY_ID(id), input),

  deleteConversation: (id: string) => apiClient.delete<void>(ENDPOINTS.AI_CONVERSATIONS.BY_ID(id)),

  deleteAllConversations: () => apiClient.delete<void>(ENDPOINTS.AI_CONVERSATIONS.DELETE_ALL),

  sendMessage: (id: string, message: string, attachments?: AiMessageAttachment[]) =>
    apiClient.post(ENDPOINTS.AI_CONVERSATIONS.MESSAGES(id), { message, attachments }),

  // Forks a new sibling for the given message rather than mutating it in
  // place — see the backend's ai-conversations.service.ts editMessage.
  editMessage: (id: string, messageId: string, message: string) =>
    apiClient.patch(ENDPOINTS.AI_CONVERSATIONS.EDIT_MESSAGE(id, messageId), { message }),

  answerQuestion: (id: string, input: AnswerQuestionInput) =>
    apiClient.post(ENDPOINTS.AI_CONVERSATIONS.ANSWER(id), input),

  stopTurn: (id: string) => apiClient.post<{ stopped: boolean }>(ENDPOINTS.AI_CONVERSATIONS.STOP(id), {}),

  // Creates (first call) or refreshes (already shared — same link, new
  // content) a public share link.
  shareConversation: (id: string) =>
    apiClient.post<{ shareId: string; sharedAt: string }>(ENDPOINTS.AI_CONVERSATIONS.SHARE(id), {}),

  unshareConversation: (id: string) => apiClient.delete<void>(ENDPOINTS.AI_CONVERSATIONS.SHARE(id)),

  // Public, unauthenticated — no cookie/session required. Used only by the
  // standalone SharedConversation page.
  getSharedConversation: (shareId: string) =>
    apiClient.get<AssistantSharedConversation>(ENDPOINTS.AI_CONVERSATIONS.SHARED(shareId)),

  // Uploads an ad-hoc Ask composer attachment ahead of sending the message it
  // belongs to. Metadata-only response (no DB row yet) — the caller passes it
  // straight into createConversation()/sendMessage()'s `attachments` field.
  uploadAttachment: async (file: File): Promise<AiMessageAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.raw.post<{ success: boolean; data: AiMessageAttachment }>(
      ENDPOINTS.AI_CONVERSATIONS.UPLOAD_ATTACHMENT,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },

  // ─── Act (phase 2) proposals ────────────────────────────────────────────
  // Confirm/reject responses mirror the conversation-detail shape: strict
  // body (confirm sends {}, I2), server re-reads its own stored payload.

  confirmProposal: async (proposalId: string): Promise<AssistantProposal> => {
    const res = await apiClient.post<{ proposal: AssistantProposal }>(ENDPOINTS.AI_PROPOSALS.CONFIRM(proposalId), {});
    return res.proposal;
  },

  reviseProposal: async (proposalId: string, edits: Record<string, unknown>): Promise<AssistantProposal> => {
    const res = await apiClient.post<{ proposal: AssistantProposal }>(ENDPOINTS.AI_PROPOSALS.REVISE(proposalId), edits);
    return res.proposal;
  },

  rejectProposal: async (proposalId: string, reason?: string): Promise<AssistantProposal> => {
    const res = await apiClient.post<{ proposal: AssistantProposal }>(ENDPOINTS.AI_PROPOSALS.REJECT(proposalId), { reason });
    return res.proposal;
  },

  getProposal: async (proposalId: string): Promise<AssistantProposal> => {
    const res = await apiClient.get<{ proposal: AssistantProposal }>(ENDPOINTS.AI_PROPOSALS.BY_ID(proposalId));
    return res.proposal;
  },

  listConversationProposals: async (
    conversationId: string,
    params?: { status?: AssistantProposalStatus; limit?: number; offset?: number },
  ): Promise<{ proposals: AssistantProposal[]; nextOffset?: number }> => {
    return apiClient.get(ENDPOINTS.AI_PROPOSALS.BY_CONVERSATION(conversationId), { params });
  },
};
