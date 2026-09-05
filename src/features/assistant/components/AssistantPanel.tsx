import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderPlus, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProjects } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';
import { assistantService } from '@/services/assistant.service';
import { ASSISTANT_MAX_ATTACHMENTS } from './AssistantAttachments';
import { AssistantComposer } from './AssistantComposer';
import { AssistantSuggestionRow } from './AssistantSuggestionRow';
import { AssistantTranscript } from './AssistantTranscript';
import {
  ASSISTANT_CATEGORIES,
  ASSISTANT_SUGGESTIONS,
  buildAskSuggestions,
  buildActSuggestions,
  scopeLabelToBackend,
  resolveConversationScopeLabel,
  type AssistantCategoryId,
  type AssistantScope,
  type AiMessageAttachment,
} from '../assistantData';
import {
  isMessageTooLargeError,
  MESSAGE_TOO_LARGE_NOTICE,
  isRateLimitError,
  RATE_LIMIT_NOTICE,
  useAssistantConversation,
} from '../hooks/useAssistantConversation';
import {
  useAssistantConversations,
  useCreateAssistantConversation,
  useUpdateAssistantConversation,
} from '../hooks/useAssistantConversations';
import { EMPTY_ASSISTANT_DRAFT, EMPTY_ASSISTANT_FILES, useAssistantDraftStore } from '../stores/useAssistantDraftStore';

interface AssistantPanelProps {
  variant?: 'page' | 'widget';
  className?: string;
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
}

