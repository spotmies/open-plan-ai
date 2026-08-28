import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// App sections that are opt-in via the Integrations page ("Features" cards)
// rather than always-on. A feature's UI (sidebar entry, toolbar button, etc.)
// only shows up once the user has enabled it here.
export type ToggleableFeature = 'my-tasks' | 'calendar' | 'reports' | 'inventory' | 'support';

interface FeatureTogglesState {
  enabled: Record<ToggleableFeature, boolean>;
  setFeatureEnabled: (feature: ToggleableFeature, enabled: boolean) => void;
}

export const useFeatureTogglesStore = create<FeatureTogglesState>()(
  persist(
    (set) => ({
      enabled: {
        'my-tasks': false,
        calendar: false,
        reports: false,
        inventory: false,
        support: false,
      },
      setFeatureEnabled: (feature, enabled) =>
        set((state) => ({
          enabled: { ...state.enabled, [feature]: enabled },
        })),
    }),
    {
      name: 'feature-toggles-store',
    }
  )
);
