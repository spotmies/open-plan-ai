let current: Window | null = null;

/**
 * Shared handle to the Google Meet tab for the active call. Opening a blank
 * window synchronously inside a click handler and navigating it later
 * (rather than calling window.open() with the real URL from an async
 * callback) avoids browser popup blockers, since only *opening new* windows
 * outside a user gesture is blocked — navigating an existing reference isn't.
 */
export const meetWindow = {
  openPlaceholder(): void {
    current = window.open('about:blank', '_blank');
  },

  navigateOrOpen(uri: string): void {
    if (!uri) return;
    if (current && !current.closed) {
      current.location.href = uri;
      current.focus();
    } else {
      current = window.open(uri, '_blank');
    }
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
