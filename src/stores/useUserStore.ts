import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserSettings } from '@/types';

// Auth state (user identity, isAuthenticated) lives exclusively in AuthContext.
// This store owns only UI preferences and sidebar state.
interface UserState {
  preferences: UserSettings;
  updatePreferences: (prefs: Partial<UserSettings>) => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const defaultPreferences: UserSettings = {
  theme: 'system',
  sidebarCollapsed: true,
  compactMode: false,
  notifications: {
    taskAssignments: true,
    taskCompletions: true,
    comments: true,
    projectUpdates: true,
    milestoneReminders: true,
    emailDigest: 'daily',
  },
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      sidebarOpen: false,

      updatePreferences: (prefs) => set((state) => ({
        preferences: {
          ...state.preferences,
          ...prefs,
          notifications: {
            ...state.preferences.notifications,
            ...(prefs.notifications || {}),
          },
        },
      })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'user-store',
      partialize: (state) => ({
        preferences: state.preferences,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
