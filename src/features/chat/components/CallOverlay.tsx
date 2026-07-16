import { useEffect, useMemo, useRef, useState } from 'react';
import { useCallStore } from '../stores/useCallStore';
import { chatTransport } from '../transport';
import { chatService } from '@/services/chat.service';
import { googleMeetService } from '@/services/googleMeet.service';
import { useEnsureGoogleMeetToken } from '@/features/integrations/hooks/useEnsureGoogleMeetToken';
import { meetWindow } from '../utils/meetWindow';
import { callWindow } from '../utils/callWindow';
import { onCallStatusMessage, postCallStatusState, type CallStatusSnapshot } from '../utils/callStatusChannel';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { toast } from 'sonner';

const RING_TIMEOUT_MS = 45_000;

function getInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return words[0]?.charAt(0).toUpperCase() || '??';
}

export function CallOverlay() {
  const {
    callState,
    callType,
    callId,
    conversationId,
    meetingUri,
    participants,
    callerName,
    callDuration,
    markActive,
    reset,
    incrementDuration,
  } = useCallStore();

  const { ensureFreshToken } = useEnsureGoogleMeetToken();
  const [generatingLink, setGeneratingLink] = useState(false);
  const timerRef = useRef<number | null>(null);
  const ringTimeoutRef = useRef<number | null>(null);

  const reachable = participants.filter((p) => p.connected);
  const unreachable = participants.filter((p) => !p.connected);
  const primaryName = callerName || reachable[0]?.name || participants[0]?.name || 'them';
  const isGroupRing = reachable.length > 1;
  const showUnreachablePanel = callState === 'outgoing' && reachable.length === 0;

  const statusSnapshot: CallStatusSnapshot = useMemo(
    () => ({
      callState,
      callType,
      primaryName,
      isGroupRing,
      reachableCount: reachable.length,
      unreachableNames: unreachable.map((p) => p.name || 'Someone'),
      meetingUri,
      callDuration,
      showUnreachablePanel,
      generatingLink,
    }),
    [callState, callType, primaryName, isGroupRing, participants, meetingUri, callDuration, showUnreachablePanel, generatingLink],
  );
  const statusSnapshotRef = useRef(statusSnapshot);
  statusSnapshotRef.current = statusSnapshot;
  const handlersRef = useRef<{
    handleEnd: () => void;
    handleReopenMeet: () => void;
    handleSendLink: () => void;
    reset: () => void;
  } | null>(null);

  // Call duration timer (active) and a manual-close watchdog (outgoing +
  // active). Also polls whether the user closed the actual Meet tab or the
  // status tab — the only signal we can read cross-window — and ends the
  // call in-app (and for the other party, via the socket relay) when it
  // happens, so nothing runs forever with no way to hang up.
  useEffect(() => {
    if (callState === 'active' || callState === 'outgoing') {
      timerRef.current = window.setInterval(() => {
        if (callState === 'active') incrementDuration();
        if ((callState === 'active' && meetWindow.isClosed()) || callWindow.isClosed()) {
          handleEnd();
        }
      }, 1000) as unknown as number;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [callState, incrementDuration]);

  // Ring timeout — an outgoing/incoming call that's never answered shouldn't
  // ring forever. Each side times out independently (no cross-messaging).
  useEffect(() => {
    if (callState === 'outgoing' || callState === 'incoming') {
      ringTimeoutRef.current = window.setTimeout(() => {
        if (callState === 'outgoing' && callId && conversationId) {
          chatTransport.emitCallEnd({ callId, conversationId });
          meetWindow.close();
        }
        callWindow.close();
        toast.info(callState === 'outgoing' ? 'No answer' : 'Missed call');
        reset();
      }, RING_TIMEOUT_MS) as unknown as number;
    }
    return () => {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
    };
  }, [callState, callId, conversationId, reset]);

  // Broadcasts the current call status to the standalone status tab
  // (CallStatusWindow) every time anything it renders changes.
  useEffect(() => {
    postCallStatusState(statusSnapshot);
  }, [statusSnapshot]);

  // The status tab has no socket connection or store of its own — it just
  // displays whatever we last broadcast and forwards button clicks back as
  // commands. Subscribed once; reads the latest handlers/snapshot via refs
  // so it isn't torn down and recreated on every render (e.g. every second
  // while the duration timer ticks).
  useEffect(() => {
    return onCallStatusMessage((message) => {
      if (message.type === 'request-state') {
        postCallStatusState(statusSnapshotRef.current);
        return;
      }
      if (message.type !== 'command') return;
      const handlers = handlersRef.current;
      if (!handlers) return;
      if (message.action === 'end') handlers.handleEnd();
      else if (message.action === 'reopen-meet') handlers.handleReopenMeet();
      else if (message.action === 'send-link') handlers.handleSendLink();
      else if (message.action === 'close') handlers.reset();
    });
  }, []);

  const handleAccept = () => {
    if (!callId || !conversationId) return;
    // Opened synchronously inside this click handler — same reasoning as
    // meetWindow.openPlaceholder(): a window opened later from an async
    // callback would be blocked by the browser's popup blocker.
    callWindow.open();
    chatTransport.emitCallAccept({ callId, conversationId });
    markActive();
    if (meetingUri) {
      meetWindow.navigateOrOpen(meetingUri);
    }
  };

  const handleDecline = () => {
    if (callId && conversationId) {
      chatTransport.emitCallDecline({ callId, conversationId });
    }
    reset();
  };

  const handleEnd = () => {
    if (callId && conversationId) {
      chatTransport.emitCallEnd({ callId, conversationId });
    }
    meetWindow.close();
    callWindow.close();
    reset();
  };

  const handleReopenMeet = () => {
    if (!meetingUri) return;
    meetWindow.navigateOrOpen(meetingUri);
  };

  const handleSendLink = async () => {
    if (!conversationId) return;
    setGeneratingLink(true);
    try {
      let uri = meetingUri;
      if (!uri) {
        const token = await ensureFreshToken();
        if (!token) {
          toast.error('Reconnect Google Meet in Integrations, then try again.');
          return;
        }
        const meetData = await googleMeetService.createInstantMeeting(token);
        uri = meetData.meetingUri;
      }
      await chatService.sendMessage(conversationId, `I created a Google Meet call. Let's connect here: ${uri}`);
      toast.success('Google Meet link sent to chat!');
      callWindow.close();
      reset();
    } catch {
      toast.error('Failed to create or send the Google Meet link.');
    } finally {
      setGeneratingLink(false);
    }
  };

  handlersRef.current = { handleEnd, handleReopenMeet, handleSendLink, reset };

  if (callState === 'idle') return null;

  // Incoming calls get a compact, resizable notification card in the
  // corner instead of covering the screen — the user shouldn't lose
  // whatever they were doing just because a call came in. Accepting
  // hands off to the full-screen branch below via markActive().
  if (callState === 'incoming') {
    const groupLabel = isGroupRing
      ? `${primaryName} + ${reachable.length - 1} other${reachable.length > 2 ? 's' : ''}`
      : primaryName;

    return (
      <div
        className="fixed bottom-6 right-6 z-50 flex w-[380px] h-[260px] min-w-[300px] min-h-[220px] max-w-[520px] max-h-[80vh] resize flex-col gap-3 overflow-auto rounded-2xl border border-border bg-background p-4 shadow-2xl select-none animate-in slide-in-from-bottom-4 fade-in duration-300"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span>Google Meet Calling</span>
        </div>

        <div className="flex flex-1 items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 rounded-full overflow-hidden border-2 border-primary/20 bg-muted shadow-md flex items-center justify-center">
            <Avatar className="h-full w-full rounded-none">
              <AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-primary/10 to-primary/20 text-primary">
                {getInitials(primaryName)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full border-2 border-primary/60 animate-ping opacity-25 pointer-events-none" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">{groupLabel}</h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {callType === 'video' ? (
                <Video className="h-3 w-3 shrink-0 text-primary" />
              ) : (
                <Phone className="h-3 w-3 shrink-0 text-primary" />
              )}
              <span className="truncate">'{primaryName}' is trying to connect with you</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            size="icon"
            variant="destructive"
            className="h-10 w-10 rounded-full shadow hover:scale-105 transition-all"
            onClick={handleDecline}
            title="Decline"
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="h-10 w-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow hover:scale-105 transition-all"
            onClick={handleAccept}
            title="Accept"
          >
            <Phone className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Outgoing/active status now lives in a standalone tab (CallStatusWindow),
  // opened via callWindow.open() and kept in sync over BroadcastChannel —
  // see the effects above. This tab no longer blocks the whole page.
  return null;
}
