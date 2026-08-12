import { apiClient } from './api/client';
import { ENDPOINTS } from './api/endpoints';
import type {
  AssistantConversationSummary,
  AssistantConversationDetail,
  AssistantSharedConversation,
  BackendAiScope,
  AssistantFocusEntity,
  AiMessageAttachment,
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

  updateConversation: (id: string, input: { title?: string; pinned?: boolean }) =>
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
};
