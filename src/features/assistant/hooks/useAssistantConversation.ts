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
  AssistantProposal,
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
  // True for the brief window between ai:done and the refetch it triggers
  // actually landing the turn's final assistant-text row. During it the
  // streamed answer + tool status stay frozen on screen (isStreaming is
  // already false) so the answer never blinks out — and any present_card
  // never visibly reorders from above→below the text — while the persisted
  // transcript catches up. See the onDone handler and the effect below.
  const [finalizing, setFinalizing] = useState(false);
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

  // Message count from the last landed fetch — read during render so
  // finalizeStartCountRef can snapshot it the instant ai:done fires, before
  // the refetch it triggers has changed anything.
  const persistedMessageCount = query.data?.messages.length ?? 0;
  const persistedMessageCountRef = useRef(0);
  persistedMessageCountRef.current = persistedMessageCount;
  const finalizeStartCountRef = useRef(0);

  useEffect(() => {
    if (optimisticMessage && caughtUp) {
      setOptimisticMessage(null);
      setOptimisticAttachments(null);
    }
  }, [optimisticMessage, caughtUp]);

  // After ai:done we deliberately don't clear streamingText / toolStatus (see
  // the onDone handler) — we hold them until the refetch it fired actually
  // lands the turn's final assistant-text row. The model emits present_card
  // *before* its closing sentence, so at ai:done the persisted transcript has
  // the card row but not the text row; clearing then would blank the answer
  // and let the card slide up for the length of that round-trip. Message
  // count growing past its ai:done value is the "the row is here now" signal.
  useEffect(() => {
    if (!finalizing) return;
    if (persistedMessageCount > finalizeStartCountRef.current) {
      setFinalizing(false);
      setStreamingText('');
      setToolStatus([]);
    }
  }, [finalizing, persistedMessageCount]);

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

    // Every piece of turn-local state is reset here so opening a thread never
    // inherits the one we're leaving. isStreaming in particular used to be
    // left set — a send in thread A followed by a jump to thread B kept B
    // pinned showing "Thinking…" for a turn that was never B's. The socket
    // room already scopes the real ai:* events per conversation; it was only
    // this in-memory state that leaked across the switch.
    setStreamingText('');
    setIsStreaming(false);
    setFinalizing(false);
    setToolStatus([]);
    setLiveQuestion(null);
    setLiveCard(null);
    setOptimisticMessage(null);
    setOptimisticAttachments(null);
    setEditingMessage(null);
    setBranchOverrides({});
    sentMessageCountRef.current = 0;
    editCountRef.current = 0;
    toolSeqRef.current = 0;
    stoppedRef.current = false;

    // A turn that finished (or errored, or was retried to completion by the
    // BullMQ worker) while this thread was off-screen never refetched — its
    // ai:done went to a room we'd already left. Pull the persisted transcript
    // now so the thread shows its real current state instead of a stale
    // pre-navigation snapshot.
    invalidate();

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
      // Act (phase 2) — both are optimizations only (I15): the conversation
      // detail fetch already includes every proposal, so a socket event just
      // triggers the same invalidate()-and-refetch every other live event
      // here uses, rather than locally splicing proposal state.
      aiAssistantTransport.onProposal(() => {
        invalidate();
      }),
      aiAssistantTransport.onProposalUpdate(() => {
        invalidate();
      }),
      aiAssistantTransport.onDone(() => {
        setIsStreaming(false);
        setLiveCard(null);
        setLiveQuestion(null);
        // Don't clear streamingText / toolStatus here. The model wrote
        // present_card before its closing sentence, so right now the
        // persisted transcript is one refetch behind — it has the card row
        // but not the final assistant-text row. Clearing now would blank the
        // answer and let the card jump above→below where the text will land,
        // for the whole length of the invalidate() round-trip below (the
        // flicker). Freeze the streamed render instead; the finalizing effect
        // above clears streamingText / toolStatus once the row actually lands.
        finalizeStartCountRef.current = persistedMessageCountRef.current;
        setFinalizing(true);
        invalidate();
      }),
      aiAssistantTransport.onStopped(() => {
        // Backend confirmation that the turn was cancelled — usually arrives
        // after stopStreaming() has already flipped the UI locally, so this
        // mainly just refetches to pick up whatever partial answer the
        // server persisted before it stopped.
        setIsStreaming(false);
        setFinalizing(false);
        setStreamingText('');
        setToolStatus([]);
        setLiveCard(null);
        invalidate();
      }),
      aiAssistantTransport.onError((_code, message) => {
        setIsStreaming(false);
        setFinalizing(false);
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
      setFinalizing(false);
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
      setFinalizing(false);
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
      setFinalizing(false);
      setStreamingText('');
      setToolStatus([]);
      invalidate();
    },
    onError: () => toast.error("Couldn't submit that answer — try again."),
  });

  // Act (phase 2) — confirm/reject never enqueue a model turn (§9.7): no
  // isStreaming/streamingText resets here, just refetch the conversation
  // (and the sidebar list, for lastActionSummary) once the server responds.
  const confirmProposalMutation = useMutation({
    mutationFn: (proposalId: string) => assistantService.confirmProposal(proposalId),
    onSuccess: invalidate,
    onError: (error) => {
      const status = (error as { response?: { status?: number; data?: { error?: { message?: string } } } })?.response?.status;
      if (status === 409) {
        toast.error('This was already confirmed, rejected, or has expired.');
      } else if (status === 403) {
        toast.error("You no longer have edit access to this project.");
      } else {
        toast.error("Couldn't confirm that change — try again.");
      }
      invalidate();
    },
  });

  // Same "never enqueues a model turn" shape as confirm/reject — the form's
  // Submit (first time) or a later Edit resubmit just rewrites the stored
  // proposal, then a refetch picks up the fresh preview/formState.
  const reviseProposalMutation = useMutation({
    mutationFn: ({ proposalId, edits }: { proposalId: string; edits: Record<string, unknown> }) =>
      assistantService.reviseProposal(proposalId, edits),
    onSuccess: invalidate,
    onError: (error) => {
      const response = (error as { response?: { status?: number; data?: { error?: { message?: string } } } })?.response;
      if (response?.status === 409) {
        toast.error('This was already confirmed, rejected, or has expired.');
        invalidate();
      } else if (response?.status === 403) {
        toast.error("You no longer have edit access to this project.");
        invalidate();
      } else if (response?.status === 422) {
        // Validation failure (bad field value, unresolvable reference) — the
        // proposal itself is untouched, so don't invalidate: that would
        // refetch the old data and wipe out whatever the user just typed.
        toast.error(response.data?.error?.message ?? "Some of those fields couldn't be resolved — check them and try again.");
      } else {
        toast.error("Couldn't save those changes — try again.");
      }
    },
  });

  const rejectProposalMutation = useMutation({
    mutationFn: ({ proposalId, reason }: { proposalId: string; reason?: string }) =>
      assistantService.rejectProposal(proposalId, reason),
    onSuccess: invalidate,
    onError: () => {
      toast.error("Couldn't dismiss that — try again.");
      invalidate();
    },
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
    setFinalizing(false);
    setStreamingText('');
    setToolStatus([]);
    try {
      await stopTurnMutation.mutateAsync();
    } catch {
      // onError above already surfaced a toast — nothing further to do.
    }
  }, [conversationId, stopTurnMutation]);

  const pendingQuestions = liveQuestion ?? query.data?.pendingQuestions ?? null;

  // Act (phase 2) — grouped by owning message so the transcript can render
  // each message's card(s) right after it; a single tool-call batch can
  // legally produce more than one proposal on the same assistant message.
  const proposals = query.data?.proposals ?? [];
  const proposalsByMessageId = proposals.reduce<Record<string, AssistantProposal[]>>((acc, p) => {
    (acc[p.messageId] ??= []).push(p);
    return acc;
  }, {});

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
    finalizing,
    toolStatus,
    pendingQuestions,
    liveCard,
    proposals,
    proposalsByMessageId,
    confirmProposal: useCallback((proposalId: string) => confirmProposalMutation.mutate(proposalId), [confirmProposalMutation]),
    rejectProposal: useCallback(
      (proposalId: string, reason?: string) => rejectProposalMutation.mutate({ proposalId, reason }),
      [rejectProposalMutation],
    ),
    confirmingProposalId: confirmProposalMutation.isPending ? (confirmProposalMutation.variables ?? null) : null,
    rejectingProposalId: rejectProposalMutation.isPending ? (rejectProposalMutation.variables?.proposalId ?? null) : null,
    reviseProposal: useCallback(
      (proposalId: string, edits: Record<string, unknown>) => reviseProposalMutation.mutateAsync({ proposalId, edits }),
      [reviseProposalMutation],
    ),
    revisingProposalId: reviseProposalMutation.isPending ? (reviseProposalMutation.variables?.proposalId ?? null) : null,
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
