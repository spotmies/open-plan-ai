import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWrapper, renderHook } from '@/test/utils';
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
