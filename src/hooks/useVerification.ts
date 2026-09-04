import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { queryKeys } from '@/lib/queryClient';

// ─── API response types (backend shape) ───────────────────────────────────────

export type ApiVerificationMethod = 'test' | 'analysis' | 'inspection' | 'demonstration';
export type ApiTestExecutionResult = 'pass' | 'fail' | 'waived';
export type ApiRequirementVerificationStatus = 'not-verified' | 'in-progress' | 'passed' | 'failed' | 'waived';

export interface ApiTestExecution {
  id: string;
  testCaseId: string;
  buildId: string | null;
  buildLabel: string | null;
  measuredValue: number | null;
  unit: string | null;
  result: ApiTestExecutionResult;
  notes: string | null;
  testedBy: string | null;
  testedByName: string | null;
  testedAt: string;
  createdAt: string;
}

export interface ApiTestCase {
  id: string;
  projectId: string;
  requirementId: string;
  key: string;
  method: ApiVerificationMethod;
  title: string;
  procedure: string | null;
  createdBy: string | null;
  createdAt: string;
  latestExecution: ApiTestExecution | null;
  executionCount: number;
}

export interface ApiRequirementVerification {
  requirementId: string;
  vstatus: ApiRequirementVerificationStatus;
  testCases: ApiTestCase[];
  verifiedBy: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  verificationNote: string | null;
}

// Project-wide rollup — mirrors useECOs.ts's ApiAffectedRequirementLink and
// useBom.ts's ApiRequirementAllocation: one listing fetched per project so
// requirementsData.ts can compute every requirement's vstatus without N+1s.
export interface ApiVerificationSummaryItem {
  requirementId: string;
  vstatus: ApiRequirementVerificationStatus;
  testCaseCount: number;
}

export interface CreateTestCasePayload {
  method: ApiVerificationMethod;
  title: string;
  procedure?: string;
}

export interface UpdateTestCasePayload {
  method?: ApiVerificationMethod;
  title?: string;
  procedure?: string;
}

export interface RecordExecutionPayload {
  buildId?: string | null;
  measuredValue?: number | null;
  unit?: string | null;
  // Omit when the server can compute it (method='test', a numeric target,
  // and a tolerance that parses as a simple ±N/±N% range) — required
  // otherwise, and the request 422s with a clear message if it's missing.
  result?: ApiTestExecutionResult;
  notes?: string;
  testedAt?: string;
}

// ─── Project-wide summary ──────────────────────────────────────────────────────

// `buildId` scopes the rollup to one physical unit's test executions only —
// backs the Readiness view's per-build manufacturing readiness (plan §F).
// Omit it for the project-wide rollup used everywhere else.
export function useVerificationSummary(projectId: string | undefined, buildId?: string) {
  return useQuery({
    queryKey: queryKeys.verification.summary(projectId ?? '', buildId),
    queryFn: () =>
      apiClient.get<ApiVerificationSummaryItem[]>(ENDPOINTS.VERIFICATION.SUMMARY(projectId!), {
        params: buildId ? { buildId } : undefined,
      }),
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

// ─── Single requirement ─────────────────────────────────────────────────────────

export function useRequirementVerification(requirementId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.verification.byRequirement(requirementId ?? ''),
    queryFn: () =>
      apiClient.get<ApiRequirementVerification>(ENDPOINTS.VERIFICATION.BY_REQUIREMENT(requirementId!)),
    enabled: !!requirementId,
    staleTime: 15 * 1000,
  });
}

// A test case's own action mutations invalidate by requirementId (the
// detail view's query key) and by projectId (the summary's) — both passed
// in explicitly since neither is derivable from a bare testCaseId response
// alone without a round-trip.

export function useCreateTestCase(projectId: string, requirementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTestCasePayload) =>
      apiClient.post<ApiTestCase>(ENDPOINTS.VERIFICATION.CREATE_TEST_CASE(requirementId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.byRequirement(requirementId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.summary(projectId) });
    },
  });
}

export function useUpdateTestCase(projectId: string, requirementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testCaseId, payload }: { testCaseId: string; payload: UpdateTestCasePayload }) =>
      apiClient.patch<ApiTestCase>(ENDPOINTS.VERIFICATION.UPDATE_TEST_CASE(testCaseId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.byRequirement(requirementId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.summary(projectId) });
    },
  });
}

export function useDeleteTestCase(projectId: string, requirementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testCaseId: string) =>
      apiClient.delete<void>(ENDPOINTS.VERIFICATION.DELETE_TEST_CASE(testCaseId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.byRequirement(requirementId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.summary(projectId) });
    },
  });
}

export function useRecordExecution(projectId: string, requirementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testCaseId, payload }: { testCaseId: string; payload: RecordExecutionPayload }) =>
      apiClient.post<ApiTestExecution>(ENDPOINTS.VERIFICATION.RECORD_EXECUTION(testCaseId), payload),
    onSuccess: (_data, { testCaseId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.byRequirement(requirementId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.summary(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.executions(testCaseId) });
    },
  });
}

export function useTestCaseExecutions(testCaseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.verification.executions(testCaseId ?? ''),
    queryFn: () => apiClient.get<ApiTestExecution[]>(ENDPOINTS.VERIFICATION.EXECUTIONS(testCaseId!)),
    enabled: !!testCaseId,
    staleTime: 15 * 1000,
  });
}

// ─── Sign-off (single-owner mode) ──────────────────────────────────────────────

export function useConfirmVerified(projectId: string, requirementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) =>
      apiClient.post<ApiRequirementVerification>(ENDPOINTS.VERIFICATION.CONFIRM_VERIFIED(requirementId), {
        note,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.byRequirement(requirementId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.summary(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requirements.tree(projectId) });
    },
  });
}
