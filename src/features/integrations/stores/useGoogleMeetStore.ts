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
  refreshTokenIfNeeded: () => Promise<boolean>;
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

      refreshTokenIfNeeded: async () => {
        const state = get();
        if (!state.isConnected) return false;
        if (!state.isTokenExpired()) return true;

        // Token is expired — trigger a new OAuth consent prompt via GIS.
        // The calling component should invoke the Google Identity Services
        // token client to re-authenticate. This store method returns false
        // to signal that a fresh token is needed.
        return false;
      },
    }),
    {
      name: 'google-meet-store',
      // sessionStorage, not localStorage — this holds a live Google OAuth
      // access token. Scoping it to the tab/session limits how long it sits
      // around if the machine is shared; it also expires in ~1hr regardless
      // (see isTokenExpired/refreshTokenIfNeeded), so nothing is lost by not
      // persisting it across browser restarts.
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
