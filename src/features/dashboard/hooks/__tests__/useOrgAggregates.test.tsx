import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, createWrapper } from '@/test/utils';

const getMock = vi.fn();

vi.mock('@/services/api/client', () => ({
  apiClient: { get: (...args: unknown[]) => getMock(...args) },
}));

vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ currentOrganization: { id: 'org-1' } }),
}));

import {
  useOrgDashboard,
  useOrgEcoAggregate,
  useOrgEcoStatusCounts,
  useOrgAwaitingEcos,
  useOrgBomAggregate,
} from '../useOrgAggregates';

const RESPONSE = {
  eco: {
    open: 5,
    awaitingMyAction: 2,
    firstPassPct: 88,
    avgCycleDays: 4,
    byStatus: { draft: 1, in_review: 2, rework: 1, released: 1, closed: 3 },
    awaiting: [
      { id: 'e1', num: 'ECO-2', title: 'b', projectId: 'p1' },
      { id: 'e2', num: 'ECO-8', title: 'h', projectId: 'p3' },
    ],
  },
  bom: { total: 5, approved: 2, pending: 2, rejected: 1 },
  upcomingMilestones: [
    { id: 'm2', title: 'future B', dueDate: '2026-08-11', projectId: 'p2' },
    { id: 'm1', title: 'future A', dueDate: '2026-08-15', projectId: 'p1' },
  ],
  atRiskProjectIds: ['p1'],
};

beforeEach(() => {
  getMock.mockReset();
  getMock.mockResolvedValue(RESPONSE);
});

describe('useOrgDashboard', () => {
  it('requests the org dashboard aggregate endpoint', async () => {
    const { result } = renderHook(() => useOrgDashboard(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/organizations/org-1/dashboard');
  });

  /**
   * The regression this whole change exists to prevent: the dashboard used to
   * issue one ECO-stats, two ECO-list and one BOM-summary request *per
   * project*. All four panels must now share a single cached request.
   */
  it('issues exactly one request even when every panel hook is mounted', async () => {
    const { result } = renderHook(
      () => ({
        eco: useOrgEcoAggregate(),
        status: useOrgEcoStatusCounts(),
        awaiting: useOrgAwaitingEcos(),
        bom: useOrgBomAggregate(),
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.eco.isLoading).toBe(false));

    expect(getMock).toHaveBeenCalledTimes(1);
  });
});

describe('useOrgEcoAggregate', () => {
  it('passes through the server-computed ECO figures', async () => {
    const { result } = renderHook(() => useOrgEcoAggregate(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.open).toBe(5);
    expect(result.current.awaitingMyAction).toBe(2);
    expect(result.current.firstPassPct).toBe(88);
    expect(result.current.avgCycleDays).toBe(4);
  });

  it('keeps null first-pass / cycle values null rather than coercing to 0', async () => {
    getMock.mockResolvedValue({
      ...RESPONSE,
      eco: { ...RESPONSE.eco, firstPassPct: null, avgCycleDays: null },
    });
    const { result } = renderHook(() => useOrgEcoAggregate(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The panel renders "—" for null and "0%" for zero; they must not blur.
    expect(result.current.firstPassPct).toBeNull();
    expect(result.current.avgCycleDays).toBeNull();
  });
});

describe('useOrgEcoStatusCounts', () => {
  it('upper-cases backend statuses to the frontend enum vocabulary', async () => {
    const { result } = renderHook(() => useOrgEcoStatusCounts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.countByStatus).toEqual({
      DRAFT: 1,
      IN_REVIEW: 2,
      REWORK: 1,
      RELEASED: 1,
      CLOSED: 3,
    });
  });

  it('omits statuses the server did not report, so callers fall back to 0', async () => {
    const { result } = renderHook(() => useOrgEcoStatusCounts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.countByStatus.VERIFIED).toBeUndefined();
  });
});

describe('useOrgAwaitingEcos', () => {
  it('returns the awaiting list with its project ids intact', async () => {
    const { result } = renderHook(() => useOrgAwaitingEcos(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // projectId is what the panel links through to; losing it would 404.
    expect(result.current.awaiting).toEqual([
      { id: 'e1', num: 'ECO-2', title: 'b', projectId: 'p1' },
      { id: 'e2', num: 'ECO-8', title: 'h', projectId: 'p3' },
    ]);
  });
});

describe('useOrgBomAggregate', () => {
  it('derives the approved percentage from the counts', async () => {
    const { result } = renderHook(() => useOrgBomAggregate(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.total).toBe(5);
    expect(result.current.approved).toBe(2);
    expect(result.current.pct).toBe(40);
  });

  it('reports 0% rather than NaN when there are no BOM nodes', async () => {
    getMock.mockResolvedValue({
      ...RESPONSE,
      bom: { total: 0, approved: 0, pending: 0, rejected: 0 },
    });
    const { result } = renderHook(() => useOrgBomAggregate(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.pct).toBe(0);
  });
});

describe('failure handling', () => {
  it('falls back to empty aggregates instead of throwing when the request fails', async () => {
    getMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(
      () => ({ eco: useOrgEcoAggregate(), bom: useOrgBomAggregate() }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.eco.isLoading).toBe(false));

    expect(result.current.eco.open).toBe(0);
    expect(result.current.eco.firstPassPct).toBeNull();
    expect(result.current.bom.pct).toBe(0);
  });
});
