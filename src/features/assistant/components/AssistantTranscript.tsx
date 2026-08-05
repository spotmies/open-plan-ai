import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AssistantMessageBubble } from './AssistantMessageBubble';
import { AssistantStatusLine } from './AssistantStatusLine';
import { AssistantQuestionCard } from './AssistantQuestionCard';
import { AssistantCardMessage } from './AssistantCardMessage';
import { isPresentCardMessage, type AssistantCard, type AssistantMessage, type AskUserQuestion } from '../assistantData';
import type { ToolStatusEntry } from '../hooks/useAssistantConversation';
import type { MessageVersionInfo } from '../lib/messageBranches';

interface AssistantTranscriptProps {
  messages: AssistantMessage[];
  messageVersions?: Record<string, MessageVersionInfo>;
  onEditMessage?: (messageId: string, content: string) => void;
  onSelectVersion?: (parentId: string | null, messageId: string) => void;
  streamingText: string;
  isStreaming: boolean;
  toolStatus: ToolStatusEntry[];
  pendingQuestions: AskUserQuestion[] | null;
  onAnswer: (answers: Array<{ header: string; selected: string[] }>) => void;
  isAnswering: boolean;
  liveCard?: AssistantCard | null;
  onSendMessage?: (text: string) => void;
}

export function AssistantTranscript({
  messages,
  messageVersions,
  onEditMessage,
  onSelectVersion,
  streamingText,
  isStreaming,
  toolStatus,
  pendingQuestions,
  onAnswer,
  isAnswering,
  liveCard,
  onSendMessage,
}: AssistantTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const mountedRef = useRef(false);
  const lastUserMessageIdRef = useRef<string | null>(null);
  // tool-role messages are internal plumbing (the audit trail), not conversation content —
  // except a present_card result, which IS the content, just persisted on a tool-role row
  // (see the plan's "reuse ai_messages.content" persistence approach). assistant messages
  // with no content are tool-call carriers (the model called a tool without emitting any
  // text first) — nothing to show until the real answer arrives.
  const visibleMessages = messages.filter(
    (m) => isPresentCardMessage(m) || (m.role !== 'tool' && !!m.content?.trim()),
  );
  // Once the REST refetch triggered by ai:card lands (which can happen mid-turn,
  // well before ai:done clears liveCard), the same card starts appearing in
  // visibleMessages too. Stop showing the transient liveCard once the persisted
  // list's own tail is already a card, to avoid a brief duplicate render.
  const lastVisibleIsCard =
    visibleMessages.length > 0 && isPresentCardMessage(visibleMessages[visibleMessages.length - 1]);

  // On first content for this conversation (mount, or a fresh conversation
  // switch — AssistantPanel remounts this component per conversationId),
  // jump to the very bottom so the latest exchange is in view. After that,
  // a newly *sent* message scrolls itself to the top of the viewport instead
  // of following the container to the bottom on every token — otherwise a
  // long streamed answer keeps yanking the view down past the message that
  // just started it, forcing a scroll back up to actually read it.
  useEffect(() => {
    if (visibleMessages.length === 0) return;
    const lastUserMessage = [...visibleMessages].reverse().find((m) => m.role === 'user');
    if (!mountedRef.current) {
      mountedRef.current = true;
      lastUserMessageIdRef.current = lastUserMessage?.id ?? null;
      bottomRef.current?.scrollIntoView({ block: 'end' });
      return;
    }
    if (lastUserMessage && lastUserMessage.id !== lastUserMessageIdRef.current) {
      lastUserMessageIdRef.current = lastUserMessage.id;
      messageElRefs.current.get(lastUserMessage.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [visibleMessages, streamingText, toolStatus.length, pendingQuestions]);

  // Did this message's turn (walking back to the preceding user message in
  // the FULL, unfiltered chain — tool-result rows included) make any tool
  // calls? Used to render a plain-prose answer as a compact bounded box
  // instead of an open chat bubble when it's grounded in real tool output
  // but didn't produce a full present_card — e.g. because there wasn't
  // enough structured data for one. `messages` (not `visibleMessages`) is
  // required here since tool-result rows are filtered out of the latter.
  function turnHadToolCalls(index: number): boolean {
    for (let i = index - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') return false;
      if (messages[i].role === 'tool') return true;
    }
    return false;
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        {visibleMessages.map((message) => {
          const setMessageRef = (el: HTMLDivElement | null) => {
            if (el) messageElRefs.current.set(message.id, el);
            else messageElRefs.current.delete(message.id);
          };

          if (isPresentCardMessage(message)) {
            let parsedCard: AssistantCard | null = null;
            try {
              parsedCard = message.content ? (JSON.parse(message.content) as AssistantCard) : null;
            } catch {
              parsedCard = null;
            }
            if (!parsedCard) return null;
            return (
              <div key={message.id} ref={setMessageRef}>
                <AssistantCardMessage card={parsedCard} createdAt={message.createdAt} onFollowUp={onSendMessage} />
              </div>
            );
          }
          const isCompactAnswer =
            message.role === 'assistant' && turnHadToolCalls(messages.findIndex((m) => m.id === message.id));
          return (
            <div key={message.id} ref={setMessageRef}>
              <AssistantMessageBubble
                id={message.id}
                parentId={message.parentId}
                role={message.role as 'user' | 'assistant'}
                content={message.content ?? ''}
                attachments={message.attachments}
                versionInfo={messageVersions?.[message.id]}
                onEdit={onEditMessage}
                onSelectVersion={onSelectVersion}
                disabled={isStreaming}
                variant={isCompactAnswer ? 'compact' : 'bubble'}
              />
            </div>
          );
        })}

        {isStreaming && !streamingText && <AssistantStatusLine toolStatus={toolStatus} />}

        {isStreaming && streamingText && (
          <AssistantMessageBubble
            role="assistant"
            content={streamingText}
            variant={toolStatus.length > 0 ? 'compact' : 'bubble'}
          />
        )}

        {liveCard && !lastVisibleIsCard && (
          <AssistantCardMessage card={liveCard} createdAt={null} onFollowUp={onSendMessage} />
        )}

        {pendingQuestions && (
          <AssistantQuestionCard questions={pendingQuestions} onSubmit={onAnswer} disabled={isAnswering} />
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
