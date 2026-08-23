import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  notificationsService,
  Notification,
  NotificationListParams,
  NotificationPaginationMeta,
} from '@/services/notifications.service';
import { formatDistanceToNow } from 'date-fns';
import { chatTransport } from '@/features/chat/transport';
import { messagePreviewText } from '@/features/chat/chat.mappers';

export interface AppNotification extends Notification {
  read: boolean;
  description: string | null;
  time: string;
  initials: string;
}

export function useNotifications(params: NotificationListParams & { includeStats?: boolean } = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const { page = 1, limit = 10, unreadOnly, type, includeStats = false } = params;

  const { data: listResult, isLoading, isFetching, error } = useQuery({
    queryKey: ['notifications', userId, page, limit, unreadOnly, type],
    queryFn: () => notificationsService.getAll({ page, limit, unreadOnly, type }),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-count', userId],
    queryFn: () => notificationsService.getUnreadCount(),
    enabled: !!userId,
  });

  const { data: stats } = useQuery({
    queryKey: ['notifications-stats', userId],
    queryFn: () => notificationsService.getStats(),
    enabled: !!userId && includeStats,
  });

  // Real-time: invalidate when a new notification arrives via socket
  useEffect(() => {
    if (!userId) return;
    const socket = (chatTransport as any).socket;
    if (!socket) return;

    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count', userId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-stats', userId] });
    };

    socket.on('notification:created', handler);
    return () => { socket.off('notification:created', handler); };
  }, [userId, queryClient]);

  const rawNotifications = listResult?.data ?? [];
  const meta: NotificationPaginationMeta | undefined = listResult?.meta;

  const notifications: AppNotification[] = rawNotifications.map((n: Notification) => ({
    ...n,
    read: n.readAt !== null,
    description: n.content ? messagePreviewText(n.content) : n.content,
    time: formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }),
    initials: (() => {
      const words = (n.title || '').trim().split(/\s+/);
      if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
      return words[0]?.substring(0, 2).toUpperCase() || '??';
    })(),
  }));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    queryClient.invalidateQueries({ queryKey: ['notifications-count', userId] });
    queryClient.invalidateQueries({ queryKey: ['notifications-stats', userId] });
  };

  const markAsRead = useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: invalidate,
  });

  const markAllAsRead = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: invalidate,
  });

  const deleteNotification = useMutation({
    mutationFn: (id: string) => notificationsService.delete(id),
    onSuccess: invalidate,
  });

  const clearReadNotifications = useMutation({
    mutationFn: () => notificationsService.clearRead(),
    onSuccess: invalidate,
  });

  return {
    notifications,
    meta,
    unreadCount,
    stats,
    isLoading,
    isFetching,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearReadNotifications,
  };
}
