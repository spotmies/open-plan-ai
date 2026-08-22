import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AssistantMessageBubble } from './AssistantMessageBubble';
import { AssistantStatusLine } from './AssistantStatusLine';
import { AssistantQuestionCard } from './AssistantQuestionCard';
import { AssistantQuestionRecap } from './AssistantQuestionRecap';
import { AssistantCardMessage } from './AssistantCardMessage';
import { AssistantProposalCard } from './AssistantProposalCard';
import { AssistantEventLine } from './AssistantEventLine';
import {
  extractAskUserQuestions,
  isAskUserAnswerMessage,
  isPresentCardMessage,
  isProposalEventMessage,
  pairAskUserAnswers,
  type AssistantCard,
  type AssistantMessage,
  type AskUserQuestion,
  type AssistantProposal,
} from '../assistantData';
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
  /** Public/shared-view rendering: no card navigation, no follow-up chips. Editing/version-nav are already inert whenever onEditMessage/onSelectVersion are omitted. */
  readOnly?: boolean;
  /** Act (phase 2) — every proposal for this conversation, grouped by the assistant message that created it (a single tool-call batch can produce more than one). */
  proposalsByMessageId?: Record<string, AssistantProposal[]>;
  onConfirmProposal?: (proposalId: string) => void;
  onRejectProposal?: (proposalId: string, reason?: string) => void;
  onReviseProposal?: (proposalId: string, edits: Record<string, unknown>) => Promise<AssistantProposal>;
  confirmingProposalId?: string | null;
  rejectingProposalId?: string | null;
  revisingProposalId?: string | null;
}

// Groups a run of messages between `user` rows and moves any present_card
// rows (and proposal-bearing, textless assistant rows) to the end of that
// run, preserving relative order within each half.
function reorderCardsAfterText(
  msgs: AssistantMessage[],
  proposalsByMessageId?: Record<string, AssistantProposal[]>,
): AssistantMessage[] {
  const result: AssistantMessage[] = [];
  let turnCards: AssistantMessage[] = [];
  let turnOthers: AssistantMessage[] = [];
  const flushTurn = () => {
    result.push(...turnOthers, ...turnCards);
    turnCards = [];
    turnOthers = [];
  };
  for (const message of msgs) {
    if (message.role === 'user') {
      flushTurn();
      result.push(message);
      continue;
    }
    const isTextlessProposalCarrier = message.role === 'assistant' && !message.content?.trim() && !!proposalsByMessageId?.[message.id]?.length;
    if (isPresentCardMessage(message) || isTextlessProposalCarrier) turnCards.push(message);
    else turnOthers.push(message);
  }
  flushTurn();
  return result;
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
  readOnly = false,
  proposalsByMessageId,
  onConfirmProposal,
  onRejectProposal,
  onReviseProposal,
  confirmingProposalId,
  rejectingProposalId,
  revisingProposalId,
}: AssistantTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const mountedRef = useRef(false);
  const lastUserMessageIdRef = useRef<string | null>(null);
  // tool-role messages are internal plumbing (the audit trail), not conversation content —
  // except a present_card result, or an ask_user answer recap, which ARE content, just
  // persisted on a tool-role row (see the plan's "reuse ai_messages.content" persistence
  // approach). assistant messages with no content are tool-call carriers (the model called
  // a tool without emitting any text first) — nothing to show until the real answer arrives.
  const visibleMessages = messages.filter(
    (m) =>
      isPresentCardMessage(m) ||
      isAskUserAnswerMessage(m) ||
      isProposalEventMessage(m) ||
      // A propose_* tool call often produces no text at all (rule 2: the
      // model's own sentence about a proposal usually accompanies it, but an
      // assistant message that ONLY called a propose_* tool has empty
      // content) — keep it visible anyway so its card has somewhere to
      // attach in the transcript below, same reasoning as present_card rows.
      (m.role === 'assistant' && !!proposalsByMessageId?.[m.id]?.length) ||
      (m.role !== 'tool' && !!m.content?.trim()),
  );
  // The model calls present_card mid-turn, then keeps writing — so the card
  // row is always persisted (and thus ordered) before the final text row.
  // We want the opposite on screen (text first, card last, matching the
  // live-streaming render below), so reorder for display only, per turn
  // (a run of messages between user messages), without touching the
  // underlying chronological array used elsewhere in this component.
  const orderedMessages = reorderCardsAfterText(visibleMessages, proposalsByMessageId);
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
        {orderedMessages.map((message) => {
          const setMessageRef = (el: HTMLDivElement | null) => {
            if (el) messageElRefs.current.set(message.id, el);
            else messageElRefs.current.delete(message.id);
          };

          if (isAskUserAnswerMessage(message)) {
            const parent = messages.find((m) => m.id === message.parentId);
            const questions = extractAskUserQuestions(parent);
            const recap = questions ? pairAskUserAnswers(questions, message.content) : null;
            return (
              <div key={message.id} ref={setMessageRef}>
                {recap ? (
                  <AssistantQuestionRecap recap={recap} />
                ) : (
                  <p className="text-xs italic text-muted-foreground">{message.content}</p>
                )}
              </div>
            );
          }

          if (isProposalEventMessage(message)) {
            return (
              <div key={message.id} ref={setMessageRef}>
                <AssistantEventLine message={message} />
              </div>
            );
          }

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
                <AssistantCardMessage
                  card={parsedCard}
                  createdAt={message.createdAt}
                  onFollowUp={onSendMessage}
                  readOnly={readOnly}
                />
              </div>
            );
          }
          const isCompactAnswer =
            message.role === 'assistant' && turnHadToolCalls(messages.findIndex((m) => m.id === message.id));
          const proposalsForMessage = message.role === 'assistant' ? proposalsByMessageId?.[message.id] : undefined;
          const hasText = !!message.content?.trim();
          return (
            <div key={message.id} ref={setMessageRef} className="space-y-2">
              {hasText && (
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
              )}
              {proposalsForMessage?.map((proposal) => (
                <AssistantProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  readOnly={readOnly}
                  onConfirm={onConfirmProposal}
                  onReject={onRejectProposal}
                  onRevise={onReviseProposal}
                  isConfirming={confirmingProposalId === proposal.id}
                  isRejecting={rejectingProposalId === proposal.id}
                  isRevising={revisingProposalId === proposal.id}
                />
              ))}
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
          <AssistantCardMessage card={liveCard} createdAt={null} onFollowUp={onSendMessage} readOnly={readOnly} />
        )}

        {pendingQuestions && (
          <AssistantQuestionCard questions={pendingQuestions} onSubmit={onAnswer} disabled={isAnswering} />
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
