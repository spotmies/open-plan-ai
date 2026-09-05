import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { queryKeys } from '@/lib/queryClient';

// ─── API response types (snake_case from backend) ─────────────────────────────

export interface ApiEcoListItem {
  id: string;
  num: string;
  title: string;
  description: string | null;
  type: string;
  typeOther: string | null;
  reason: string;
  reasonOther: string | null;
  priority: string;
  status: string;
  changeClass: string;
  effectivityType: string | null;
  effectivityValue: string | null;
  originatingEcr: string | null;
  revFrom: string | null;
  revTo: string | null;
  originatorId: string | null;
  originatorName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  initiatedAt: string;
  targetDate: string | null;
  partCount: number;
  moduleIds: string[];
  awaitingMe: boolean;
  createdAt: string;
  updatedAt: string;
}

// Summary row for "which ECOs affect this part" — shown on the BOM part detail page.
export interface ApiEcoByPart {
  id: string;
  num: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  revFrom: string | null;
  revTo: string | null;
  impactLevel: 'high' | 'medium' | 'low';
  createdAt: string;
}

export interface ApiEcoPipelineStep {
  id: string;
  order: number;
  stage: string;
  stageLabel: string;
  approverUserId: string | null;
  approverName: string | null;
  approverRole: string | null;
  isOptional: boolean;
  optionalReason: string | null;
  justification: string | null;
  decision: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decidedByName: string | null;
  note: string | null;
}

export interface ApiEcoPart {
  id: string;
  partId: string;
  partNumber: string;
  name: string;
  description: string;
  bomNodeId: string | null;
  revFrom: string | null;
  revTo: string | null;
  impactLevel: string;
  disposition: string;
  qty: number | null;
  notes: string | null;
  whereUsedPaths: string[][];
}

export interface ApiEcoModule {
  id: string;
  moduleId: string;
  name: string;
  type: string;
}

export interface ApiEcoDiffRow {
  id: string;
  order: number;
  parameter: string;
  fromValue: string | null;
  toValue: string | null;
  changeLabel: string;
}

export interface ApiEcn {
  id: string;
  num: string;
  distributionList: { userId?: string | null; name: string; role: string }[];
  implementationTasks: { task: string; done?: boolean }[];
  releasedAt: string;
  releasedBy: string | null;
}

export interface ApiEcoActivity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  userId: string | null;
  userName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ApiEcoDetail extends ApiEcoListItem {
  requiresRecertification: boolean;
  certNotes: string | null;
  impactArea: string | null;
  firmwareCoupling: boolean;
  inventoryQty: number | null;
  scheduleImpact: string | null;
  unitCostDelta: number | null;
  oneTimeCost: number | null;
  parts: ApiEcoPart[];
  modules: ApiEcoModule[];
  steps: ApiEcoPipelineStep[];
  diffRows: ApiEcoDiffRow[];
  ecn: ApiEcn | null;
  activities: ApiEcoActivity[];
  // Set when this ECO was raised from a failed test result (Test &
  // Verification closed loop) rather than created directly — null otherwise.
  triggeredByTestExecutionId: string | null;
}

export interface ApiEcoStats {
  openEcos: number;
  inReview: number;
  awaitingMyAction: number;
  releasedThisMonth: number;
  avgCycleDays: number | null;
  cycleSampleCount: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useECOList(projectId: string | undefined, filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.ecos.list(projectId ?? '', filters),
    queryFn: (): Promise<PaginatedResponse<ApiEcoListItem>> =>
      apiClient.raw
        .get(ENDPOINTS.ECOS.LIST(projectId!), { params: filters })
        .then((r) => ({ data: r.data.data, meta: r.data.meta })),
    enabled: !!projectId,
  });
}

// Fetches every ECO id matching the given filters (ignores UI pagination) — used for "export all".
// Backend caps page size at 100; for larger result sets this walks subsequent pages.
export async function fetchAllEcoIds(
  projectId: string,
  filters?: Record<string, string>,
): Promise<string[]> {
  const limit = 100;
  let page = 1;
  const ids: string[] = [];
  for (;;) {
    const r = await apiClient.raw.get(ENDPOINTS.ECOS.LIST(projectId), {
      params: { ...filters, page: String(page), limit: String(limit) },
    });
    const batch = (r.data.data as ApiEcoListItem[]) ?? [];
    ids.push(...batch.map((e) => e.id));
    if (batch.length < limit || ids.length >= (r.data.meta?.total ?? ids.length)) break;
    page += 1;
  }
  return ids;
}

export function useEcosByPart(projectId: string | undefined, partId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ecos.byPart(partId ?? ''),
    queryFn: (): Promise<ApiEcoByPart[]> =>
      apiClient.get<ApiEcoByPart[]>(ENDPOINTS.ECOS.BY_PART(projectId!, partId!)),
    enabled: !!projectId && !!partId,
  });
}

export interface ApiAffectedRequirementLink {
  requirementId: string;
  ecoId: string;
  ecoNum: string;
  ecoStatus: string;
}

