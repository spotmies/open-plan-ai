import { apiClient } from './api/client';
import { ENDPOINTS } from './api/endpoints';
import { logger } from './monitoring/logger';
import { config } from '@/config';

export interface ScheduleEventParams {
  title: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  attendees: string[]; // List of emails
  // RFC 5545 RRULE line(s), e.g. ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"].
  // Omit for a one-off (non-repeating) meeting.
  recurrence?: string[];
}

export interface GoogleMeetStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
}

export interface GoogleMeetAccessToken {
  accessToken: string;
  expiresIn: number;
  email: string;
}

/**
 * Turns a failed Google API Response into an Error with a message that's
 * actually useful to show the user, instead of a generic string that hides
 * whether this was an expired token, a disabled API, or a bad request.
 */
async function toGoogleApiError(response: Response): Promise<Error> {
  const rawBody = await response.text();
  let reason = rawBody;
  try {
    const parsed = JSON.parse(rawBody);
    reason = parsed?.error?.message || rawBody;
  } catch {
    // Body wasn't JSON — fall back to the raw text.
  }

  // error.message is often a generic summary ("Bad Request") with the real
  // field-level cause only in error.errors[]/error.details — log the full
  // body so it's never lost even when the toast text is a summary.
  logger.error('Google API request failed', { status: response.status, url: response.url, body: rawBody });

  if (response.status === 401) {
    return new Error(
      'Your Google session expired or was revoked. Please reconnect Google Meet in Integrations.'
    );
  }
  if (response.status === 403) {
    return new Error(
      `Google denied this request (403): ${reason}. This usually means the Google Calendar API isn't enabled for this OAuth client's Google Cloud project, or the connected account isn't approved on the OAuth consent screen.`
    );
  }
  return new Error(`Google API error (${response.status}): ${reason}`);
}

