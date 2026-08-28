import { useEffect } from 'react';
import { toast } from 'sonner';
import { featureTogglesService } from '@/services/featureToggles.service';
import { useFeatureTogglesStore, type ToggleableFeature } from '@/stores/useFeatureTogglesStore';
import { logger } from '@/services/monitoring/logger';

/**
 * Fetches this user's server-persisted feature toggles once on login and
 * overwrites the local (localStorage-backed) store with them, so the same
 * account shows the same enabled features on every device — instead of each
 * browser silently keeping its own copy. Mount once near the app root,
 * gated on `isAuthenticated`.
 */
export function useHydrateFeatureToggles(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    featureTogglesService
      .getToggles()
      .then((toggles) => {
        if (!cancelled) useFeatureTogglesStore.getState().hydrate(toggles);
      })
      .catch((err) => logger.error('Failed to load feature toggles:', err));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);
}

/**
 * Persists a feature toggle change to the backend, updating the local store
 * optimistically and rolling back if the request fails.
 */
export function useSetFeatureToggle() {
  const setFeatureEnabled = useFeatureTogglesStore((s) => s.setFeatureEnabled);

  return async (feature: ToggleableFeature, enabled: boolean) => {
    const previous = useFeatureTogglesStore.getState().enabled[feature];
    setFeatureEnabled(feature, enabled);
    try {
      await featureTogglesService.setToggle(feature, enabled);
    } catch (err) {
      setFeatureEnabled(feature, previous);
      toast.error('Failed to save preference', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };
}
