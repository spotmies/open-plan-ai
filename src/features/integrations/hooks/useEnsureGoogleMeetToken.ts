import { useCallback } from 'react';
import { useGoogleMeetStore } from '../stores/useGoogleMeetStore';
import { useGoogleIdentityServices } from './useGoogleIdentityServices';

const SCOPES =
  'https://www.googleapis.com/auth/meetings.space.created https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email';

/**
 * GIS access tokens expire after ~1hr with no refresh token — that lifetime
 * is fixed by Google's OAuth server and can't be extended from our side.
 * Without this, useGoogleMeetStore.isConnected stays true forever while the
 * token silently goes dead, and every Meet/Calendar call starts failing with
 * a confusing 401. Call ensureFreshToken() right before any such call — it
 * reuses the current token if still valid, otherwise attempts a silent (no
 * popup) re-issue since the user already granted consent once.
 */
export function useEnsureGoogleMeetToken() {
  const { isLoaded: gisLoaded } = useGoogleIdentityServices();

  const requestToken = useCallback(
    (clientId: string, prompt: '' | 'consent'): Promise<string | null> => {
      const store = useGoogleMeetStore.getState();
      return new Promise<string | null>((resolve) => {
        try {
          const client = window.google!.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPES,
            callback: (tokenResponse: { error?: string; access_token?: string; expires_in?: number }) => {
              if (tokenResponse.error || !tokenResponse.access_token) {
                resolve(null);
                return;
              }
              store.setConnected(tokenResponse.access_token, store.userEmail ?? '', tokenResponse.expires_in ?? 3600);
              resolve(tokenResponse.access_token);
            },
            error_callback: () => resolve(null),
          });
          client.requestAccessToken({ prompt });
        } catch {
          resolve(null);
        }
      });
    },
    [],
  );

  const ensureFreshToken = useCallback(async (): Promise<string | null> => {
    const store = useGoogleMeetStore.getState();
    if (!store.isConnected) return null;
    if (store.accessToken && !store.isTokenExpired()) return store.accessToken;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !gisLoaded || !window.google?.accounts?.oauth2) return null;

    // Try a silent (no popup) re-issue first — this is the common case and
    // needs no user interaction. Browsers with strict third-party-cookie /
    // FedCM policies can make this fail even though consent was already
    // granted, so fall back to a one-click popup rather than dead-ending
    // into "please reconnect in Integrations". Since scopes were already
    // granted, Google shows an account-picker, not a full consent screen.
    // This fallback only runs from a direct click-handler continuation, so
    // it still counts as user-activated and isn't blocked as a popup.
    const silentToken = await requestToken(clientId, '');
    if (silentToken) return silentToken;

    return requestToken(clientId, 'consent');
  }, [gisLoaded, requestToken]);

  return { ensureFreshToken };
}
