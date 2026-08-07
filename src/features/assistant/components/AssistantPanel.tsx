import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderPlus, Paperclip, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProjects } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';
import { assistantService } from '@/services/assistant.service';
import { AssistantComposer } from './AssistantComposer';
import { AssistantSuggestionRow } from './AssistantSuggestionRow';
import { AssistantTranscript } from './AssistantTranscript';
import {
  ASSISTANT_CATEGORIES,
  ASSISTANT_SUGGESTIONS,
  buildAskSuggestions,
  scopeLabelToBackend,
  type AssistantScope,
  type AssistantFocusEntity,
  type AiMessageAttachment,
} from '../assistantData';
import { useAssistantConversation } from '../hooks/useAssistantConversation';
import { useCreateAssistantConversation } from '../hooks/useAssistantConversations';

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

  const [value, setValue] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [scope, setScope] = useState<AssistantScope>('All projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [focusEntities, setFocusEntities] = useState<AssistantFocusEntity[]>([]);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  const {
    messages,
    messageVersions,
    streamingText,
    isStreaming,
    toolStatus,
    pendingQuestions,
    liveCard,
    sendMessage,
    editMessage,
    selectMessageVersion,
    answerQuestion,
    stopStreaming,
    isAnswering,
  } = useAssistantConversation(conversationId);
  const createConversation = useCreateAssistantConversation();
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

  const firstName = user?.name?.split(' ')[0] || 'there';
  const isWidget = variant === 'widget';
  const hasActiveConversation = !!conversationId;
  const visibleCategories = ASSISTANT_CATEGORIES.filter((category) => !category.hidden);
  const askSuggestions = useMemo(() => buildAskSuggestions(projects), [projects]);

  // Clear the composer whenever the active conversation identity changes
  // (new conversation, or switching to a different past one from the
  // sidebar) — deliberately not tied to a remount/key so the in-flight
  // "just submitted" optimistic state below survives create → activate.
  useEffect(() => {
    setValue('');
    setFiles([]);
  }, [conversationId]);

  useEffect(() => {
    if (isStreaming) setJustSubmitted(false);
  }, [isStreaming]);

  const handleSend = async () => {
    if (!value.trim() && files.length === 0) return;
    // The box can be sent with only attachments — give the transcript/model
    // something readable rather than an empty user turn.
    const effectiveMessage = value.trim() || 'Please review the attached file(s).';

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
      setValue('');
      setFiles([]);
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
        focusEntities: focusEntities.length > 0 ? focusEntities : undefined,
        attachments,
      },
      {
        onSuccess: (created) => onConversationCreated(created.id),
        onError: () => {
          setJustSubmitted(false);
          setPendingFirstMessage(null);
          setPendingFirstAttachments(null);
          toast.error("Couldn't start that conversation — try again.");
        },
      },
    );

    setValue('');
    setFiles([]);
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
    setFiles((prev) => [...prev, ...added]);
  };

  const handleFileRemove = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
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
        <AssistantTranscript
          key={conversationId ?? 'new'}
          messages={transcriptMessages}
          messageVersions={messageVersions}
          onEditMessage={editMessage}
          onSelectVersion={selectMessageVersion}
          streamingText={streamingText}
          isStreaming={effectivelyStreaming}
          toolStatus={toolStatus}
          pendingQuestions={pendingQuestions}
          onAnswer={answerQuestion}
          isAnswering={isAnswering}
          liveCard={liveCard}
          onSendMessage={sendMessage}
        />
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className={cn('mx-auto flex flex-col gap-6', isWidget ? 'max-w-full p-4' : 'max-w-3xl p-4 md:p-6')}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">OpenPlan Assistant</h2>
                <p className="text-sm text-muted-foreground">
                  Hi {firstName} — <span className="font-semibold text-foreground">ask</span> me anything about
                  status, blockers, BOM health, or changes across OpenPlan.
                </p>
              </div>
            </div>

            <div className={cn('grid gap-3', isWidget ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3')}>
              {visibleCategories.map((category) => (
                <div key={category.id} className="rounded-xl border border-border p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-chart-1">
                    <category.icon className="h-4 w-4" />
                    {category.title}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{category.description}</p>
                </div>
              ))}
            </div>

            {visibleCategories.map((category) => {
              if (category.id === 'ask' && !projectsLoading && projects.length === 0) {
                return (
                  <div key={category.id} className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {category.label}
                    </p>
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3.5 py-6 text-center">
                      <FolderPlus className="h-5 w-5 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Add some projects to start chatting about them.</p>
                    </div>
                  </div>
                );
              }
              const suggestions =
                category.id === 'ask' ? askSuggestions : ASSISTANT_SUGGESTIONS.filter((s) => s.category === category.id);
              if (suggestions.length === 0) return null;
              return (
                <div key={category.id} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {category.label}
                  </p>
                  <div className="space-y-2">
                    {suggestions.map((suggestion) => (
                      <AssistantSuggestionRow key={suggestion.id} suggestion={suggestion} onSelect={setValue} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <div
        className={cn(
          'shrink-0 border-t border-border',
          isWidget ? 'p-3' : 'px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:py-4',
        )}
      >
        <div className={cn('mx-auto', isWidget ? 'max-w-full' : 'max-w-3xl')}>
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
            onProjectChange={setSelectedProjectId}
            focusEntities={focusEntities}
            onFocusEntitiesChange={setFocusEntities}
            onSend={handleSend}
            disabled={isBusy}
            isGenerating={canStop}
            onStop={handleStop}
          />
        </div>
      </div>
    </div>
  );
}
