import { Clock, LifeBuoy, RefreshCw, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrgReviewBlock } from "../orgReview";

/**
 * "Your organization is under review" / "was not approved", rendered *inside* the
 * login, signup and verify-email cards.
 *
 * Deliberately not a route: a blocked applicant has no session, so a page at
 * /pending-approval would have nothing to authenticate and nothing to poll. The
 * message belongs where they already are — in the box they just submitted.
 *
 * There is no auto-refresh. Re-checking means re-attempting login, which is rate
 * limited (30 requests / 15 min per IP); a poll would burn that allowance on a
 * state only an operator can change. Hence a manual button.
 */

/**
 * Opened in a new tab rather than navigated to: the applicant is mid-flow on the
 * login/verify card, and replacing it would lose the email they just typed and the
 * explanation they are reading.
 */
const SUPPORT_URL = "https://www.openplanai.com/contact";

interface OrgReviewNoticeProps {
  review: OrgReviewBlock;
  /** Re-attempts sign-in. Omit where there are no credentials to retry with. */
  onRetry?: () => void;
  retrying?: boolean;
}

export function OrgReviewNotice({ review, onRetry, retrying }: OrgReviewNoticeProps) {
  const rejected = review.code === "ORG_REJECTED";
  const orgLabel = review.orgName ? <strong className="font-medium">{review.orgName}</strong> : "Your organization";

  return (
    <div className="space-y-4 text-center">
      <div
        className={
          rejected
            ? "mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10"
            : "mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
        }
      >
        {rejected ? (
          <ShieldX className="h-6 w-6 text-destructive" />
        ) : (
          <Clock className="h-6 w-6 text-primary" />
        )}
      </div>

      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">
          {rejected ? "Registration not approved" : "Application under review"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {rejected ? (
            <>{orgLabel} was not approved, so you can't sign in yet.</>
          ) : (
            <>
              {orgLabel} is waiting for admin approval. We'll email you as soon as it's approved —
              you can sign in then.
            </>
          )}
        </p>
      </div>

      {rejected && review.reason && (
        <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-left">
          <p className="text-xs font-medium text-destructive">Reason</p>
          <p className="mt-0.5 text-sm text-destructive/90">{review.reason}</p>
        </div>
      )}

      {/* Rejection is reversible by an admin and destroys nothing, so the way
          forward is a conversation — say so rather than implying it is final. */}
      {rejected && (
        <p className="text-xs text-muted-foreground">
          Nothing has been deleted. Get in touch and we can review it again.
        </p>
      )}

      <div className="space-y-2">
        {onRetry && (
          <Button variant="outline" className="w-full" onClick={onRetry} disabled={retrying}>
            <RefreshCw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Checking..." : "Check again"}
          </Button>
        )}
        <Button variant="ghost" className="w-full" asChild>
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            <LifeBuoy className="mr-2 h-4 w-4" />
            Contact support
          </a>
        </Button>
      </div>
    </div>
  );
}

export default OrgReviewNotice;
