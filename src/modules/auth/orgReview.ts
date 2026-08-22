/**
 * The signup approval gate, client side.
 *
 * An organization created at signup starts in `pending_review` and its members
 * cannot obtain a session until a platform admin approves it. The backend
 * signals this the same way it signals an unverified email: a 403 whose message
 * is a JSON payload carrying a machine-readable `code`.
 *
 * Three endpoints can return it — `/auth/login`, `/auth/verify-otp` and
 * `/auth/register` — which is why the parsing lives here rather than inline in
 * any one caller.
 *
 * A 403 bypasses the api client's 401 refresh interceptor entirely, so no
 * skip-refresh registration is needed for these.
 */

export type OrgReviewCode = 'ORG_PENDING_REVIEW' | 'ORG_REJECTED';

export interface OrgReviewBlock {
  code: OrgReviewCode;
  /** The organization awaiting review. Absent if the backend could not name it. */
  orgName?: string;
  /** Only ever set for ORG_REJECTED — shown to the applicant verbatim. */
  reason?: string;
}

const REVIEW_CODES: readonly string[] = ['ORG_PENDING_REVIEW', 'ORG_REJECTED'];

interface ApiErrorShape {
  response?: { status?: number; data?: { error?: { message?: string } } };
}

/**
 * Pulls an org-review block out of a rejected request, or null if the failure was
 * something else.
 *
 * Depends on `extractApiError` in services/api/client.ts preserving the axios
 * `response` on the Error it rethrows — without that the code is unrecoverable
 * and the raw JSON string ends up rendered to the user.
 */
export function parseOrgReviewError(err: unknown): OrgReviewBlock | null {
  const axiosErr = err as ApiErrorShape;
  if (axiosErr?.response?.status !== 403) return null;

  const rawMessage = axiosErr.response?.data?.error?.message;
  if (!rawMessage) return null;

  try {
    const parsed = JSON.parse(rawMessage) as Partial<OrgReviewBlock>;
    if (!parsed?.code || !REVIEW_CODES.includes(parsed.code)) return null;
    return {
      code: parsed.code as OrgReviewCode,
      orgName: parsed.orgName,
      reason: parsed.reason,
    };
  } catch {
    // Plain-string 403s (a disabled account, for example) land here — not ours.
    return null;
  }
}
