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

    const textNode = screen.getByText('I pulled the projects row plus tasks.');
    const cardNode = screen.getByText('OpenPlanAI');

    // compareDocumentPosition: DOCUMENT_POSITION_FOLLOWING means cardNode comes after textNode
    // eslint-disable-next-line no-bitwise
    const position = textNode.compareDocumentPosition(cardNode);
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
