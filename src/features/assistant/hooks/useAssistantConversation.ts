import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryClient';
import { assistantService } from '@/services/assistant.service';
import { aiAssistantTransport } from '../transport';
import { buildMessagePath } from '../lib/messageBranches';
import type {
  AskUserQuestion,
  AssistantCard,
  AssistantConversationSummary,
  AssistantMessage,
  AiMessageAttachment,
} from '../assistantData';

export interface ToolStatusEntry {
  id: string;
  tool: string;
  summary?: string;
  done: boolean;
}

// Detects the backend's message-length / request-size validation failures so
// send failures can surface a specific, actionable toast instead of the
// generic "try again" one — see ai-conversations.validator.ts (message capped
// at 8000 chars, UNPROCESSABLE) and server.ts's 10mb JSON body limit
// (PAYLOAD_TOO_LARGE).
export function isMessageTooLargeError(error: unknown): boolean {
  const err = error as { response?: { status?: number }; message?: string };
  if (err?.response?.status === 413) return true;
  if (err?.response?.status === 422 && /character/i.test(err?.message ?? '')) return true;
  return false;
}

export const MESSAGE_TOO_LARGE_NOTICE =
  "That message is too long for me to process in one go. Try summarizing it or breaking it into smaller messages, then send it again.";

/**
 * Owns everything needed to render one active conversation: the persisted
 * detail (React Query), plus live streaming state fed by the socket
 * transport (tokens, tool status, a paused clarifying question). On
 * ai:done/ai:question/ai:error the live state is cleared and the persisted
 * detail is refetched — simpler and more robust than trying to locally
 * splice the exact final message in.
 */
