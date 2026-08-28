import { useAuth } from '@/contexts/AuthContext';
import { useHydrateFeatureToggles } from '@/hooks/useFeatureToggles';

/**
 * Mounted once near the app root (alongside PushReconciliationProvider) so the
 * server's copy of this user's feature toggles overwrites whatever this
 * browser's localStorage happens to hold — otherwise the same account can
 * show different enabled features on different devices.
 */
export function FeatureTogglesHydrationProvider() {
  const { isAuthenticated } = useAuth();
  useHydrateFeatureToggles(isAuthenticated);
  return null;
}