export function AssistantPanel({
  variant = 'page',
  className,
  conversationId,
  onConversationCreated,
}: AssistantPanelProps) {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  // Keyed by conversation so each thread (and the blank "new chat" composer,
  // key 'new') keeps its own draft in a store that outlives this component —
  // AssistantPanel remounts on every route navigation and widget close/reopen.
  const draftKey = conversationId ?? 'new';
  const draft = useAssistantDraftStore((s) => s.drafts[draftKey]) ?? EMPTY_ASSISTANT_DRAFT;
  const files = useAssistantDraftStore((s) => s.files[draftKey]) ?? EMPTY_ASSISTANT_FILES;
  const setDraft = useAssistantDraftStore((s) => s.setDraft);
  const clearDraft = useAssistantDraftStore((s) => s.clearDraft);
  const clearDraftMessage = useAssistantDraftStore((s) => s.clearDraftMessage);
  const setDraftFiles = useAssistantDraftStore((s) => s.setFiles);
  const { value, scope, selectedProjectId } = draft;
  const setValue = (next: string) => setDraft(draftKey, { value: next });
  const setScope = (next: AssistantScope) => setDraft(draftKey, { scope: next });
  const setSelectedProjectId = (next: string | null) => setDraft(draftKey, { selectedProjectId: next });
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    messageVersions,
    streamingText,
    isStreaming,
    finalizing,
    toolStatus,
    pendingQuestions,
    liveCard,
    proposalsByMessageId,
    confirmProposal,
    rejectProposal,
    reviseProposal,
    confirmingProposalId,
    rejectingProposalId,
    revisingProposalId,
    sendMessage,
    editMessage,
    selectMessageVersion,
    answerQuestion,
    stopStreaming,
    isAnswering,
    isSending,
  } = useAssistantConversation(conversationId);
  const createConversation = useCreateAssistantConversation();
  const updateConversation = useUpdateAssistantConversation();
  // Once a conversation has actually resolved to a single project — either
  // picked at creation, or auto-locked by assistantLoop.ts the moment a
  // message named one — its scope/project is fixed server-side and the
  // composer should show that real, locked value instead of the still-live
  // "new chat" draft picker, which would otherwise look interactive despite
  // being ignored on send (see handleSend below). A conversation still sitting
  // in all_projects (nothing project-specific asked yet) is deliberately
  // EXCLUDED here — it keeps the normal interactive picker below, both so the
  // user can jump straight to a project and so a plain "hi" doesn't
  // prematurely freeze the control before the assistant has actually scoped
  // anything. Same cache useAssistantConversations()/AppHeader already keep
  // warm, so this is free.
  const { data: allConversations = [] } = useAssistantConversations();
  const activeConversationSummary = conversationId
    ? allConversations.find((c) => c?.id === conversationId)
    : undefined;
  const isActiveConversationLocked =
    !!activeConversationSummary && activeConversationSummary.scope !== 'all_projects';
  const lockedScopeLabel = isActiveConversationLocked
    ? resolveConversationScopeLabel(
        activeConversationSummary!.scope,
        projects.find((p) => p.id === activeConversationSummary!.projectId)?.name,
      )
    : null;
  // Conversation title + scope, shown inline as a card at the top of the
  // transcript (page variant only) instead of floating in the global
  // AppHeader — keeps it scoped to the Assistant page's own content instead
  // of bleeding into shared chrome.
  const activeConversationTitle = activeConversationSummary?.title || 'New conversation';
  const activeConversationScopeLabel = activeConversationSummary
    ? resolveConversationScopeLabel(
        activeConversationSummary.scope,
        projects.find((p) => p.id === activeConversationSummary.projectId)?.name,
      )
    : null;

  // Click-to-rename on the title itself (vs. the sidebar's dialog-based
  // rename) — closes/resets whenever the open conversation changes so a
  // stale draft can't leak into the next thread.
  useEffect(() => {
    setIsEditingTitle(false);
  }, [conversationId]);

  useEffect(() => {
    if (isEditingTitle) titleInputRef.current?.select();
  }, [isEditingTitle]);

  const startEditingTitle = () => {
    if (!activeConversationSummary) return;
    setTitleDraft(activeConversationSummary.title || '');
    setIsEditingTitle(true);
  };

  const commitTitleEdit = () => {
    const next = titleDraft.trim();
    setIsEditingTitle(false);
    if (!activeConversationSummary || !next || next === activeConversationSummary.title) return;
    updateConversation.mutate(
      { id: activeConversationSummary.id, updates: { title: next } },
      { onError: () => toast.error("Couldn't rename this conversation — try again.") },
    );
  };
  // Picking a project from the popover on an existing, still-unscoped
  // (all_projects) conversation locks it server-side right away — the
  // explicit-click counterpart to assistantLoop.ts's automatic lock, which
  // fires the instant a message names a project instead. Only relevant once
  // conversationId exists; before that, the popover's pick just feeds the
  // "new chat" draft that createConversation reads on first send (unchanged
  // below).
  const handleProjectChange = (projectId: string) => {
    if (conversationId) {
      updateConversation.mutate(
        { id: conversationId, updates: { projectId } },
        { onError: () => toast.error("Couldn't lock this conversation to that project — try again.") },
      );
      return;
    }
    setSelectedProjectId(projectId);
  };
  // Covers only the very first message of a brand-new conversation: sent
  // before conversationId exists, so useAssistantConversation's own
  // optimistic-message tracking (keyed on an already-active conversation)
  // can't see it yet. Cleared once the newly created conversation's real
  // messages land.
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null);
  const [pendingFirstAttachments, setPendingFirstAttachments] = useState<AiMessageAttachment[] | null>(null);

  useEffect(() => {
    if (pendingFirstMessage && messages.length > 0) {
      setPendingFirstMessage(null);
      setPendingFirstAttachments(null);
    }
  }, [pendingFirstMessage, messages.length]);

  // Composer-side turn state (the Stop button, the "thinking" indicator that
  // rides on justSubmitted, the optimistic first-message bubble) all belong to
  // the thread we're leaving — clear them when switching threads so the next
  // one doesn't open with a stuck Stop button over a turn that isn't its own.
  // Deliberately skipped on the null -> new-id hop right after a conversation
  // is created (prev === null): pendingFirstMessage still has to bridge that
  // gap until the created thread's first fetch lands.
  const prevConversationIdRef = useRef(conversationId);
  useEffect(() => {
    const prev = prevConversationIdRef.current;
    prevConversationIdRef.current = conversationId;
    if (prev !== null && prev !== conversationId) {
      setJustSubmitted(false);
      setPendingFirstMessage(null);
      setPendingFirstAttachments(null);
    }
  }, [conversationId]);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const isWidget = variant === 'widget';
  const hasActiveConversation = !!conversationId;
  const visibleCategories = ASSISTANT_CATEGORIES.filter((category) => !category.hidden);
  const askSuggestions = useMemo(() => buildAskSuggestions(projects), [projects]);
  const actSuggestions = useMemo(() => buildActSuggestions(projects), [projects]);
  // Categories whose chips are generated from the org's real projects (vs. ASSISTANT_SUGGESTIONS' static
  // 'build' entries) — both need the same "no projects yet" empty state instead of an empty chip list.
  const dynamicSuggestionsByCategory: Partial<Record<AssistantCategoryId, typeof askSuggestions>> = {
    ask: askSuggestions,
    act: actSuggestions,
  };
  // Flattened into one ChatGPT-style chip row instead of per-category
  // labelled lists — interleaved so Ask/Act are mixed rather than all of one
  // kind first, and capped so the empty state stays a couple of lines, not a
  // wall of chips.
  const emptyStateSuggestions = useMemo(() => {
    const groups = visibleCategories.map((category) => {
      const isDynamic = category.id in dynamicSuggestionsByCategory;
      const items = isDynamic
        ? dynamicSuggestionsByCategory[category.id] ?? []
        : ASSISTANT_SUGGESTIONS.filter((s) => s.category === category.id);
      return items;
    });
    const interleaved: typeof askSuggestions = [];
    const maxLen = Math.max(0, ...groups.map((g) => g.length));
    for (let i = 0; i < maxLen; i++) {
      for (const group of groups) {
        if (group[i]) interleaved.push(group[i]);
      }
    }
    return interleaved.slice(0, isWidget ? 4 : 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askSuggestions, actSuggestions, isWidget]);
  // Any visible category backed by real projects (ask/act) needs the org to
  // have projects at all — when it doesn't, show one empty-state message
  // instead of duplicating it once per category.
  const needsProjectsEmptyState =
    !projectsLoading && projects.length === 0 && visibleCategories.some((c) => c.id in dynamicSuggestionsByCategory);

  useEffect(() => {
    // isStreaming flipping true is the normal path (a successful send started
    // a turn). But sendMessageMutation settling back to !isSending WITHOUT
    // isStreaming ever turning true means the send itself failed (e.g. the
    // message was rejected as too long) — without this, justSubmitted was
    // left stuck true forever, pinning effectivelyStreaming true and leaving
    // the composer showing a permanent Stop button over a turn that was
    // never actually started.
    if (isStreaming || !isSending) setJustSubmitted(false);
  }, [isStreaming, isSending]);

  const handleSend = async () => {
    if (!value.trim() && files.length === 0) return;
    // The box can be sent with only attachments — give the transcript/model
    // something readable rather than an empty user turn.
    const effectiveMessage = value.trim() || 'Please review the attached file(s).';

    // Typing is always allowed, even mid-response, but sending while a turn
    // is still active must stop that turn first — await it so the backend
    // has actually cancelled the old turn before the new one is enqueued
    // (see stopStreaming's comment for why order matters here).
    if (conversationId && effectivelyStreaming) {
      setJustSubmitted(false);
      await stopStreaming();
    }

    let attachments: AiMessageAttachment[] | undefined;
    if (files.length > 0) {
      setIsUploading(true);
      try {
        attachments = await Promise.all(files.map((file) => assistantService.uploadAttachment(file)));
      } catch {
        setIsUploading(false);
        toast.error("Couldn't upload one or more attachments — try again.");
        return;
      }
      setIsUploading(false);
    }

    // A conversation that already exists has its scope/project fixed
    // server-side — the composer's local scope picker is only relevant when
    // *creating* a new one, so a follow-up must never be blocked by it.
    if (conversationId) {
      setJustSubmitted(true);
      sendMessage(effectiveMessage, attachments);
      clearDraftMessage(draftKey);
      return;
    }

    if (scope !== 'All projects' && !selectedProjectId) {
      toast.error('Pick a project first.');
      return;
    }
    if (scope === 'All projects' && !currentOrganization) {
      toast.error('No organization selected.');
      return;
    }

    setJustSubmitted(true);
    setPendingFirstMessage(effectiveMessage);
    setPendingFirstAttachments(attachments?.length ? attachments : null);
    createConversation.mutate(
      {
        scope: scopeLabelToBackend(scope),
        projectId: scope !== 'All projects' ? (selectedProjectId as string) : undefined,
        orgId: scope === 'All projects' ? currentOrganization?.id : undefined,
        message: effectiveMessage,
        attachments,
      },
      {
        // Carries the picked scope/project over to the new conversation's own
        // draft key so the composer keeps showing it instead of snapping back
        // to "All projects" once the URL/draftKey switches post-creation.
        onSuccess: (created) => {
          setDraft(created.id, { scope, selectedProjectId });
          onConversationCreated(created.id);
        },
        onError: (error) => {
          setJustSubmitted(false);
          setPendingFirstMessage(null);
          setPendingFirstAttachments(null);
          // No conversation/transcript exists yet to show an inline notice in
          // (see useAssistantConversation's sendFailureNotice for the
          // in-conversation equivalent) — a toast is the best we can do here.
          toast.error(
            isMessageTooLargeError(error)
              ? MESSAGE_TOO_LARGE_NOTICE
              : isRateLimitError(error)
                ? RATE_LIMIT_NOTICE
                : "Couldn't start that conversation — try again.",
          );
        },
      },
    );

    clearDraft(draftKey);
  };

  const handleStop = () => {
    // justSubmitted is local optimistic state that otherwise only clears once
    // isStreaming flips true (see the effect above) — for the very first
    // message of a brand-new conversation nothing sets isStreaming true until
    // the first token/tool-call arrives, so stopping before that point would
    // leave the composer stuck showing the stop button forever without this.
    setJustSubmitted(false);
    stopStreaming();
  };

  const handleFilesAdd = (added: File[]) => {
    const combined = [...files, ...added];
    if (combined.length > ASSISTANT_MAX_ATTACHMENTS) {
      toast.warning(`Only ${ASSISTANT_MAX_ATTACHMENTS} files allowed. Extra file(s) were skipped.`);
      setDraftFiles(draftKey, combined.slice(0, ASSISTANT_MAX_ATTACHMENTS));
      return;
    }
    setDraftFiles(draftKey, combined);
  };

  const handleFileRemove = (index: number) => {
    setDraftFiles(draftKey, files.filter((_, i) => i !== index));
  };

  // dragenter/dragleave fire for every child element the pointer crosses, so
  // a plain boolean flickers off mid-drag whenever it passes over a nested
  // node. A depth counter keeps the overlay on until the pointer has left
  // every nested element, i.e. the counter is back to 0.
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounterRef.current += 1;
    setIsDraggingFile(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    if (isBusy) return;
    const dropped = Array.from(e.dataTransfer.files ?? []);
    if (dropped.length > 0) handleFilesAdd(dropped);
  };

  const effectivelyStreaming = isStreaming || justSubmitted;
  const isBusy = createConversation.isPending || effectivelyStreaming || isUploading;
  // Deliberately excludes effectivelyStreaming — typing (and dictating) the
  // next message must stay possible while a turn is still streaming, so the
  // composer's text input isn't blocked by it. Sending while streaming is
  // still handled (stop-then-send in handleSend); this only governs the
  // input field itself and only blocks it for states with no fallback path.
  const isComposerInputDisabled = createConversation.isPending || isUploading;
  // Stop only ever targets an existing conversation's turn — the brief
  // window while the very first message is still creating the conversation
  // has no backend job to cancel yet.
  const canStop = !!conversationId && effectivelyStreaming;
  const transcriptMessages = pendingFirstMessage && messages.length === 0
    ? [
        ...messages,
        {
          id: 'optimistic-first',
          parentId: null,
          role: 'user' as const,
          content: pendingFirstMessage,
          attachments: pendingFirstAttachments,
          createdAt: new Date().toISOString(),
        },
      ]
    : messages;

  // Rendered both centered in the empty state and docked at the bottom once
  // a conversation has messages — same instance, just repositioned, so it
  // never actually mounts twice.
  const composer = (
    <AssistantComposer
      value={value}
      onChange={setValue}
      files={files}
      onFilesAdd={handleFilesAdd}
      onFileRemove={handleFileRemove}
      scope={scope}
      onScopeChange={setScope}
      projects={projects}
      selectedProjectId={selectedProjectId}
      onProjectChange={handleProjectChange}
      lockedScopeLabel={lockedScopeLabel}
      onSend={handleSend}
      disabled={isComposerInputDisabled}
      isGenerating={canStop}
      onStop={handleStop}
    />
  );

  return (
    <div
      className={cn('relative flex h-full min-h-0 flex-col', className)}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Paperclip className="h-8 w-8" />
            <p className="text-sm font-semibold">Drop files to attach</p>
          </div>
        </div>
      )}
      {hasActiveConversation ? (
        <div className="relative flex flex-1 min-h-0 flex-col">
          {/* Overlays the top of the scrollable transcript rather than sitting
              in normal flow, so messages scrolling past underneath fade out
              under the gradient instead of getting clipped by a hard edge. */}
          {!isWidget && activeConversationSummary && (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 isolate z-10 px-4 pb-8 pt-2 md:px-6 [transform:translateZ(0)]"
              style={{
                background:
                  'linear-gradient(to bottom, hsl(var(--background)) 55%, hsl(var(--background) / 0) 100%)',
              }}
            >
              <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-2">
                {isEditingTitle ? (
                  <input
                    ref={titleInputRef}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={commitTitleEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitTitleEdit();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setIsEditingTitle(false);
                      }
                    }}
                    size={Math.max(titleDraft.length, 4)}
                    className="min-w-0 max-w-full rounded-md border border-ring bg-background px-1.5 py-0.5 text-sm font-semibold leading-tight text-foreground outline-none ring-2 ring-ring/30"
                  />
                ) : (
                  <h1
                    role="button"
                    tabIndex={0}
                    onClick={startEditingTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        startEditingTitle();
                      }
                    }}
                    className="min-w-0 max-w-full truncate rounded-md border border-transparent px-1.5 py-0.5 text-sm font-semibold leading-tight text-foreground"
                  >
                    {activeConversationTitle}
                  </h1>
                )}
                {activeConversationScopeLabel && (
                  <span className="shrink-0 truncate rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                    {activeConversationScopeLabel}
                  </span>
                )}
              </div>
            </div>
          )}
          <AssistantTranscript
            key={conversationId ?? 'new'}
            messages={transcriptMessages}
            messageVersions={messageVersions}
            onEditMessage={editMessage}
            onSelectVersion={selectMessageVersion}
            streamingText={streamingText}
            isStreaming={effectivelyStreaming}
            finalizing={finalizing}
            toolStatus={toolStatus}
            pendingQuestions={pendingQuestions}
            onAnswer={answerQuestion}
            isAnswering={isAnswering}
            liveCard={liveCard}
            onSendMessage={sendMessage}
            proposalsByMessageId={proposalsByMessageId}
            onConfirmProposal={confirmProposal}
            onRejectProposal={rejectProposal}
            onReviseProposal={reviseProposal}
            confirmingProposalId={confirmingProposalId}
            rejectingProposalId={rejectingProposalId}
            revisingProposalId={revisingProposalId}
            withHeaderOffset={!isWidget && !!activeConversationSummary}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div
            className={cn(
              'mx-auto flex min-h-full flex-col items-center justify-center gap-5',
              isWidget ? 'max-w-full p-4' : 'max-w-2xl p-4 md:p-6',
            )}
          >
            <h1 className={cn('text-center font-semibold text-foreground', isWidget ? 'text-base' : 'text-2xl sm:text-[28px]')}>
              {isWidget ? (
                <>How can I help, {firstName}?</>
              ) : visibleCategories.length > 1 ? (
                <>What can I help with, {firstName}?</>
              ) : (
                <>What do you want to know, {firstName}?</>
              )}
            </h1>

            <div className="w-full">{composer}</div>

            {needsProjectsEmptyState ? (
              <div className="flex flex-col items-center gap-2 px-3.5 py-4 text-center">
                <FolderPlus className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Add some projects to get started.</p>
              </div>
            ) : (
              emptyStateSuggestions.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {emptyStateSuggestions.map((suggestion) => (
                    <AssistantSuggestionRow key={suggestion.id} suggestion={suggestion} onSelect={setValue} />
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {hasActiveConversation && (
        <div
          className={cn(
            'shrink-0 border-t border-border',
            isWidget ? 'p-3' : 'px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:py-4',
          )}
        >
          <div className={cn('mx-auto', isWidget ? 'max-w-full' : 'max-w-3xl')}>{composer}</div>
        </div>
      )}
    </div>
  );
}
