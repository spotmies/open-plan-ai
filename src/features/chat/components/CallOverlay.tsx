import { useEffect, useRef, useState } from 'react';
import { useCallStore } from '../stores/useCallStore';
import { chatTransport } from '../transport';
import { chatService } from '@/services/chat.service';
import { googleMeetService } from '@/services/googleMeet.service';
import { useEnsureGoogleMeetToken } from '@/features/integrations/hooks/useEnsureGoogleMeetToken';
import { meetWindow } from '../utils/meetWindow';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Phone, PhoneOff, Video, ExternalLink, Send, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { finalizeCallCard } from '../utils/callCardRegistry';
import { playRingtone, stopRingtone } from '@/lib/ringtone';

const RING_TIMEOUT_MS = 45_000;
const POSITION_STORAGE_KEY = 'call-overlay-position';
// How much of the card must stay on-screen at minimum, so the user can
// always grab it and drag it back even after pushing it mostly off-screen.
const MIN_VISIBLE = 48;

function getInitials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return words[0]?.charAt(0).toUpperCase() || '??';
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Lets the card be dragged anywhere in the viewport instead of staying
 * pinned to the bottom-right corner. Position persists in localStorage
 * (keyed, not per-call state) since the overlay unmounts entirely between
 * calls (`callState === 'idle'` returns null) and would otherwise forget
 * where the user left it.
 */
