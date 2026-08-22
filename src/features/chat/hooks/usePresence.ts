import { useEffect } from 'react';
import { chatTransport } from '../transport';
import { useChatStore } from '../stores/useChatStore';

export function usePresence(currentUserId: string | undefined) {
  const setOnlineUserIds = useChatStore((s) => s.setOnlineUserIds);

  useEffect(() => {
    if (!currentUserId) return;

    const transport = chatTransport as any;
    const socket = transport?.socket;
    if (!socket) return;

    const handleOnlineUsers = ({ userIds }: { userIds: string[] }) => {
      setOnlineUserIds(new Set([...userIds, currentUserId]));
    };

    const handleUserOnline = ({ userId }: { userId: string }) => {
      const current = useChatStore.getState().onlineUserIds;
      setOnlineUserIds(new Set([...current, userId]));
    };

    const handleUserOffline = ({ userId }: { userId: string }) => {
      const current = useChatStore.getState().onlineUserIds;
      const next = new Set(current);
      next.delete(userId);
      setOnlineUserIds(next);
    };

    const requestOnlineUsers = () => {
      socket.emit('get-online-users');
    };

    socket.on('online-users', handleOnlineUsers);
    socket.on('user-online', handleUserOnline);
    socket.on('user-offline', handleUserOffline);
    // Re-request the full list whenever the socket (re)connects
    socket.on('connect', requestOnlineUsers);

    // Request immediately — if socket is already connected this fires the event;
    // if it's still connecting, the 'connect' listener above handles it.
    if (socket.connected) {
      requestOnlineUsers();
    }

    // Fallback: re-request after 2 s in case the initial online-users event
    // fired before our listener was registered (common on fast connections).
    const fallbackTimer = setTimeout(() => {
      if (socket.connected) requestOnlineUsers();
    }, 2000);

    // Periodic resync: a missed user-online/user-offline broadcast (brief
    // reconnect blip, event firing before the listener attached, etc.) would
    // otherwise leave this tab's presence state stale until its own socket
    // happens to reconnect. Polling self-heals that without waiting on it.
    const resyncInterval = setInterval(() => {
      if (socket.connected) requestOnlineUsers();
    }, 20000);

    // Always include self
    const current = useChatStore.getState().onlineUserIds;
    setOnlineUserIds(new Set([...current, currentUserId]));

    return () => {
      clearTimeout(fallbackTimer);
      clearInterval(resyncInterval);
      socket.off('online-users', handleOnlineUsers);
      socket.off('user-online', handleUserOnline);
      socket.off('user-offline', handleUserOffline);
      socket.off('connect', requestOnlineUsers);
    };
  }, [currentUserId, setOnlineUserIds]);
}
