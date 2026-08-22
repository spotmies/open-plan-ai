import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import type { UserSettings } from '@/types';

export type NotificationPreferences = UserSettings['notifications'];

export const notificationPreferencesService = {
  async getPreferences(): Promise<NotificationPreferences> {
    return apiClient.get<NotificationPreferences>(ENDPOINTS.NOTIFICATIONS.PREFERENCES);
  },

  async updatePreferences(partial: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    return apiClient.patch<NotificationPreferences>(ENDPOINTS.NOTIFICATIONS.PREFERENCES, partial);
  },
};
