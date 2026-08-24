import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { reconcilePushSubscription } from '@/services/pushNotifications.service';
import { logger } from '@/services/monitoring/logger';

/**
 * Mounted once near the app root (alongside ChatNotificationsProvider) so a
 * revoked/re-granted browser notification permission is caught on the next
 * app load rather than only when the user happens to open Settings.
 */
export function PushReconciliationProvider() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    reconcilePushSubscription().catch((error) => {
      logger.error('Push reconciliation failed:', error);
    });
  }, [user]);

  return null;
}