function useDraggablePosition(cardRef: React.RefObject<HTMLDivElement>) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = localStorage.getItem(POSITION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const dragOffset = useRef<{ x: number; y: number } | null>(null);

  const clamp = (x: number, y: number) => {
    const width = cardRef.current?.offsetWidth ?? 380;
    const height = cardRef.current?.offsetHeight ?? 240;
    // Allow the card to be dragged mostly off any edge, but never so far
    // that fewer than MIN_VISIBLE px of it remain reachable on-screen.
    const minX = MIN_VISIBLE - width;
    const maxX = window.innerWidth - MIN_VISIBLE;
    const minY = MIN_VISIBLE - height;
    const maxY = window.innerHeight - MIN_VISIBLE;
    return { x: Math.min(Math.max(x, minX), maxX), y: Math.min(Math.max(y, minY), maxY) };
  };

  // Re-clamp on resize so a position saved on a larger screen can't leave
  // the card stranded off-screen on a smaller one.
  useEffect(() => {
    const onResize = () => setPosition((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exposed so the card can re-clamp itself right after minimize/maximize —
  // those resize the element without a window resize event, so a card
  // dragged near an edge while minimized wouldn't otherwise get pulled back
  // on-screen once it grows back to full size.
  const reclamp = () => setPosition((p) => (p ? clamp(p.x, p.y) : p));

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffset.current) return;
    setPosition(clamp(e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y));
  };

  const handlePointerUp = () => {
    if (!dragOffset.current) return;
    dragOffset.current = null;
    setPosition((p) => {
      if (p) {
        try {
          localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(p));
        } catch {
          /* localStorage unavailable (private mode, quota) — position just won't persist */
        }
      }
      return p;
    });
  };

  return { position, handlePointerDown, handlePointerMove, handlePointerUp, reclamp };
}

/**
 * Renders every live call state (incoming/outgoing/active) as a single
 * resizable, draggable card in the same tab — nothing about call *status*
 * ever needs its own popup window. The only window this feature ever opens
 * is the actual Google Meet tab (see meetWindow.ts), and only ever one at a
 * time, always tied directly to a real click (accept, or initiating the
 * call) — some browsers (Edge, Brave) only honor a single window.open()
 * per user gesture, so a second "status" popup opened in the same click
 * would silently and inconsistently get blocked depending on the browser.
 */
export function CallOverlay() {
  const {
    callState,
    callType,
    callId,
    conversationId,
    meetingUri,
    isGroup,
    participants,
    callerName,
    callDuration,
    markActive,
    reset,
    syncDuration,
  } = useCallStore();

  const { ensureFreshToken } = useEnsureGoogleMeetToken();
  const [generatingLink, setGeneratingLink] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const timerRef = useRef<number | null>(null);
  const ringTimeoutRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { position, handlePointerDown, handlePointerMove, handlePointerUp, reclamp } = useDraggablePosition(cardRef);

  // Card shrinks/grows when toggling minimize — re-clamp so a card sitting
  // near a screen edge while minimized doesn't end up stranded off-screen
  // once it expands back to full size.
  useEffect(() => {
    reclamp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimized]);

  // Always start a fresh call maximized — minimizing is a per-call choice,
  // not something that should carry over to the next incoming/outgoing call.
  useEffect(() => {
    if (callState === 'idle') setMinimized(false);
  }, [callState]);

  const reachable = participants.filter((p) => p.connected);
  const unreachable = participants.filter((p) => !p.connected);
  const primaryName = callerName || reachable[0]?.name || participants[0]?.name || 'them';
  const isGroupRing = reachable.length > 1;
  const showUnreachablePanel = callState === 'outgoing' && reachable.length === 0;
  const groupLabel = isGroupRing
    ? `${primaryName} + ${reachable.length - 1} other${reachable.length > 2 ? 's' : ''}`
    : primaryName;

  // Call duration timer (active), plus a watchdog that ends the call
  // in-app (and for the other party, via the socket relay) if the user
  // closes the actual Meet tab — the only signal we can read for it.
  useEffect(() => {
    if (callState === 'active' || callState === 'outgoing') {
      timerRef.current = window.setInterval(() => {
        if (callState === 'active') syncDuration();
        if (callState === 'active' && meetWindow.isClosed()) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState, syncDuration]);

  // Ringtone — plays for both "trying to connect to" (outgoing) and "trying
  // to connect with you" (incoming). Keying directly off callState means it
  // stops the instant the state leaves outgoing/incoming for any reason:
  // answered (-> active), declined/cancelled/ended (-> idle via reset), or
  // the ring-timeout watchdog below firing (-> idle). Also stops for
  // showUnreachablePanel — the recipient never connected, so there's nobody
  // to ring.
  useEffect(() => {
    if ((callState === 'outgoing' || callState === 'incoming') && !showUnreachablePanel) {
      playRingtone();
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [callState, showUnreachablePanel]);

  // Ring timeout — an outgoing/incoming call that's never answered shouldn't
  // ring forever. Each side times out independently (no cross-messaging).
  useEffect(() => {
    if (callState === 'outgoing' || callState === 'incoming') {
      ringTimeoutRef.current = window.setTimeout(() => {
        if (callState === 'outgoing' && callId && conversationId) {
          chatTransport.emitCallEnd({ callId, conversationId });
          meetWindow.close();
          // Reaching here means nobody in the call ever answered — the whole
          // call attempt is over, so the card finalizes as "missed" regardless
          // of group size (callState only leaves 'outgoing' once someone joins).
          finalizeCallCard(callId);
        }
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

  const handleAccept = () => {
    if (!callId || !conversationId) return;
    // The ONLY popup opened for this gesture — it must be the essential one
    // (the actual meeting), not a secondary status window, since some
    // browsers only honor a single window.open() per click.
    if (meetingUri) {
      meetWindow.navigateOrOpen(meetingUri);
    }
    chatTransport.emitCallAccept({ callId, conversationId });
    markActive();
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
      // Finalize immediately unless this is an already-active group call —
      // there, one person hanging up doesn't mean everyone's done, so the
      // card only finalizes once the 'call:ended' broadcast confirms the last
      // participant has left (see useCallSignaling). In every other case
      // (a DM, or cancelling a group call nobody has joined yet) hanging up
      // unambiguously ends the whole call attempt right now.
      if (!isGroup || callState !== 'active') finalizeCallCard(callId);
    }
    meetWindow.close();
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
      reset();
    } catch {
      toast.error('Failed to create or send the Google Meet link.');
    } finally {
      setGeneratingLink(false);
    }
  };

  if (callState === 'idle') return null;

  return (
    <div
      ref={cardRef}
      className={cn(
        'fixed z-50 select-none animate-in fade-in duration-300 border border-border bg-background shadow-2xl',
        minimized
          ? 'flex w-auto max-w-[300px] items-center gap-2 rounded-full p-2'
          : 'flex w-[380px] min-w-[300px] max-w-[520px] max-h-[80vh] min-h-[240px] resize flex-col gap-3 overflow-auto rounded-2xl p-4',
        position ? '' : 'bottom-6 right-6 slide-in-from-bottom-4',
      )}
      style={position ? { top: position.y, left: position.x } : undefined}
    >
      {minimized ? (
        <>
          <div
            className="flex flex-1 min-w-0 items-center gap-2 cursor-move touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            title="Drag to move"
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/10 to-primary/20 text-primary">
                {getInitials(primaryName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground leading-tight">{groupLabel}</p>
              <p className="truncate text-[10px] text-muted-foreground leading-tight">
                {callState === 'incoming' && "Incoming call"}
                {callState === 'outgoing' && (showUnreachablePanel ? 'Not connected' : 'Calling…')}
                {callState === 'active' && formatTime(callDuration)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {callState === 'incoming' && (
              <>
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8 rounded-full"
                  onClick={handleDecline}
                  title="Decline"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={handleAccept}
                  title="Accept"
                >
                  <Phone className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {callState === 'outgoing' &&
              (showUnreachablePanel ? (
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full border-border"
                  onClick={reset}
                  title="Close"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8 rounded-full"
                  onClick={handleEnd}
                  title="Cancel call"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                </Button>
              ))}
            {callState === 'active' && (
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8 rounded-full"
                onClick={handleEnd}
                title="Hang up"
              >
                <PhoneOff className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setMinimized(false)}
              title="Maximize"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      ) : (
        <>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div
            className="flex min-w-0 flex-1 items-center gap-2 cursor-move touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            title="Drag to move"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
            <span className="truncate">Google Meet Calling</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {callState === 'active' && (
              <span className="font-mono text-foreground font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                {formatTime(callDuration)}
              </span>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setMinimized(true)}
              title="Minimize"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {showUnreachablePanel ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center py-2">
            <div className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center text-destructive">
              <PhoneOff className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1 text-sm">
                {unreachable.length > 1 ? 'No one is reachable' : 'Recipient Not Connected'}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Invalid call as {unreachable.map((p) => p.name || 'Someone').join(', ') || 'they'} hasn't connected to
                the Google Meet integration. Please send them a link instead.
              </p>
            </div>
            <div className="flex gap-2 w-full mt-1">
              <Button variant="outline" className="flex-1 border-border" onClick={reset} disabled={generatingLink}>
                Close
              </Button>
              <Button variant="default" className="flex-1 gap-2" onClick={handleSendLink} disabled={generatingLink}>
                {generatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Link
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 rounded-full overflow-hidden border-2 border-primary/20 bg-muted shadow-md flex items-center justify-center">
              <Avatar className="h-full w-full rounded-none">
                <AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-primary/10 to-primary/20 text-primary">
                  {getInitials(primaryName)}
                </AvatarFallback>
              </Avatar>
              {callState !== 'active' && (
                <div className="absolute inset-0 rounded-full border-2 border-primary/60 animate-ping opacity-25 pointer-events-none" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-foreground">{groupLabel}</h3>
              <p className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                {callType === 'video' ? (
                  <Video className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                ) : (
                  <Phone className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                )}
                <span className="min-w-0 break-words">
                  {callState === 'incoming' && `'${primaryName}' is trying to connect with you`}
                  {callState === 'outgoing' && `Trying to connect to '${primaryName}'`}
                  {callState === 'active' && `Connected — call in progress via Google Meet`}
                </span>
              </p>
              {callState === 'active' && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  The audio/video happens in the Google Meet tab — reopen it if you closed it.
                </p>
              )}
              {unreachable.length > 0 && callState !== 'active' && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {unreachable.map((p) => p.name || 'Someone').join(', ')} hasn't connected Google Meet and won't be
                  notified.
                </p>
              )}
            </div>
          </div>
        )}

        {!showUnreachablePanel && (
          <div className="flex items-center justify-end gap-2">
            {callState === 'incoming' && (
              <>
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
              </>
            )}

            {callState === 'outgoing' && (
              <Button
                size="icon"
                variant="destructive"
                className="h-10 w-10 rounded-full shadow hover:scale-105 transition-all"
                onClick={handleEnd}
                title="Cancel call"
              >
                <PhoneOff className="h-4 w-4" />
              </Button>
            )}

            {callState === 'active' && (
              <>
                <Button
                  variant="outline"
                  className="gap-2 rounded-full border-green-600 bg-green-600 text-white hover:bg-green-700 hover:text-white"
                  onClick={handleReopenMeet}
                >
                  <ExternalLink className="h-4 w-4" />
                  Reopen Meet
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-10 w-10 rounded-full shadow hover:scale-105 transition-all"
                  onClick={handleEnd}
                  title="Hang up"
                >
                  <PhoneOff className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        )}
        </>
      )}
    </div>
  );
}