export const googleMeetService = {
  /**
   * Full backend URL that kicks off the OAuth flow. Must be used as a real
   * page navigation (`window.location.href = ...`), not an apiClient fetch —
   * the browser has to follow the redirect all the way to Google's consent
   * screen and back to our callback route. The backend stores the resulting
   * refresh token permanently, which is what lets the connection survive
   * indefinitely instead of needing re-consent every ~hour.
   *
   * `returnTo` tells the backend which origin to redirect back to once the
   * Google round trip finishes — without it, the callback has no way to know
   * whether this flow started from localhost or a deployed environment and
   * falls back to a fixed default, which sends localhost sessions off to
   * that default instead of back to localhost.
   */
  getConnectUrl(): string {
    const base = config.api.baseUrl.replace(/\/$/, '');
    const returnTo = encodeURIComponent(window.location.origin);
    return `${base}${ENDPOINTS.GOOGLE_MEET.CONNECT}?returnTo=${returnTo}`;
  },

  /**
   * Mints a fresh short-lived access token from the refresh token the
   * backend already has on file — no Google popup involved. Throws (404) if
   * this account has never connected, or the connection was invalidated.
   */
  async getAccessToken(): Promise<GoogleMeetAccessToken> {
    return apiClient.get<GoogleMeetAccessToken>(ENDPOINTS.GOOGLE_MEET.ACCESS_TOKEN);
  },

  async disconnect(): Promise<void> {
    await apiClient.post(ENDPOINTS.GOOGLE_MEET.DISCONNECT);
  },

  /** Batch-fetch Google Meet connection status for a set of user IDs. */
  async getStatus(userIds: string[]): Promise<Record<string, GoogleMeetStatus>> {
    if (userIds.length === 0) return {};
    return apiClient.get<Record<string, GoogleMeetStatus>>(ENDPOINTS.GOOGLE_MEET.STATUS(userIds));
  },

  /**
   * Creates an instant Google Meet room using the Google Meet REST API v2.
   * POST https://meet.googleapis.com/v2/spaces
   */
  async createInstantMeeting(accessToken: string): Promise<{ meetingUri: string; name: string }> {
    try {
      const response = await fetch('https://meet.googleapis.com/v2/spaces', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config: { accessType: 'OPEN' } }),
      });

      if (!response.ok) {
        throw await toGoogleApiError(response);
      }

      const data = await response.json();
      // The API returns meetingUri (e.g. https://meet.google.com/abc-defg-hij) and name (space identifier)
      // accessType: OPEN means anyone with the link joins immediately —
      // no host has to be present to let guests in.
      return {
        meetingUri: data.meetingUri,
        name: data.name,
      };
    } catch (error) {
      logger.error('Failed to create instant Google Meet:', error);
      throw error;
    }
  },

  /**
   * Schedules a Calendar Event with a Google Meet link attached.
   * POST https://www.googleapis.com/calendar/v3/calendars/primary/events
   *
   * "primary" always resolves to the calendar of whichever Google account
   * `accessToken` belongs to — i.e. the account connected in Integrations,
   * which is looked up per-app-user on the backend (see
   * useEnsureGoogleMeetToken). That holds regardless of the signed-in app
   * user's own email, and regardless of `params.recurrence` — a recurring
   * event is still a single POST; Google expands it into instances on the
   * connected account's calendar.
   *
   * Deliberately does NOT use Calendar's `conferenceData.createRequest` to
   * spin up the Meet space. That path creates a space with no way to
   * request `accessType: 'OPEN'`, and — because the space ends up owned by
   * Calendar's own service rather than this OAuth client — it can't be
   * patched open afterward via the Meet API either (the
   * `meetings.space.created` scope only covers spaces the app created
   * directly, and a PATCH against one Calendar created 404s/403s silently).
   * The result was scheduled meetings always defaulting to Google's TRUSTED
   * join policy ("ask to join") no matter what we sent. Creating the space
   * ourselves via `createInstantMeeting` first — the same call already
   * proven to produce an open space — and attaching its link as the event's
   * location/description is the only reliable way to guarantee open access.
   */
  async scheduleCalendarMeeting(
    accessToken: string,
    params: ScheduleEventParams
  ): Promise<{ htmlLink: string; meetingUri: string }> {
    try {
      const { meetingUri } = await this.createInstantMeeting(accessToken);

      const body = {
        summary: params.title,
        description: `Scheduled via Open Plan AI Google Meet Integration\n\nJoin: ${meetingUri}`,
        location: meetingUri,
        // startTime/endTime are already full UTC ISO strings (trailing "Z"),
        // which fully and unambiguously specify the instant on their own.
        // We deliberately omit `timeZone` here: Intl.DateTimeFormat().resolvedOptions().timeZone
        // can resolve to a legacy IANA alias on some OS/ICU combinations
        // (e.g. Windows reporting "Asia/Calcutta" instead of "Asia/Kolkata"),
        // which Google's Calendar API rejects outright with a generic,
        // field-less 400 "Bad Request". timeZone only matters for
        // interpreting ambiguous local times or recurring-event DST rules —
        // neither applies to a single one-off meeting with an explicit Z offset.
        //
        // Recurring events are the exception: Google requires `timeZone` on
        // `start`/`end` whenever `recurrence` is set — it needs a zone to
        // expand the RRULE into instances (400 "Missing time zone definition
        // for start time" otherwise). We pass the fixed IANA name "UTC"
        // rather than the resolved local zone, since startTime/endTime are
        // already normalized to UTC and "UTC" can't hit the legacy-alias
        // rejection above.
        start: {
          dateTime: params.startTime,
          ...(params.recurrence && params.recurrence.length > 0 ? { timeZone: 'UTC' } : {}),
        },
        end: {
          dateTime: params.endTime,
          ...(params.recurrence && params.recurrence.length > 0 ? { timeZone: 'UTC' } : {}),
        },
        ...(params.recurrence && params.recurrence.length > 0 ? { recurrence: params.recurrence } : {}),
        attendees: params.attendees.map((email) => ({ email })),
      };

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw await toGoogleApiError(response);
      }

      const data = await response.json();

      return {
        htmlLink: data.htmlLink, // Calendar event link
        meetingUri,             // The Google Meet link — guaranteed OPEN access
      };
    } catch (error) {
      logger.error('Failed to schedule calendar meeting:', error);
      throw error;
    }
  },
};
