let current: Window | null = null;

// Stable target name (not '_blank') so that if this tab reloads mid-call —
// losing the in-memory `current` handle, but not closing the still-running
// Meet tab — clicking "Reopen Meet" re-targets the same already-open tab
// instead of spawning a duplicate. window.open(url, name) always navigates
// the target, so this has no downside versus '_blank' when no such window
// exists yet: it just opens a normal new tab, same as before.
const MEET_WINDOW_NAME = 'openplan-google-meet';

function escapeHtml(str: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return words[0]?.charAt(0).toUpperCase() || '?';
}

/** Self-contained waiting-room page painted into the placeholder tab — no external assets, since it's written via document.write() into a bare about:blank document. */
function buildWaitingPageHtml(label: string, callType: 'audio' | 'video'): string {
  const safeLabel = escapeHtml(label);
  const initials = escapeHtml(getInitials(label));
  const kind = callType === 'video' ? 'Video call' : 'Voice call';
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Calling ${safeLabel}…</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #ffffff; color: #0f172a;
    display: flex; align-items: center; justify-content: center;
  }
  @media (prefers-color-scheme: dark) {
    html, body { background: #0b0f19; color: #e5e7eb; }
  }
  .card { text-align: center; padding: 32px; }
  .avatar {
    position: relative;
    width: clamp(96px, 12vw, 180px); height: clamp(96px, 12vw, 180px); border-radius: 50%;
    margin: 0 auto clamp(24px, 3vw, 40px); display: flex; align-items: center; justify-content: center;
    font-size: clamp(32px, 4vw, 60px); font-weight: 600;
    background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.3));
    color: #6366f1;
  }
  .ring {
    position: absolute; inset: -8px; border-radius: 50%;
    border: 3px solid rgba(99,102,241,0.5);
    animation: pulse 1.6s ease-out infinite;
  }
  @keyframes pulse {
    0% { transform: scale(0.9); opacity: 0.8; }
    100% { transform: scale(1.35); opacity: 0; }
  }
  h1 { font-size: clamp(22px, 2.4vw, 36px); font-weight: 600; margin: 0 0 12px; }
  p { font-size: clamp(15px, 1.4vw, 20px); color: #6b7280; margin: 0; }
  .dots::after { content: ''; animation: dots 1.4s steps(4,end) infinite; }
  @keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } 100% { content: ''; } }
</style>
</head>
<body>
  <div class="card">
    <div class="avatar"><div class="ring"></div>${initials}</div>
    <h1>Calling ${safeLabel}</h1>
    <p>${kind} &middot; waiting for them to join<span class="dots"></span></p>
  </div>
</body>
</html>`;
}

/**
 * Shared handle to the Google Meet tab for the active call. No tab is opened
 * for the caller until the callee actually accepts (see useCallSignaling.ts)
 * — that accept arrives as an async socket event, not a click, so
 * window.open() there is a genuine "no user gesture" call and browsers are
 * free to block it. navigateOrOpen() returns the window it got (or null) so
 * callers can detect a block and offer a manual fallback — a click on that
 * fallback is a real gesture, so the same call always succeeds from there.
 */
export const meetWindow = {
  navigateOrOpen(uri: string): Window | null {
    if (!uri) return null;
    if (current && !current.closed) {
      current.location.href = uri;
      current.focus();
    } else {
      current = window.open(uri, MEET_WINDOW_NAME);
    }
    return current;
  },

  close(): void {
    current?.close();
    current = null;
  },

  /** True once a window was opened and the user has since closed it (or none was ever opened). */
  isClosed(): boolean {
    return current !== null && current.closed;
  },
};
