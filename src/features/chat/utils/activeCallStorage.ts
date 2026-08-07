import type { CallType, CallParticipant } from '../stores/useCallStore';

const STORAGE_KEY = 'active-call-snapshot';

export interface ActiveCallSnapshot {
  callId: string;
  conversationId: string;
  callType: CallType;
  meetingUri: string;
  isGroup: boolean;
  participants: CallParticipant[];
  callerName: string | null;
  callStartedAt: number;
}

/**
 * Survives a page reload (sessionStorage, not localStorage) so an in-progress
 * Google Meet call doesn't lose its overlay just because this tab reloaded —
 * the Meet tab itself keeps running independently of the OpenPlan tab.
 * Cleared the instant the call ends, and only ever written for a confirmed
 * 'active' call — never for incoming/outgoing ringing, since a call that was
 * still ringing when the page reloaded may have already been answered or
 * declined elsewhere in the gap, and restoring that ring state would be
 * actively misleading rather than helpful.
 */
export const activeCallStorage = {
  save(snapshot: ActiveCallSnapshot): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* sessionStorage unavailable (private mode, quota) — call just won't survive a reload */
    }
  },

  load(): ActiveCallSnapshot | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ActiveCallSnapshot) : null;
    } catch {
      return null;
    }
  },

  clear(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};
