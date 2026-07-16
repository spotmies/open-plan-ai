import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Phone, PhoneOff, Video, ExternalLink, Send, Loader2 } from 'lucide-react';
import {
  onCallStatusMessage,
  postCallStatusCommand,
  requestCallStatusState,
  type CallStatusSnapshot,
} from './utils/callStatusChannel';

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
 * The standalone "trying to connect" / "in call" tab. This is a separate JS
 * runtime with no socket connection and an empty useCallStore of its own —
 * it only ever displays whatever snapshot the main tab (the real owner of
 * the call) last broadcast, and forwards button clicks back as commands. See
 * CallOverlay.tsx for the tab that actually drives the call.
 */
export default function CallStatusWindow() {
  const [snapshot, setSnapshot] = useState<CallStatusSnapshot | null>(null);
  // The main tab is often still awaiting the Google Meet API (token fetch +
  // meeting creation) when this tab's first request-state handshake lands,
  // so the first reply can legitimately be 'idle' (call hasn't started yet,
  // not "call ended"). Only auto-close on idle once we've actually seen the
  // call go live — otherwise this tab would close itself instantly.
  const hasSeenLiveCallRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onCallStatusMessage((message) => {
      if (message.type !== 'state') return;
      setSnapshot(message.snapshot);
      if (message.snapshot.callState !== 'idle') {
        hasSeenLiveCallRef.current = true;
      } else if (hasSeenLiveCallRef.current) {
        window.close();
      }
    });
    requestCallStatusState();
    return unsubscribe;
  }, []);

  if (!snapshot || snapshot.callState === 'idle') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-sm">Connecting…</p>
      </div>
    );
  }

  const {
    callState,
    callType,
    primaryName,
    isGroupRing,
    reachableCount,
    unreachableNames,
    callDuration,
    showUnreachablePanel,
    generatingLink,
  } = snapshot;

  const groupLabel = isGroupRing ? `${primaryName} + ${reachableCount - 1} other${reachableCount > 2 ? 's' : ''}` : primaryName;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between p-6 select-none">
      <div className="w-full flex items-center justify-between text-muted-foreground text-sm max-w-lg">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span>Google Meet Calling</span>
        </div>
        {callState === 'active' && (
          <span className="font-mono text-foreground font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
            {formatTime(callDuration)}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full max-w-lg">
        {showUnreachablePanel ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 text-center max-w-sm flex flex-col items-center gap-4 animate-in zoom-in-95">
            <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center text-destructive">
              <PhoneOff className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1 text-base">
                {unreachableNames.length > 1 ? 'No one is reachable' : 'Recipient Not Connected'}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Invalid call as {unreachableNames.join(', ') || 'they'} hasn't connected to the Google Meet
                integration. Please send them a link instead.
              </p>
            </div>
            <div className="flex gap-2 w-full mt-2">
              <Button
                variant="outline"
                className="flex-1 border-border"
                onClick={() => postCallStatusCommand('close')}
                disabled={generatingLink}
              >
                Close
              </Button>
              <Button
                variant="default"
                className="flex-1 gap-2"
                onClick={() => postCallStatusCommand('send-link')}
                disabled={generatingLink}
              >
                {generatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Link
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative w-full flex flex-col items-center gap-6">
            <div className="relative h-48 w-48 md:h-56 md:w-56 rounded-full overflow-hidden border-2 border-primary/20 bg-muted shadow-2xl flex items-center justify-center">
              <Avatar className="h-full w-full rounded-none">
                <AvatarFallback className="text-4xl font-semibold bg-gradient-to-br from-primary/10 to-primary/20 text-primary">
                  {getInitials(primaryName)}
                </AvatarFallback>
              </Avatar>
              {callState === 'outgoing' && (
                <div className="absolute inset-0 rounded-full border-2 border-primary/60 animate-ping opacity-25 pointer-events-none" />
              )}
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">{groupLabel}</h2>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-xs flex items-center justify-center gap-1.5">
                {callType === 'video' ? (
                  <Video className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Phone className="h-3.5 w-3.5 text-primary" />
                )}
                {callState === 'outgoing' && `Trying to connect to '${primaryName}'`}
                {callState === 'active' && `${primaryName} connected — call in progress via Google Meet`}
              </p>
              {callState === 'active' && (
                <p className="text-xs text-muted-foreground">
                  The audio/video happens in the Google Meet tab — reopen it if you closed it.
                </p>
              )}
              {unreachableNames.length > 0 && callState !== 'active' && (
                <p className="text-xs text-muted-foreground max-w-xs">
                  {unreachableNames.join(', ')} hasn't connected Google Meet and won't be notified.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-lg flex flex-col items-center gap-4">
        {callState === 'outgoing' && !showUnreachablePanel && (
          <Button
            size="lg"
            variant="destructive"
            className="h-14 w-14 rounded-full p-0 flex items-center justify-center shadow-lg hover:shadow-destructive/25 hover:scale-105 transition-all"
            onClick={() => postCallStatusCommand('end')}
            title="Cancel call"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        )}

        {callState === 'active' && (
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 rounded-full" onClick={() => postCallStatusCommand('reopen-meet')}>
              <ExternalLink className="h-4 w-4" />
              Reopen Meet
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="h-14 w-14 rounded-full p-0 flex items-center justify-center shadow-lg hover:shadow-destructive/25 hover:scale-105 transition-all"
              onClick={() => postCallStatusCommand('end')}
              title="Hang up"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
