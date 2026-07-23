import { apiClient } from './api/client';
import { ENDPOINTS } from './api/endpoints';
import { logger } from './monitoring/logger';
import { config } from '@/config';

export interface ScheduleEventParams {
  title: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  attendees: string[]; // List of emails
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
   */
  getConnectUrl(): string {
    const base = config.api.baseUrl.replace(/\/$/, '');
    return `${base}${ENDPOINTS.GOOGLE_MEET.CONNECT}`;
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
   * Schedules a Calendar Event with a Google Meet conference link attached.
   * POST https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1
   */
  async scheduleCalendarMeeting(
    accessToken: string,
    params: ScheduleEventParams
  ): Promise<{ htmlLink: string; meetingUri: string }> {
    try {
      const requestId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      const body = {
        summary: params.title,
        description: 'Scheduled via Open Plan AI Google Meet Integration',
        // startTime/endTime are already full UTC ISO strings (trailing "Z"),
        // which fully and unambiguously specify the instant on their own.
        // We deliberately omit `timeZone` here: Intl.DateTimeFormat().resolvedOptions().timeZone
        // can resolve to a legacy IANA alias on some OS/ICU combinations
        // (e.g. Windows reporting "Asia/Calcutta" instead of "Asia/Kolkata"),
        // which Google's Calendar API rejects outright with a generic,
        // field-less 400 "Bad Request". timeZone only matters for
        // interpreting ambiguous local times or recurring-event DST rules —
        // neither applies to a single one-off meeting with an explicit Z offset.
        start: {
          dateTime: params.startTime,
        },
        end: {
          dateTime: params.endTime,
        },
        attendees: params.attendees.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: {
              type: 'hangoutsMeet', // Automatically creates a Google Meet link
            },
          },
        },
      };

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
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
      
      // Extract the Meet link from conferenceData entry
      const entry = data.conferenceData?.entryPoints?.find(
        (ep: any) => ep.entryPointType === 'video'
      );
      const meetingUri = entry?.uri || data.hangoutLink || '';

      return {
        htmlLink: data.htmlLink, // Calendar event link
        meetingUri,             // The Google Meet link
      };
    } catch (error) {
      logger.error('Failed to schedule calendar meeting:', error);
      throw error;
    }
  },
};
