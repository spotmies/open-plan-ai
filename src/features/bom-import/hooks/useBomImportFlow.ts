import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { config } from '@/config';
import { queryKeys } from '@/lib/queryClient';
import { bomImportService } from '../services/bomImport.service';
import type { BomImportJobStatusDto, ImportAskUserQuestion } from '../bomImportData';

interface ConversationDetail {
  messages: Array<{ id: string; role: string; content: string | null; createdAt: string }>;
  proposals: Array<{ id: string; status: string; preview: unknown; warnings: unknown; summary: string; result: unknown }>;
}

const ACTIVE_JOB_POLL_MS = 2500;
const TERMINAL_STATUSES = new Set(['awaiting_review', 'completed', 'failed']);

/**
 * Drives the whole import flow after a file has been uploaded. Mirrors
 * issue-import/hooks/useIssueImportFlow.ts — see that file's header comment
 * for the socket/transport rationale, which applies unchanged here.
 */
export function useBomImportFlow(projectId: string, jobId: string | null) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<ImportAskUserQuestion[] | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [assistantWorking, setAssistantWorking] = useState(false);

  const jobQuery = useQuery<BomImportJobStatusDto>({
    queryKey: ['bom-import-job', projectId, jobId],
    queryFn: () => bomImportService.getStatus(projectId, jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_STATUSES.has(status) ? false : ACTIVE_JOB_POLL_MS;
    },
  });

  const conversationId = jobQuery.data?.conversationId ?? null;

  const conversationQuery = useQuery<ConversationDetail>({
    queryKey: ['bom-import-conversation', conversationId],
    queryFn: () => bomImportService.getConversation(projectId, jobId!) as Promise<ConversationDetail>,
    enabled: !!conversationId,
  });

  const refetchConversation = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['bom-import-conversation', conversationId] });
  }, [queryClient, conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const socket = io(config.api.wsUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('join-ai-conversation', conversationId));
    socket.on('ai:card', () => {
      setAssistantWorking(true);
      refetchConversation();
    });
    socket.on('ai:proposal', () => {
      setAssistantWorking(true);
      refetchConversation();
    });
    socket.on('ai:proposal-update', () => {
      setAssistantWorking(true);
      refetchConversation();
    });
    socket.on('ai:tool-call', () => setAssistantWorking(true));
    socket.on('ai:tool-result', () => setAssistantWorking(true));
    socket.on('ai:done', () => {
      setAssistantWorking(false);
      setPendingQuestion(null);
      refetchConversation();
    });
    socket.on('ai:question', (payload: { questions: ImportAskUserQuestion[] }) => {
      setAssistantWorking(false);
      setPendingQuestion(payload.questions);
      refetchConversation();
    });
    socket.on('ai:error', (payload: { message: string }) => {
      setAssistantWorking(false);
      setLiveError(payload.message);
      queryClient.invalidateQueries({ queryKey: ['bom-import-job', projectId, jobId] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversationId, projectId, jobId, queryClient, refetchConversation]);

  const sendMessage = useCallback(
    async (content: string): Promise<{ messageId: string } | undefined> => {
      if (!jobId) return undefined;
      setLiveError(null);
      setAssistantWorking(true);
      try {
        const result = await bomImportService.sendMessage(projectId, jobId, content);
        refetchConversation();
        return result;
      } catch (err) {
        setAssistantWorking(false);
        setLiveError(err instanceof Error ? err.message : 'Failed to send that message. Please try again.');
        throw err;
      }
    },
    [projectId, jobId, refetchConversation],
  );

  const uploadAttachment = useCallback(
    async (file: File) => {
      if (!jobId) return;
      setLiveError(null);
      setAssistantWorking(true);
      try {
        await bomImportService.uploadMessageAttachment(projectId, jobId, file);
        refetchConversation();
      } catch (err) {
        setAssistantWorking(false);
        setLiveError(err instanceof Error ? err.message : 'Failed to upload that file. Please try again.');
        throw err;
      }
    },
    [projectId, jobId, refetchConversation],
  );

  const commit = useCallback(
    async (proposalId: string) => {
      if (!jobId) throw new Error('No active import job');
      try {
        const result = await bomImportService.commit(projectId, jobId, proposalId);
        return result;
      } finally {
        // Runs on both success AND failure — see useTaskImportFlow.ts's
        // commit() comment for why this can't be success-only.
        queryClient.invalidateQueries({ queryKey: ['bom-import-conversation', conversationId] });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.bom.tree(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.bom.summary(projectId) });
        queryClient.invalidateQueries({ queryKey: ['bom-import-job', projectId, jobId] });
      }
    },
    [projectId, jobId, conversationId, queryClient],
  );

  return {
    job: jobQuery.data ?? null,
    jobLoading: jobQuery.isLoading,
    conversation: conversationQuery.data ?? null,
    pendingQuestion,
    liveError,
    assistantWorking,
    sendMessage,
    uploadAttachment,
    commit,
  };
}
