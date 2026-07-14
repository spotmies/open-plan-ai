import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
}

export interface NotificationPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface NotificationStats {
  total: number;
  unread: number;
  issues: number;
  tasks: number;
}

export const notificationsService = {
  async getAll(params: NotificationListParams = {}): Promise<{ data: Notification[]; meta: NotificationPaginationMeta }> {
    const res = await apiClient.raw.get(ENDPOINTS.NOTIFICATIONS.LIST, { params });
    return { data: res.data.data, meta: res.data.meta };
  },

  async getStats(): Promise<NotificationStats> {
    return apiClient.get<NotificationStats>(ENDPOINTS.NOTIFICATIONS.STATS);
  },

  async getUnreadCount(): Promise<number> {
    const result = await apiClient.get<{ count: number }>(ENDPOINTS.NOTIFICATIONS.COUNT);
    return result.count;
  },

  async markAsRead(id: string): Promise<void> {
    await apiClient.patch(ENDPOINTS.NOTIFICATIONS.READ(id), {});
  },

  async markAllAsRead(): Promise<void> {
    await apiClient.patch(ENDPOINTS.NOTIFICATIONS.READ_ALL, {});
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.NOTIFICATIONS.DELETE(id));
  },

  async clearRead(): Promise<void> {
    await apiClient.delete(ENDPOINTS.NOTIFICATIONS.CLEAR_READ);
  },
};