export function useAssistantConversation(conversationId: string | null) {
  const queryClient = useQueryClient();
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<ToolStatusEntry[]>([]);
  const [liveQuestion, setLiveQuestion] = useState<AskUserQuestion[] | null>(null);
  const [liveCard, setLiveCard] = useState<AssistantCard | null>(null);
  // Shown immediately on send so the user's own message never waits behind a
  // round-trip to appear — cleared once the persisted list (refetched via
  // invalidate()) actually catches up and contains it for real.
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(null);
  const [optimisticAttachments, setOptimisticAttachments] = useState<AiMessageAttachment[] | null>(null);
  const sentMessageCountRef = useRef(0);
  // An edit in flight — shown immediately by truncating the displayed path
  // right after the edited message and swapping in the new text, dropping
  // everything downstream (the old branch), same "show it now, clear once
  // the refetch catches up" shape as optimisticMessage above.
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const editCountRef = useRef(0);
  // Manual "< i/n >" navigation overrides, keyed by parentId (or 'root') —
  // see lib/messageBranches.ts. Purely a client-side view into the already-
  // fetched message tree; never sent to the server.
  const [branchOverrides, setBranchOverrides] = useState<Record<string, string>>({});
  const toolSeqRef = useRef(0);
  // Flipped the instant the user clicks Stop so a token/tool-call already in
  // flight over the socket can't reopen the streaming UI after the fact.
  // Reset whenever a fresh turn actually starts streaming.
  const stoppedRef = useRef(false);

  const query = useQuery({
    queryKey: queryKeys.assistant.conversation(conversationId ?? ''),
    queryFn: () => assistantService.getConversation(conversationId as string),
    enabled: !!conversationId,
  });

  const caughtUp = (query.data?.messages.length ?? 0) > sentMessageCountRef.current;
  const editCaughtUp = (query.data?.messages.length ?? 0) > editCountRef.current;

  useEffect(() => {
    if (optimisticMessage && caughtUp) {
      setOptimisticMessage(null);
      setOptimisticAttachments(null);
    }
  }, [optimisticMessage, caughtUp]);

  useEffect(() => {
    if (editingMessage && editCaughtUp) setEditingMessage(null);
  }, [editingMessage, editCaughtUp]);

  const invalidate = useCallback(() => {
    if (!conversationId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.assistant.conversation(conversationId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.assistant.conversations() });
  }, [conversationId, queryClient]);

  // Bumps the conversation's updatedAt in the sidebar list cache the instant
  // the user sends/edits a message, so it reorders to the top immediately
  // instead of waiting on the invalidate() round-trip above.
  const touchConversationInList = useCallback(() => {
    if (!conversationId) return;
    queryClient.setQueryData<AssistantConversationSummary[]>(
      queryKeys.assistant.conversations(),
      (old) =>
        old?.map((c) => (c.id === conversationId ? { ...c, updatedAt: new Date().toISOString() } : c)),
    );
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (!conversationId) return;

    aiAssistantTransport.connect();
    aiAssistantTransport.joinConversation(conversationId);

    setStreamingText('');
    setToolStatus([]);
    setLiveQuestion(null);
    setLiveCard(null);
    setOptimisticMessage(null);
    setOptimisticAttachments(null);
    setEditingMessage(null);
    setBranchOverrides({});
    stoppedRef.current = false;

    const unsubs = [
      aiAssistantTransport.onToken((token) => {
        if (stoppedRef.current) return;
        setIsStreaming(true);
        setStreamingText((prev) => prev + token);
      }),
      aiAssistantTransport.onToolCall((tool) => {
        if (stoppedRef.current) return;
        setIsStreaming(true);
        toolSeqRef.current += 1;
        setToolStatus((prev) => [...prev, { id: `${toolSeqRef.current}`, tool, done: false }]);
      }),
      aiAssistantTransport.onToolResult((tool, summary) => {
        setToolStatus((prev) => {
          const reverseIdx = [...prev].reverse().findIndex((t) => t.tool === tool && !t.done);
          if (reverseIdx === -1) return prev;
          const idx = prev.length - 1 - reverseIdx;
          const next = [...prev];
          next[idx] = { ...next[idx], done: true, summary };
          return next;
        });
      }),
      aiAssistantTransport.onQuestion((questions) => {
        setLiveQuestion(questions);
        setIsStreaming(false);
        invalidate();
      }),
      aiAssistantTransport.onCard((card) => {
        // Unlike ask_user, a card doesn't pause the turn — the model may
        // still add a closing sentence or call another tool, so streaming
        // state is left alone here.
        setLiveCard(card);
        invalidate();
      }),
      aiAssistantTransport.onDone(() => {
        setIsStreaming(false);
        setStreamingText('');
        setToolStatus([]);
        setLiveCard(null);
        invalidate();
      }),
      aiAssistantTransport.onStopped(() => {
        // Backend confirmation that the turn was cancelled — usually arrives
        // after stopStreaming() has already flipped the UI locally, so this
        // mainly just refetches to pick up whatever partial answer the
        // server persisted before it stopped.
        setIsStreaming(false);
        setStreamingText('');
        setToolStatus([]);
        setLiveCard(null);
        invalidate();
      }),
      aiAssistantTransport.onError((_code, message) => {
        setIsStreaming(false);
        toast.error(message || 'The assistant hit an error answering that.');
        invalidate();
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
      aiAssistantTransport.leaveConversation(conversationId);
    };
  }, [conversationId, invalidate]);

  const sendMessageMutation = useMutation({
    mutationFn: ({ message, attachments }: { message: string; attachments?: AiMessageAttachment[] }) =>
      assistantService.sendMessage(conversationId as string, message, attachments),
    onMutate: ({ message, attachments }) => {
      sentMessageCountRef.current = query.data?.messages.length ?? 0;
      setOptimisticMessage(message);
      setOptimisticAttachments(attachments?.length ? attachments : null);
      touchConversationInList();
    },
    onSuccess: () => {
      stoppedRef.current = false;
      setIsStreaming(true);
      setStreamingText('');
      setToolStatus([]);
      setLiveQuestion(null);
      setLiveCard(null);
      invalidate();
    },
    onError: (error) => {
      setOptimisticMessage(null);
      setOptimisticAttachments(null);
      toast.error(isMessageTooLargeError(error) ? MESSAGE_TOO_LARGE_NOTICE : "Couldn't send that message — try again.");
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      assistantService.editMessage(conversationId as string, messageId, content),
    onMutate: ({ messageId, content }) => {
      editCountRef.current = query.data?.messages.length ?? 0;
      setEditingMessage({ id: messageId, content });
      touchConversationInList();
    },
    onSuccess: () => {
      stoppedRef.current = false;
      setIsStreaming(true);
      setStreamingText('');
      setToolStatus([]);
      setLiveQuestion(null);
      setLiveCard(null);
      invalidate();
    },
    onError: () => {
      setEditingMessage(null);
      toast.error("Couldn't save that edit — try again.");
    },
  });

  const answerQuestionMutation = useMutation({
    mutationFn: (answers: Array<{ header: string; selected: string[] }>) =>
      assistantService.answerQuestion(conversationId as string, { answers }),
    onSuccess: () => {
      stoppedRef.current = false;
      setLiveQuestion(null);
      setLiveCard(null);
      setIsStreaming(true);
      setStreamingText('');
      setToolStatus([]);
      invalidate();
    },
    onError: () => toast.error("Couldn't submit that answer — try again."),
  });

  const stopTurnMutation = useMutation({
    mutationFn: () => assistantService.stopTurn(conversationId as string),
    onError: () => toast.error("Couldn't stop that — it may finish on its own shortly."),
  });

  const stopStreaming = useCallback(async () => {
    if (!conversationId) return;
    // Flip the UI immediately rather than waiting on the round-trip — but
    // still await the request itself (mutateAsync, not mutate) so callers
    // that need to send a follow-up right after stopping can be sure the
    // backend has actually registered the cancellation first. Without that,
    // the new turn's worker could call registerTurn() before this stop
    // request lands, and aiAbortRegistry (keyed by conversationId) would end
    // up cancelling the *new* turn instead of the one being replaced.
    stoppedRef.current = true;
    setIsStreaming(false);
    setStreamingText('');
    setToolStatus([]);
    try {
      await stopTurnMutation.mutateAsync();
    } catch {
      // onError above already surfaced a toast — nothing further to do.
    }
  }, [conversationId, stopTurnMutation]);

  const pendingQuestions = liveQuestion ?? query.data?.pendingQuestions ?? null;

  // Reconstructs the single default branch through the full message tree
  // (honoring any manual "< i/n >" navigation in branchOverrides), then
  // layers the in-flight optimistic state on top — a plain send appends a
  // synthetic tail message; an edit truncates the path right after the
  // edited message and swaps in its new text, dropping the old downstream
  // branch immediately rather than waiting on the round trip.
  const { path: activePath, versions: messageVersions } = buildMessagePath(
    query.data?.messages ?? [],
    branchOverrides,
  );

  let messages: AssistantMessage[];
  if (optimisticMessage && !caughtUp) {
    const tip = activePath[activePath.length - 1];
    messages = [
      ...activePath,
      {
        id: 'optimistic-pending',
        parentId: tip?.id ?? null,
        role: 'user',
        content: optimisticMessage,
        attachments: optimisticAttachments,
        createdAt: new Date().toISOString(),
      },
    ];
  } else if (editingMessage && !editCaughtUp) {
    const idx = activePath.findIndex((m) => m.id === editingMessage.id);
    messages =
      idx === -1
        ? activePath
        : [...activePath.slice(0, idx), { ...activePath[idx], content: editingMessage.content }];
  } else {
    messages = activePath;
  }

  return {
    messages,
    messageVersions,
    isLoading: query.isLoading,
    streamingText,
    isStreaming,
    toolStatus,
    pendingQuestions,
    liveCard,
    sendMessage: useCallback(
      (text: string, attachments?: AiMessageAttachment[]) => sendMessageMutation.mutate({ message: text, attachments }),
      [sendMessageMutation],
    ),
    editMessage: useCallback(
      (messageId: string, content: string) => editMessageMutation.mutate({ messageId, content }),
      [editMessageMutation],
    ),
    selectMessageVersion: useCallback((parentId: string | null, messageId: string) => {
      setBranchOverrides((prev) => ({ ...prev, [parentId ?? 'root']: messageId }));
    }, []),
    answerQuestion: useCallback(
      (answers: Array<{ header: string; selected: string[] }>) => answerQuestionMutation.mutate(answers),
      [answerQuestionMutation],
    ),
    stopStreaming,
    isSending: sendMessageMutation.isPending,
    isEditingMessage: editMessageMutation.isPending,
    isAnswering: answerQuestionMutation.isPending,
  };
}
