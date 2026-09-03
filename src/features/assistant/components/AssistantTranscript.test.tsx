import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AssistantTranscript } from './AssistantTranscript';
import type { AssistantMessage, AssistantStatusCard } from '../assistantData';

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    currencyCode: 'USD',
    currencySymbol: '$',
    currencyLabel: 'US Dollar (USD)',
    formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  }),
}));

const card: AssistantStatusCard = {
  type: 'status',
  title: 'OpenPlanAI',
  metricValue: 47,
  items: [],
  sources: ['projects'],
};

function makeMessages(): AssistantMessage[] {
  return [
    { id: 'u1', parentId: null, role: 'user', content: 'what is the status', createdAt: '2026-08-05T00:00:00Z' },
    { id: 't1', parentId: 'u1', role: 'tool', content: JSON.stringify(card), createdAt: '2026-08-05T00:00:01Z' },
    { id: 'a1', parentId: 't1', role: 'assistant', content: 'I pulled the projects row plus tasks.', createdAt: '2026-08-05T00:00:02Z' },
  ];
}

function expectAfter(first: HTMLElement, second: HTMLElement) {
  // compareDocumentPosition: DOCUMENT_POSITION_FOLLOWING means `second` comes after `first`
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe('AssistantTranscript', () => {
  it('renders the assistant text message before its present_card, even though the card is persisted first', () => {
    render(
      <MemoryRouter>
        <AssistantTranscript
          messages={makeMessages()}
          streamingText=""
          isStreaming={false}
          toolStatus={[]}
          pendingQuestions={null}
          onAnswer={() => {}}
          isAnswering={false}
        />
      </MemoryRouter>,
    );

    expectAfter(
      screen.getByText('I pulled the projects row plus tasks.'),
      screen.getByText('OpenPlanAI'),
    );
  });

  it('keeps a mid-turn present_card below the still-streaming closing sentence (no reorder flicker)', () => {
    // The card row persists before the final assistant-text row, so while the
    // closing sentence is still streaming the transcript must render the
    // streamed text ABOVE the card — the same order it lands in at ai:done.
    const midTurn: AssistantMessage[] = [
      { id: 'u1', parentId: null, role: 'user', content: 'status?', createdAt: '2026-08-05T00:00:00Z' },
      { id: 't1', parentId: 'u1', role: 'tool', content: JSON.stringify(card), createdAt: '2026-08-05T00:00:01Z' },
    ];
    render(
      <MemoryRouter>
        <AssistantTranscript
          messages={midTurn}
          streamingText="There's 1 module in Project X."
          isStreaming
          toolStatus={[{ id: '1', tool: 'query_project_data', done: true }]}
          pendingQuestions={null}
          onAnswer={() => {}}
          isAnswering={false}
        />
      </MemoryRouter>,
    );

    expectAfter(
      screen.getByText("There's 1 module in Project X."),
      screen.getByText('OpenPlanAI'),
    );
  });

  it('holds the card below the frozen answer during the finalizing gap, without a duplicate bubble', () => {
    // ai:done has fired (isStreaming false) but the refetch that lands the
    // final text row is still in flight — finalizing keeps the streamed
    // answer frozen and the card below it.
    const midTurn: AssistantMessage[] = [
      { id: 'u1', parentId: null, role: 'user', content: 'status?', createdAt: '2026-08-05T00:00:00Z' },
      { id: 't1', parentId: 'u1', role: 'tool', content: JSON.stringify(card), createdAt: '2026-08-05T00:00:01Z' },
    ];
    render(
      <MemoryRouter>
        <AssistantTranscript
          messages={midTurn}
          streamingText="There's 1 module in Project X."
          isStreaming={false}
          finalizing
          toolStatus={[{ id: '1', tool: 'query_project_data', done: true }]}
          pendingQuestions={null}
          onAnswer={() => {}}
          isAnswering={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("There's 1 module in Project X.")).toHaveLength(1);
    expectAfter(
      screen.getByText("There's 1 module in Project X."),
      screen.getByText('OpenPlanAI'),
    );
  });

  it('drops the frozen bubble once the persisted text row lands, still above the card', () => {
    const landed: AssistantMessage[] = [
      { id: 'u1', parentId: null, role: 'user', content: 'status?', createdAt: '2026-08-05T00:00:00Z' },
      { id: 't1', parentId: 'u1', role: 'tool', content: JSON.stringify(card), createdAt: '2026-08-05T00:00:01Z' },
      {
        id: 'a1',
        parentId: 't1',
        role: 'assistant',
        content: "There's 1 module in Project X.",
        createdAt: '2026-08-05T00:00:02Z',
      },
    ];
    render(
      <MemoryRouter>
        <AssistantTranscript
          messages={landed}
          streamingText="There's 1 module in Project X."
          isStreaming={false}
          finalizing
          toolStatus={[{ id: '1', tool: 'query_project_data', done: true }]}
          pendingQuestions={null}
          onAnswer={() => {}}
          isAnswering={false}
        />
      </MemoryRouter>,
    );

    // Only the persisted row renders — no second, frozen copy.
    expect(screen.getAllByText("There's 1 module in Project X.")).toHaveLength(1);
    expectAfter(
      screen.getByText("There's 1 module in Project X."),
      screen.getByText('OpenPlanAI'),
    );
  });
});
