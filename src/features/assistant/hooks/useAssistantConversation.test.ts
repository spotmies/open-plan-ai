import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWrapper, renderHook, waitFor } from '@/test/utils';
import { assistantService } from '@/services/assistant.service';
import { useAssistantConversation } from './useAssistantConversation';

// A fake transport that records the latest handler registered for each ai:*
// event and lets a test fire it synchronously. Hoisted so the vi.mock factory
// below (also hoisted) can close over it.
const { transportMock, emit, resetHandlers } = vi.hoisted(() => {
  const handlers: Record<string, ((...args: unknown[]) => void) | undefined> = {};
  const makeOn = (key: string) => (cb: (...args: unknown[]) => void) => {
    handlers[key] = cb;
    return () => {
      if (handlers[key] === cb) handlers[key] = undefined;
    };
  };
  return {
    transportMock: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      joinConversation: vi.fn(),
      leaveConversation: vi.fn(),
      onToken: makeOn('token'),
      onToolCall: makeOn('toolCall'),
      onToolResult: makeOn('toolResult'),
      onQuestion: makeOn('question'),
      onCard: makeOn('card'),
      onProposal: makeOn('proposal'),
      onProposalUpdate: makeOn('proposalUpdate'),
      onDone: makeOn('done'),
      onStopped: makeOn('stopped'),
      onError: makeOn('error'),
    },
    emit: (key: string, ...args: unknown[]) => handlers[key]?.(...args),
    resetHandlers: () => Object.keys(handlers).forEach((k) => delete handlers[k]),
  };
});

vi.mock('../transport', () => ({ aiAssistantTransport: transportMock }));

vi.mock('@/services/assistant.service', () => ({
  assistantService: {
    getConversation: vi.fn().mockResolvedValue({
      id: 'x',
      title: null,
      scope: 'all_projects',
      projectId: null,
      status: 'active',
      focusEntities: null,
      pinned: false,
      pinnedAt: null,
      shareId: null,
      sharedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      pendingQuestions: null,
      messages: [],
      proposals: [],
    }),
    sendMessage: vi.fn().mockResolvedValue({ id: 'm-new' }),
  },
}));

describe('useAssistantConversation — per-thread isolation', () => {
  beforeEach(() => {
    resetHandlers();
    vi.clearAllMocks();
  });

  it('drops the previous thread\'s in-flight streaming state when the conversation switches', () => {
    const { result, rerender } = renderHook(
      (props: { id: string }) => useAssistantConversation(props.id),
      { initialProps: { id: 'conv-a' }, wrapper: createWrapper() },
    );

    act(() => {
      emit('token', 'partial answer for A');
      emit('toolCall', 'query_project_data');
    });
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.streamingText).toBe('partial answer for A');
    expect(result.current.toolStatus).toHaveLength(1);

    rerender({ id: 'conv-b' });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamingText).toBe('');
    expect(result.current.toolStatus).toEqual([]);
    expect(transportMock.leaveConversation).toHaveBeenCalledWith('conv-a');
    expect(transportMock.joinConversation).toHaveBeenCalledWith('conv-b');
  });

  it('keeps streaming state on a re-render that does not change the conversation id', () => {
    const { result, rerender } = renderHook(
      (props: { id: string }) => useAssistantConversation(props.id),
      { initialProps: { id: 'conv-a' }, wrapper: createWrapper() },
    );

    act(() => {
      emit('token', 'still thinking');
    });
    expect(result.current.isStreaming).toBe(true);

    rerender({ id: 'conv-a' });

    expect(result.current.isStreaming).toBe(true);
    expect(result.current.streamingText).toBe('still thinking');
  });
});

describe('useAssistantConversation — finalizing (post-ai:done refetch gap)', () => {
  const conv = (messages: unknown[]) => ({
    id: 'x',
    title: null,
    scope: 'all_projects',
    projectId: null,
    status: 'active',
    focusEntities: null,
    pinned: false,
    pinnedAt: null,
    shareId: null,
    sharedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    pendingQuestions: null,
    messages,
    proposals: [],
  });
  const userRow = { id: 'u1', parentId: null, role: 'user', content: 'status?', createdAt: '2026-01-01T00:00:00Z' };
  const cardRow = { id: 't1', parentId: 'u1', role: 'tool', content: '{"type":"status"}', createdAt: '2026-01-01T00:00:01Z' };
  const answerRow = { id: 'a1', parentId: 't1', role: 'assistant', content: 'Done.', createdAt: '2026-01-01T00:00:02Z' };

  beforeEach(() => {
    resetHandlers();
    vi.clearAllMocks();
  });

  it('holds the streamed answer + tool status after ai:done until the final row lands', async () => {
    const getConversation = vi.mocked(assistantService.getConversation);
    getConversation.mockResolvedValue(conv([userRow, cardRow]));

    const { result } = renderHook(() => useAssistantConversation('conv-a'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => {
      emit('toolCall', 'query_project_data');
      emit('token', "There's 1 module.");
      emit('card', { type: 'status' });
    });

    act(() => {
      emit('done');
    });

    // isStreaming is off, but the answer stays frozen on screen (finalizing)
    // so it never blinks out while the ai:done refetch is in flight.
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.finalizing).toBe(true);
    expect(result.current.streamingText).toBe("There's 1 module.");
    expect(result.current.toolStatus).toHaveLength(1);

    // The refetch lands the persisted answer row → the freeze lifts.
    getConversation.mockResolvedValue(conv([userRow, cardRow, answerRow]));
    act(() => {
      emit('proposalUpdate'); // any event that re-invalidates the conversation
    });

    await waitFor(() => expect(result.current.finalizing).toBe(false));
    expect(result.current.streamingText).toBe('');
    expect(result.current.toolStatus).toEqual([]);
  });

  it('drops the frozen answer when the next turn starts', async () => {
    const getConversation = vi.mocked(assistantService.getConversation);
    getConversation.mockResolvedValue(conv([userRow, cardRow]));

    const { result } = renderHook(() => useAssistantConversation('conv-a'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => {
      emit('token', 'first answer');
      emit('done');
    });
    expect(result.current.finalizing).toBe(true);

    await act(async () => {
      result.current.sendMessage('follow up');
    });

    await waitFor(() => expect(result.current.finalizing).toBe(false));
    expect(result.current.streamingText).toBe('');
  });
});
