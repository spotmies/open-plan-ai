import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { queryKeys } from '@/lib/queryClient';
import { useOrganization } from '@/contexts/OrganizationContext';

/**
 * Org-wide dashboard aggregates, in one request.
 *
 * These hooks used to take `projectIds` and fan out with `useQueries`, issuing
 * an ECO-stats, ECO-list and BOM-summary call per project — plus a second copy
 * of the ECO list under a different query key. For an org with N projects that
 * was 4N requests on every dashboard load, all of them queued behind the
 * browser's 6-connections-per-host limit. The backend now computes the same
 * numbers in SQL at `GET /organizations/:orgId/dashboard`, so the cost no
 * longer scales with project count.
 *
 * The `projectIds` parameters are gone deliberately: the server derives scope
 * itself (and applies the same admin/member visibility rule as the project
 * list), so callers can't accidentally aggregate over a partial page.
 */

export interface OrgDashboardAwaitingEco {
  id: string;
  num: string;
  title: string;
  projectId: string;
}

export interface OrgDashboardMilestone {
  id: string;
  title: string;
  dueDate: string;
  projectId: string;
}

export interface OrgDashboardResponse {
  eco: {
    open: number;
    awaitingMyAction: number;
    firstPassPct: number | null;
    avgCycleDays: number | null;
    byStatus: Record<string, number>;
    awaiting: OrgDashboardAwaitingEco[];
  };
  bom: { total: number; approved: number; pending: number; rejected: number };
  upcomingMilestones: OrgDashboardMilestone[];
  atRiskProjectIds: string[];
}

const EMPTY: OrgDashboardResponse = {
  eco: {
    open: 0,
    awaitingMyAction: 0,
    firstPassPct: null,
    avgCycleDays: null,
    byStatus: {},
    awaiting: [],
  },
  bom: { total: 0, approved: 0, pending: 0, rejected: 0 },
  upcomingMilestones: [],
  atRiskProjectIds: [],
};

/**
 * The one query every dashboard panel reads from. React Query dedupes by key,
 * so the panels below can each call this without producing extra requests.
 */
export function useOrgDashboard() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: queryKeys.dashboard.overview(orgId),
    queryFn: () => apiClient.get<OrgDashboardResponse>(ENDPOINTS.ORGANIZATIONS.DASHBOARD(orgId!)),
    enabled: !!orgId,
  });

  return {
    // `isLoading` is false while the org itself is still resolving (the query
    // is disabled then), so fold that in — otherwise panels flash zeros.
    isLoading: query.isLoading || (!!orgId && query.isPending),
    data: query.data ?? EMPTY,
  };
}

// ── ECO aggregate across all org projects ──────────────────────────────────────

export interface OrgEcoAggregate {
  isLoading: boolean;
  open: number;
  awaitingMyAction: number;
  firstPassPct: number | null; // null when there's no ECO history to compute from
  avgCycleDays: number | null;
}

export function useOrgEcoAggregate(): OrgEcoAggregate {
  const { isLoading, data } = useOrgDashboard();
  return {
    isLoading,
    open: data.eco.open,
    awaitingMyAction: data.eco.awaitingMyAction,
    firstPassPct: data.eco.firstPassPct,
    avgCycleDays: data.eco.avgCycleDays,
  };
}

// ── ECO pipeline-by-stage counts across all org projects ───────────────────────

/**
 * Counts keyed by the frontend's UPPERCASE status vocabulary. The backend
 * sends lowercase (`in_review`), matching the enum-case convention used by the
 * ecoData/bomData adapters.
 */
export function useOrgEcoStatusCounts(): { isLoading: boolean; countByStatus: Record<string, number> } {
  const { isLoading, data } = useOrgDashboard();

  const countByStatus: Record<string, number> = {};
  for (const [status, count] of Object.entries(data.eco.byStatus)) {
    countByStatus[status.toUpperCase()] = count;
  }

  return { isLoading, countByStatus };
}

// ── ECOs awaiting the current user's approval, across all org projects ─────────

export function useOrgAwaitingEcos(): { isLoading: boolean; awaiting: OrgDashboardAwaitingEco[] } {
  const { isLoading, data } = useOrgDashboard();
  return { isLoading, awaiting: data.eco.awaiting };
}

// ── BOM aggregate across all org projects ──────────────────────────────────────

export interface OrgBomAggregate {
  isLoading: boolean;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  pct: number; // approved / total, 0 when total is 0
}

export function useOrgBomAggregate(): OrgBomAggregate {
  const { isLoading, data } = useOrgDashboard();
  const { total, approved, pending, rejected } = data.bom;
  return {
    isLoading,
    total,
    approved,
    pending,
    rejected,
    pct: total > 0 ? Math.round((approved / total) * 100) : 0,
  };
}
