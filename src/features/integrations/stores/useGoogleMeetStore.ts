import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface GoogleMeetState {
  isConnected: boolean;
  accessToken: string | null;
  userEmail: string | null;
  tokenExpiresAt: number | null;

  setConnected: (token: string, email: string, expiresIn: number) => void;
  disconnect: () => void;
  isTokenExpired: () => boolean;
}

export const useGoogleMeetStore = create<GoogleMeetState>()(
  persist(
    (set, get) => ({
      isConnected: false,
      accessToken: null,
      userEmail: null,
      tokenExpiresAt: null,

      setConnected: (token, email, expiresIn) =>
        set({
          isConnected: true,
          accessToken: token,
          userEmail: email,
          tokenExpiresAt: Date.now() + expiresIn * 1000,
        }),

      disconnect: () =>
        set({
          isConnected: false,
          accessToken: null,
          userEmail: null,
          tokenExpiresAt: null,
        }),

      isTokenExpired: () => {
        const { tokenExpiresAt } = get();
        if (!tokenExpiresAt) return true;
        // Consider expired 60s before actual expiry to avoid race conditions
        return Date.now() >= tokenExpiresAt - 60_000;
      },
    }),
    {
      name: 'google-meet-store',
      // sessionStorage, not localStorage — this holds a live Google OAuth
      // access token. Scoping it to the tab/session limits how long it sits
      // around if the machine is shared. Losing it on browser restart is no
      // longer a problem the way it was under the old GIS flow: the backend
      // holds a permanent refresh token, so useEnsureGoogleMeetToken just
      // silently fetches a new access token from our API — no popup, no
      // reconnect prompt (see isTokenExpired).
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        isConnected: state.isConnected,
        accessToken: state.accessToken,
        userEmail: state.userEmail,
        tokenExpiresAt: state.tokenExpiresAt,
      }),
    }
  )
);
