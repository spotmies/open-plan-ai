/**
 * Returns the viewer's browser-detected local timezone, used to render chat
 * message timestamps. Always local to the device — like WhatsApp/Slack/iMessage —
 * rather than a shared org or profile setting, so the same message shows the
 * same wall-clock time relative to each viewer regardless of org configuration.
 */
export function useUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
