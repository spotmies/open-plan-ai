import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { chatTransport } from '../transport';
import { useCallStore } from '../stores/useCallStore';
import { useChatStore } from '../stores/useChatStore';
import { meetWindow } from '../utils/meetWindow';
import { callWindow } from '../utils/callWindow';

/** Best-effort name lookup from whatever conversation data is already cached. */
function resolveMemberName(conversationId: string, userId: string): string {
  const conversation = useChatStore.getState().conversations.find((c) => c.id === conversationId);
  return conversation?.members.find((m) => m.id === userId)?.name ?? '';
}

/**
 * Mounted once near the app root (alongside ChatNotificationsProvider) so an
 * incoming call rings no matter what page the user is on — not just while
 * the Chat page happens to be open. Translates real Socket.IO call events
 * into useCallStore updates and opens/closes the actual Google Meet tab.
 */
export function useCallSignaling() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const unsubIncoming = chatTransport.subscribeToIncomingCalls((event) => {
      const store = useCallStore.getState();
      // Already on a call — silently ignore for now (no "busy" signal yet).
      if (store.callState !== 'idle') return;

      store.receiveIncomingCall({
        callId: event.callId,
        conversationId: event.conversationId,
        callType: event.callType,
        meetingUri: event.meetingUri,
        callerId: event.fromUserId,
        callerName: event.fromUserName,
        participants: event.participantIds
          .filter((id) => id !== event.fromUserId)
          .map((id) => ({ id, name: resolveMemberName(event.conversationId, id), connected: true })),
        isGroup: event.participantIds.length > 1,
      });
    });

    const unsubAccepted = chatTransport.subscribeToCallAccepted(({ callId, byUserName }) => {
      const store = useCallStore.getState();
      if (store.callId !== callId || store.callState === 'idle') return;

      if (store.callState !== 'active') {
        store.markActive();
        if (store.meetingUri) {
          meetWindow.navigateOrOpen(store.meetingUri);
        }
      }
      toast.success(`${byUserName || 'They'} joined the call`);
    });

    const unsubDeclined = chatTransport.subscribeToCallDeclined(({ callId, byUserName }) => {
      const store = useCallStore.getState();
      if (store.callId !== callId) return;

      // In a group call that's already active, one more decline doesn't end it.
      if (store.callState === 'active') {
        toast.info(`${byUserName || 'Someone'} declined`);
        return;
      }
      toast.info(`${byUserName || 'They'} declined the call`);
      meetWindow.close();
      callWindow.close();
      store.reset();
    });

    const unsubEnded = chatTransport.subscribeToCallEnded(({ callId }) => {
      const store = useCallStore.getState();
      if (store.callId !== callId) return;

      meetWindow.close();
      callWindow.close();
      store.reset();
    });

    return () => {
      chatTransport.unsubscribe(unsubIncoming);
      chatTransport.unsubscribe(unsubAccepted);
      chatTransport.unsubscribe(unsubDeclined);
      chatTransport.unsubscribe(unsubEnded);
      meetWindow.close();
      callWindow.close();
    };
  }, [user?.id]);
}
