import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

// Config values round-trip to the backend as-is (lowercase), so we keep them
// lowercase here rather than applying the UPPERCASE domain-enum convention.
export type AutoAssignStrategy = 'none' | 'fixed' | 'round_robin';
export type IssueCategory =
  | 'defect'
  | 'risk'
  | 'supplier'
  | 'compliance'
  | 'test-failure'
  | 'design-change'
  | 'other';
export type IssueSeverity = 'critical' | 'major' | 'minor' | 'trivial';

export interface SupportLink {
  id: string;
  projectId: string;
  orgId: string;
  name: string;
  isActive: boolean;
  /** Endpoint external systems POST tickets to (path; same for every key). */
  endpointUrl: string;
  /**
   * The live plaintext API key. Shown persistently (not a one-time reveal) so
   * it can be baked directly into ready-to-paste integration code. Null only
   * for a legacy link with no key generated yet — regenerate to create one.
   */
  apiKey: string | null;
  /** Non-secret identifier of the current key, e.g. `sk_live_ab12cd34`. */
  apiKeyPrefix: string | null;
  hasApiKey: boolean;
  defaultColumnKey: string | null;
  defaultCategory: IssueCategory;
  defaultSeverity: IssueSeverity;
  autoAssignStrategy: AutoAssignStrategy;
  autoAssignUserIds: string[];
  notifyUserIds: string[];
  notifyEmails: string[];
  intakeOwnerUserId: string | null;
  requireEmail: boolean;
  requirePhone: boolean;
  submissionCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportSubmissionSummary {
  id: string;
  issueId: string;
  submitterName: string;
  submitterEmail: string | null;
  submitterPhone: string | null;
  createdAt: string;
}

export interface SupportLinkDetail extends SupportLink {
  recentSubmissions: SupportSubmissionSummary[];
}

export interface CreateSupportLinkInput {
  name: string;
  defaultColumnKey?: string | null;
  defaultCategory?: IssueCategory;
  defaultSeverity?: IssueSeverity;
  autoAssignStrategy?: AutoAssignStrategy;
  autoAssignUserIds?: string[];
  notifyUserIds?: string[];
  notifyEmails?: string[];
  intakeOwnerUserId?: string | null;
  requireEmail?: boolean;
  requirePhone?: boolean;
  isActive?: boolean;
}

export type UpdateSupportLinkInput = Partial<CreateSupportLinkInput>;

export const supportLinksService = {
  list(projectId: string): Promise<SupportLink[]> {
    return apiClient.get<SupportLink[]>(ENDPOINTS.SUPPORT_LINKS.LIST(projectId));
  },
  getById(projectId: string, linkId: string): Promise<SupportLinkDetail> {
    return apiClient.get<SupportLinkDetail>(ENDPOINTS.SUPPORT_LINKS.BY_ID(projectId, linkId));
  },
  create(projectId: string, input: CreateSupportLinkInput): Promise<SupportLink> {
    return apiClient.post<SupportLink>(ENDPOINTS.SUPPORT_LINKS.CREATE(projectId), input);
  },
  update(projectId: string, linkId: string, input: UpdateSupportLinkInput): Promise<SupportLink> {
    return apiClient.patch<SupportLink>(ENDPOINTS.SUPPORT_LINKS.BY_ID(projectId, linkId), input);
  },
  regenerate(projectId: string, linkId: string): Promise<SupportLink> {
    return apiClient.post<SupportLink>(ENDPOINTS.SUPPORT_LINKS.REGENERATE(projectId, linkId), {});
  },
  remove(projectId: string, linkId: string): Promise<void> {
    return apiClient.delete<void>(ENDPOINTS.SUPPORT_LINKS.BY_ID(projectId, linkId));
  },
};
