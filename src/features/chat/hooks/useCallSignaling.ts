import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { chatTransport } from '../transport';
import { useCallStore } from '../stores/useCallStore';
import { useChatStore } from '../stores/useChatStore';
import { meetWindow } from '../utils/meetWindow';
import { finalizeCallCard, markCallCardActive } from '../utils/callCardRegistry';

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

    const unsubAccepted = chatTransport.subscribeToCallAccepted(({ callId, byUserId, byUserName }) => {
      const store = useCallStore.getState();
      if (store.callId !== callId || store.callState === 'idle') return;

      // I accepted this same call from another tab/browser — that tab has
      // already opened the Meet window, so this one just needs to stop
      // ringing, not join a second time.
      if (byUserId === user?.id) {
        if (store.callState === 'incoming') {
          meetWindow.close();
          store.reset();
        }
        return;
      }

      // The server fans this out to every other conversation member, not just
      // the caller — in a group ring, a fellow invitee who's still being rung
      // must keep ringing independently. Someone else accepting doesn't
      // answer the call on their behalf; only their own accept/decline/
      // timeout should. Only the original caller ('outgoing') or a party
      // that's already 'active' reacts here.
      if (store.callState === 'incoming') return;

      if (store.callState !== 'active') {
        store.markActive();
        markCallCardActive(callId);
        if (store.meetingUri) {
          const meetingUri = store.meetingUri;
          // This runs off an async socket event, not a click, so the browser
          // is free to block window.open() here. If it does, the toast
          // action button below is a real click, so routing the same open
          // through it always succeeds.
          const opened = meetWindow.navigateOrOpen(meetingUri);
          if (!opened) {
            toast.error('Your browser blocked the Google Meet tab.', {
              action: { label: 'Open Meet', onClick: () => meetWindow.navigateOrOpen(meetingUri) },
            });
          }
        }
      }
      toast.success(`${byUserName || 'They'} joined the call`);
    });

    const unsubDeclined = chatTransport.subscribeToCallDeclined(({ callId, byUserId, byUserName }) => {
      const store = useCallStore.getState();
      if (store.callId !== callId) return;

      // I declined this same call from another tab/browser — dismiss the
      // ring here too instead of waiting for it to time out.
      if (byUserId === user?.id) {
        if (store.callState === 'incoming') {
          meetWindow.close();
          store.reset();
        }
        return;
      }

      // Same reasoning as call:accepted above — one recipient declining a
      // group call must not cancel the ring for a fellow invitee who's still
      // being rung and hasn't made their own decision yet.
      if (store.callState === 'incoming') return;

      // Drop the decliner from the invite list — for whoever's watching
      // (the caller, or another already-active member) they're no longer
      // part of this call.
      const stillPending = store.participants.filter((p) => p.id !== byUserId);
      store.removeParticipant(byUserId);

      // In a group call that's already active, one more decline doesn't end it.
      if (store.callState === 'active') {
        toast.info(`${byUserName || 'Someone'} declined`);
        return;
      }

      // Still ringing (outgoing) — only give up once EVERY invitee has
      // declined. If someone else is still being rung, keep the call alive
      // for them instead of cancelling it out from under them.
      if (stillPending.length > 0) {
        toast.info(`${byUserName || 'Someone'} declined`);
        return;
      }

      toast.info(`${byUserName || 'They'} declined the call`);
      meetWindow.close();
      finalizeCallCard(callId);
      store.reset();
    });

    const unsubEnded = chatTransport.subscribeToCallEnded(({ callId }) => {
      // Finalize off the registry regardless of local store state — in a
      // group call, the initiator (who holds the registry entry) may have
      // left long before this "everyone's gone" signal arrives.
      finalizeCallCard(callId);

      const store = useCallStore.getState();
      if (store.callId !== callId) return;

      meetWindow.close();
      store.reset();
    });

    // Only fires for a 3+ person group call that's still active for everyone
    // else — the server has already determined the call itself keeps going,
    // so just drop the one participant instead of tearing down the call.
    const unsubParticipantLeft = chatTransport.subscribeToCallParticipantLeft(({ callId, byUserId, byUserName }) => {
      const store = useCallStore.getState();
      if (store.callId !== callId) return;

      store.removeParticipant(byUserId);
      toast.info(`${byUserName || 'Someone'} left the call`);
    });

    return () => {
      chatTransport.unsubscribe(unsubIncoming);
      chatTransport.unsubscribe(unsubAccepted);
      chatTransport.unsubscribe(unsubDeclined);
      chatTransport.unsubscribe(unsubEnded);
      chatTransport.unsubscribe(unsubParticipantLeft);
      meetWindow.close();
    };
  }, [user?.id]);
}
