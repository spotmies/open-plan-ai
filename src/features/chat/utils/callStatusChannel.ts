import type { CallState, CallType } from '../stores/useCallStore';

export interface CallStatusSnapshot {
  callState: CallState;
  callType: CallType | null;
  primaryName: string;
  isGroupRing: boolean;
  reachableCount: number;
  unreachableNames: string[];
  meetingUri: string | null;
  callDuration: number;
  showUnreachablePanel: boolean;
  generatingLink: boolean;
}

export type CallStatusCommandAction = 'end' | 'reopen-meet' | 'send-link' | 'close';

export type CallStatusMessage =
  | { type: 'state'; snapshot: CallStatusSnapshot }
  | { type: 'request-state' }
  | { type: 'command'; action: CallStatusCommandAction };

const CHANNEL_NAME = 'openplan-call-status';

/**
 * The status tab is a separate JS runtime with its own empty useCallStore,
 * so it can't just read the main tab's state — it has to be pushed. This
 * wraps BroadcastChannel so both sides just call functions instead of
 * managing message types/cleanup directly.
 */
export function postCallStatusState(snapshot: CallStatusSnapshot): void {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({ type: 'state', snapshot } satisfies CallStatusMessage);
  channel.close();
}

export function postCallStatusCommand(action: CallStatusCommandAction): void {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({ type: 'command', action } satisfies CallStatusMessage);
  channel.close();
}

export function requestCallStatusState(): void {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({ type: 'request-state' } satisfies CallStatusMessage);
  channel.close();
}

/** Returns an unsubscribe function that closes the channel. */
export function onCallStatusMessage(handler: (message: CallStatusMessage) => void): () => void {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<CallStatusMessage>) => handler(event.data);
  return () => channel.close();
}
