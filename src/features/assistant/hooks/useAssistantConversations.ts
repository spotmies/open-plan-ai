import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { assistantService, type CreateConversationInput } from '@/services/assistant.service';

export function useAssistantConversations() {
  return useQuery({
    queryKey: queryKeys.assistant.conversations(),
    queryFn: () => assistantService.listConversations(),
    staleTime: 30 * 1000,
  });
}

export function useCreateAssistantConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConversationInput) => assistantService.createConversation(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assistant.conversations() });
    },
  });
}

export function useUpdateAssistantConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { title?: string; pinned?: boolean } }) =>
      assistantService.updateConversation(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assistant.conversations() });
    },
  });
}

export function useDeleteAssistantConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assistantService.deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assistant.conversations() });
    },
  });
}

export function useDeleteAllAssistantConversations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => assistantService.deleteAllConversations(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assistant.conversations() });
    },
  });
}

// Also serves as "update link" — calling it again on an already-shared
// conversation keeps the same shareId but refreshes the snapshot content.
export function useShareAssistantConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assistantService.shareConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assistant.conversations() });
    },
  });
}

export function useUnshareAssistantConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assistantService.unshareConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assistant.conversations() });
    },
  });
}
