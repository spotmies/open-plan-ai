let current: Window | null = null;

/**
 * Shared handle to the call-status tab (the "trying to connect" / "in call"
 * screen — not the actual Google Meet tab, see meetWindow.ts). Named so a
 * repeat open() call focuses the existing tab instead of spawning a
 * duplicate, mirroring meetWindow's reference-tracking approach.
 */
export const callWindow = {
  open(): void {
    if (current && !current.closed) {
      current.focus();
      return;
    }
    current = window.open('/call', 'openplan-call-status');
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