// Project-wide "which requirements have an in-flight ECO" listing — feeds
// requirementsData.ts's auto-suspect computation.
export function useECOAffectedRequirements(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ecos.affectedRequirements(projectId ?? ''),
    queryFn: (): Promise<ApiAffectedRequirementLink[]> =>
      apiClient.get<ApiAffectedRequirementLink[]>(ENDPOINTS.ECOS.AFFECTED_REQUIREMENTS(projectId!)),
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

export function useECOStats(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ecos.stats(projectId ?? ''),
    queryFn: (): Promise<ApiEcoStats> =>
      apiClient.get<ApiEcoStats>(ENDPOINTS.ECOS.STATS(projectId!)),
    enabled: !!projectId,
  });
}

export function useECODetail(projectId: string | undefined, ecoId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ecos.detail(ecoId ?? ''),
    queryFn: (): Promise<ApiEcoDetail> =>
      apiClient.get<ApiEcoDetail>(ENDPOINTS.ECOS.BY_ID(projectId!, ecoId!)),
    enabled: !!projectId && !!ecoId,
  });
}

export function useCreateECO(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: unknown) =>
      apiClient.post<ApiEcoDetail>(ENDPOINTS.ECOS.CREATE(projectId), dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ecos.listRoot(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.stats(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.affectedRequirements(projectId) });
    },
  });
}

export function useUpdateECO(projectId: string, ecoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: unknown) =>
      apiClient.put<ApiEcoDetail>(ENDPOINTS.ECOS.UPDATE(projectId, ecoId), dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ecos.detail(ecoId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.listRoot(projectId) });
    },
  });
}

export function useDeleteECO(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ecoId: string) =>
      apiClient.delete(ENDPOINTS.ECOS.DELETE(projectId, ecoId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ecos.listRoot(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.stats(projectId) });
    },
  });
}

export function useSubmitECO(projectId: string, ecoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<ApiEcoDetail>(ENDPOINTS.ECOS.SUBMIT(projectId, ecoId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ecos.detail(ecoId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.listRoot(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.stats(projectId) });
    },
  });
}

export function useECODecision(projectId: string, ecoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { decision: 'approved' | 'rejected'; note?: string }) =>
      apiClient.post<ApiEcoDetail>(ENDPOINTS.ECOS.DECISION(projectId, ecoId), dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ecos.detail(ecoId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.listRoot(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.stats(projectId) });
      // BOM revisions are auto-created on final approval — refresh BOM tree and parts cache
      qc.invalidateQueries({ queryKey: queryKeys.bom.all });
      qc.invalidateQueries({ queryKey: queryKeys.parts.all });
    },
  });
}

export function useReleaseECO(projectId: string, ecoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      distributionList?: { name: string; role: string }[];
      implementationTasks?: { task: string }[];
    }) => apiClient.post<ApiEcoDetail>(ENDPOINTS.ECOS.RELEASE(projectId, ecoId), dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ecos.detail(ecoId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.listRoot(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.stats(projectId) });
    },
  });
}

export function useVerifyECO(projectId: string, ecoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto?: { note?: string }) =>
      apiClient.post<ApiEcoDetail>(ENDPOINTS.ECOS.VERIFY(projectId, ecoId), dto ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ecos.detail(ecoId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.listRoot(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.stats(projectId) });
    },
  });
}

export function useCloseECO(projectId: string, ecoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<ApiEcoDetail>(ENDPOINTS.ECOS.CLOSE(projectId, ecoId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ecos.detail(ecoId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.listRoot(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.stats(projectId) });
      // Closing is the one status change that flips an affected requirement's
      // "suspect" signal off — see requirementsData.ts's rebuild.
      qc.invalidateQueries({ queryKey: queryKeys.ecos.affectedRequirements(projectId) });
    },
  });
}

export function useHoldECO(projectId: string, ecoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<ApiEcoDetail>(ENDPOINTS.ECOS.HOLD(projectId, ecoId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ecos.detail(ecoId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.listRoot(projectId) });
    },
  });
}

export function useResumeECO(projectId: string, ecoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<ApiEcoDetail>(ENDPOINTS.ECOS.RESUME(projectId, ecoId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ecos.detail(ecoId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.listRoot(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.ecos.stats(projectId) });
    },
  });
}

export function useGetECN(projectId: string | undefined, ecoId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ecos.ecn(ecoId ?? ''),
    queryFn: (): Promise<ApiEcn> =>
      apiClient.get<ApiEcn>(ENDPOINTS.ECOS.ECN(projectId!, ecoId!)),
    enabled: !!projectId && !!ecoId,
  });
}

export function useDownloadEcnPdf(projectId: string, ecoId: string) {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.raw.get(
        ENDPOINTS.ECOS.ECN_PDF(projectId, ecoId),
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ECN-${ecoId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

// ─── Export hooks ────────────────────────────────────────────────────────────

export function useExportEcoSummaryCsv(projectId: string) {
  return useMutation({
    mutationFn: (ecoIds: string[]) =>
      apiClient.raw
        .get(`/projects/${projectId}/ecos/export/summary`, {
          params: { ids: ecoIds.join(',') },
          responseType: 'blob',
        })
        .then((r) => r.data as Blob),
  });
}

export function useExportEcoDetailedCsv(projectId: string) {
  return useMutation({
    mutationFn: (ecoIds: string[]) =>
      apiClient.raw
        .get(`/projects/${projectId}/ecos/export/detailed`, {
          params: { ids: ecoIds.join(',') },
          responseType: 'blob',
        })
        .then((r) => r.data as Blob),
  });
}
