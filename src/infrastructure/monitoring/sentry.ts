import * as Sentry from '@sentry/react';

let initialised = false;

export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  const isProduction = import.meta.env.PROD as boolean;

  // Only initialise when: DSN is provided AND we are in a built (non-dev) env.
  if (!dsn || !isProduction || initialised) return;

  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string) || 'production',
    release: (import.meta.env.VITE_APP_VERSION as string) || '1.0.0',

    // Capture 10% of traces for performance monitoring (adjust as needed).
    tracesSampleRate: 0.1,

    // Capture 100% of errors.
    sampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask all text + block all media in session replays for privacy.
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Don't send errors originating from browser extensions.
    denyUrls: [/extensions\//i, /^chrome:\/\//i],

    beforeSend(event) {
      // Strip any accidental PII from breadcrumb URLs.
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url);
          // Remove query params that may carry tokens.
          url.search = '';
          event.request.url = url.toString();
        } catch {
          // URL parse failure — leave as-is.
        }
      }
      return event;
    },
  });

  initialised = true;
}

/** Attach authenticated user context so errors are traceable to a user. */
export function setSentryUser(id: string, email?: string): void {
  Sentry.setUser({ id, email });
}

/** Clear user context on logout. */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/** Manually capture a handled exception (e.g. caught API errors worth tracking). */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, { extra: context });
}

/** Wrap a React component with the Sentry error boundary. */
export const SentryErrorBoundary = Sentry.ErrorBoundary;
