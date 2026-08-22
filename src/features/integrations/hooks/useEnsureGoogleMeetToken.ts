import { useCallback } from 'react';
import { useGoogleMeetStore } from '../stores/useGoogleMeetStore';
import { googleMeetService } from '@/services/googleMeet.service';

/**
 * The backend stores a permanent (encrypted) refresh token once the user
 * connects via the OAuth redirect flow in Integrations.tsx, and mints a
 * fresh short-lived access token from it on demand. Call ensureFreshToken()
 * right before any Meet/Calendar API call — it reuses the cached token if
 * still valid, otherwise fetches a new one from our backend. No Google popup
 * is ever involved here: if this returns null, the user genuinely never
 * connected (or disconnected), not just "the token happened to expire".
 */
export function useEnsureGoogleMeetToken() {
  const ensureFreshToken = useCallback(async (): Promise<string | null> => {
    const store = useGoogleMeetStore.getState();
    if (store.accessToken && !store.isTokenExpired()) return store.accessToken;

    try {
      const { accessToken, expiresIn, email } = await googleMeetService.getAccessToken();
      store.setConnected(accessToken, email, expiresIn);
      return accessToken;
    } catch {
      // Not connected, or the stored connection is no longer valid — the
      // backend already cleaned up its side; reflect that locally too.
      store.disconnect();
      return null;
    }
  }, []);

  return { ensureFreshToken };
}
