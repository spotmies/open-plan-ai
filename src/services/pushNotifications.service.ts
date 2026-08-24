import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { config } from '@/config';
import { logger } from '@/services/monitoring/logger';
import { notificationPreferencesService } from '@/services/notificationPreferences.service';

// ─── Support detection ─────────────────────────────────────────────────────────

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

// ─── Service worker registration ───────────────────────────────────────────────

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register('/sw.js');
  }
  return registrationPromise;
}

// ─── VAPID key conversion ───────────────────────────────────────────────────────
// PushManager.subscribe() needs applicationServerKey as a Uint8Array, not the
// base64url string the backend/env hand us.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/**
 * Whether this browser currently holds a live PushManager subscription.
 * Distinct from the backend's `pushEnabled` preference: the preference can
 * say "on" while the underlying subscription is actually dead (e.g. the push
 * service rejected it and the backend cleaned it up server-side) — this is
 * the only way to know the two have drifted apart.
 */
export async function hasLiveSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}

// ─── Subscribe / unsubscribe ───────────────────────────────────────────────────

/**
 * Registers (or reuses) a PushManager subscription and posts it to the
 * backend. Assumes permission is already 'granted' — does not prompt.
 * Shared by subscribeToPush() (after a fresh permission grant) and
 * reconcilePushSubscription() (silent re-subscribe on an already-granted
 * permission whose subscription died).
 */
async function doSubscribe(): Promise<boolean> {
  if (!config.push.vapidPublicKey) {
    logger.error('VITE_VAPID_PUBLIC_KEY is not set — cannot subscribe to push');
    return false;
  }

  try {
    const registration = await registerServiceWorker();
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.push.vapidPublicKey),
      });
    }

    const json = subscription.toJSON();
    await apiClient.post(ENDPOINTS.PUSH.SUBSCRIBE, {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    });

    return true;
  } catch (error) {
    logger.error('Failed to subscribe to push notifications:', error);
    return false;
  }
}

/**
 * Requests notification permission (must be called from a user gesture —
 * e.g. a settings toggle click, never on page load) and, if granted,
 * subscribes to push and registers the subscription with the backend.
 * Returns false without throwing if unsupported, denied, or misconfigured.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  return doSubscribe();
}

/**
 * Unsubscribes the current browser from push and removes the subscription
 * from the backend. Safe to call even if never subscribed.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await apiClient.delete(ENDPOINTS.PUSH.UNSUBSCRIBE, { data: { endpoint } });
  } catch (error) {
    logger.error('Failed to unsubscribe from push notifications:', error);
  }
}

// ─── Reconciliation ─────────────────────────────────────────────────────────────

/**
 * Keeps the saved `pushEnabled` preference honest against what the browser
 * can actually deliver. Meant to run once per app load (not just when the
 * user opens Settings) so a permission change is caught before the user
 * notices notifications silently stopped.
 *
 * - permission denied/reset: the user can't receive push no matter what the
 *   preference says — turn it off server-side.
 * - permission granted but no live subscription (killed by the push service,
 *   or the user revoked-then-re-granted permission and the browser dropped
 *   the old subscription): silently re-subscribe. The user already opted in
 *   once — only the browser-level permission state changed — so this
 *   resumes push without asking them to find the toggle again.
 * - permission granted with a live subscription: nothing to do.
 *
 * No-ops entirely if the user never turned push on in the first place.
 */
export async function reconcilePushSubscription(): Promise<void> {
  if (!isPushSupported()) return;

  let prefs;
  try {
    prefs = await notificationPreferencesService.getPreferences();
  } catch (error) {
    logger.error('Failed to load notification preferences for push reconciliation:', error);
    return;
  }
  if (!prefs.pushEnabled) return;

  const permission = Notification.permission;

  if (permission === 'granted') {
    if (await hasLiveSubscription()) return;
    if (await doSubscribe()) return;
    // Subscribe failed for a reason other than permission (e.g. misconfigured
    // VAPID key) — fall through to marking the preference off below.
  }

  await notificationPreferencesService.updatePreferences({ pushEnabled: false });
}
