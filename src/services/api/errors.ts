/**
 * Picks the message to put in front of the user when a request fails.
 *
 * `extractApiError` in ./client already copies the API's `error.message` onto
 * the thrown Error, so the reason the server gave — "Cannot delete this module
 * — 1 task is still linked to it." — is right there; handlers just have to use
 * it instead of a generic string.
 *
 * Only 4xx bodies are worth showing: those are deliberate, user-actionable
 * rejections. A 5xx carries an internal message, and a timeout or dropped
 * connection carries a raw transport one ("timeout of 15000ms exceeded") —
 * neither means anything to the user, so those fall back to the caller's copy.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (typeof status !== 'number' || status < 400 || status >= 500) return fallback;

  const message = error instanceof Error ? error.message.trim() : '';
  return message || fallback;
}
