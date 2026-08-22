import { describe, it, expect } from 'vitest';
import { apiErrorMessage } from '@/services/api/errors';

const withStatus = (status: number, message: string) =>
  Object.assign(new Error(message), { response: { status } });

describe('apiErrorMessage', () => {
  it('surfaces the reason a 4xx gave', () => {
    const err = withStatus(409, 'Cannot delete this module — 1 task is still linked to it. Unlink the task first.');
    expect(apiErrorMessage(err, 'Failed to delete module')).toBe(err.message);
  });

  it('falls back for a 5xx, whose message is internal', () => {
    expect(apiErrorMessage(withStatus(500, 'relation "x" does not exist'), 'Failed to delete module'))
      .toBe('Failed to delete module');
  });

  it('falls back for transport failures, which carry no server body', () => {
    expect(apiErrorMessage(new Error('timeout of 15000ms exceeded'), 'Failed to delete module'))
      .toBe('Failed to delete module');
    expect(apiErrorMessage(new Error('Network Error'), 'Failed to delete module'))
      .toBe('Failed to delete module');
  });

  it('falls back when a 4xx body carried no usable message', () => {
    expect(apiErrorMessage(withStatus(403, '   '), 'Failed to delete module')).toBe('Failed to delete module');
  });

  it('tolerates non-Error throws', () => {
    expect(apiErrorMessage('boom', 'Failed to delete module')).toBe('Failed to delete module');
    expect(apiErrorMessage(undefined, 'Failed to delete module')).toBe('Failed to delete module');
  });
});
