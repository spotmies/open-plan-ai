export type CallCardStatus = 'ongoing' | 'completed' | 'missed';

/**
 * JSON payload smuggled through a 'system' message's `content` field — same
 * trick already used for file/image messages — so a call-history card needs
 * no backend schema change. `parseCallCardContent` distinguishes it from a
 * plain system string like "Alice joined the group".
 */
export interface CallCardContent {
  kind: 'call-card';
  callId: string;
  callType: 'audio' | 'video';
  isGroup: boolean;
  status: CallCardStatus;
  durationSec: number;
  initiatorId: string;
  initiatorName: string;
}

export function buildCallCardContent(content: CallCardContent): string {
  return JSON.stringify(content);
}

export function parseCallCardContent(content: string): CallCardContent | null {
  if (!content || content[0] !== '{') return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.kind === 'call-card') {
      return parsed as CallCardContent;
    }
  } catch {
    // Not JSON — a regular system message (e.g. "X joined the group").
  }
  return null;
}

/** Formats a talk duration the way WhatsApp-style call cards do: "23 secs", "2 mins", "1 hr, 10 mins". */
export function formatCallDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec < 60) return `${sec} sec${sec === 1 ? '' : 's'}`;

  const totalMin = Math.floor(sec / 60);
  if (totalMin < 60) return `${totalMin} min${totalMin === 1 ? '' : 's'}`;

  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  const hrPart = `${hr} hr${hr === 1 ? '' : 's'}`;
  return min === 0 ? hrPart : `${hrPart}, ${min} min${min === 1 ? '' : 's'}`;
}
