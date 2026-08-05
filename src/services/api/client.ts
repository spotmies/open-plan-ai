import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { config } from '@/config';

// ─── Auth model ───────────────────────────────────────────────────────────────
//
// Backend uses httpOnly cookies: accessToken (~15 min) + refreshToken (~7 days).
// withCredentials: true sends both automatically on every request.
// On 401 the interceptor calls /auth/refresh to silently rotate the cookies,
// then retries the original request — the caller never sees the 401.

// ─── Cross-tab refresh lock (localStorage) ───────────────────────────────────
//
// Problem: each browser tab has its own JS heap, so the in-tab `isRefreshing`
// flag cannot prevent two tabs from both calling /auth/refresh concurrently.
// The first call rotates and revokes the old refresh token; the second call then
// sends the revoked token and gets a 401, which triggers a force-logout.
//
// Solution: one tab atomically writes a timestamped lock to localStorage before
// refreshing. Other tabs see the lock and queue their 401-ed requests instead of
// starting their own refresh. The lock-holder broadcasts the outcome over a
// BroadcastChannel so waiting tabs can flush their queues.

const LOCK_KEY = 'auth_refresh_lock';
// TTL must exceed the Axios network timeout (15 s) so a slow-but-live tab never
// has its lock stolen by an impatient one.
const LOCK_TTL_MS = 20_000;

function tryAcquireLock(): boolean {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (raw) {
      const { ts } = JSON.parse(raw) as { ts: number };
      if (Date.now() - ts < LOCK_TTL_MS) return false;
    }
    localStorage.setItem(LOCK_KEY, JSON.stringify({ ts: Date.now() }));
    return true;
  } catch {
    // localStorage unavailable (private mode, storage full, etc.) — let this
    // tab proceed without cross-tab coordination.
    return true;
  }
}

function releaseLock(): void {
  try { localStorage.removeItem(LOCK_KEY); } catch { /* ignore */ }
}

// ─── Cross-tab broadcast (BroadcastChannel) ───────────────────────────────────

let bc: BroadcastChannel | null = null;

function initBC(): void {
  if (bc || typeof BroadcastChannel === 'undefined') return;
  bc = new BroadcastChannel('auth:refresh');
  bc.onmessage = ({ data }: MessageEvent<{ type: 'SUCCESS' | 'FAILURE' }>) => {
    cancelCrossTabTimer();
    isRefreshing = false;
    if (data.type === 'SUCCESS') {
      notifyTokenRefreshed();
      flushQueue(false);
    } else {
      flushQueue(true);
      redirectToLogin();
    }
  };
}

function broadcast(type: 'SUCCESS' | 'FAILURE'): void {
  bc?.postMessage({ type });
}

// ─── Token-refreshed notification ──────────────────────────────────────────────
//
// Fired whenever the accessToken cookie is successfully rotated, in this tab
// or another. Anything holding a long-lived connection authenticated by that
// cookie at handshake time — currently just the chat Socket.IO transport —
// listens for this to retry immediately instead of waiting out its own
// reconnect backoff with a cookie it already knows is stale.

export const AUTH_TOKEN_REFRESHED_EVENT = 'auth:token-refreshed';

function notifyTokenRefreshed(): void {
  window.dispatchEvent(new Event(AUTH_TOKEN_REFRESHED_EVENT));
}

// ─── Fallback timer ───────────────────────────────────────────────────────────
//
// If the lock-holding tab crashes before it can broadcast (e.g. user closes it
// mid-refresh), waiting tabs would queue forever. This timer fires slightly
// after the lock TTL and redirects the user to login as a safe fallback.

let crossTabTimer: ReturnType<typeof setTimeout> | null = null;

function startCrossTabTimer(): void {
  if (crossTabTimer) return;
  crossTabTimer = setTimeout(() => {
    crossTabTimer = null;
    isRefreshing = false;
    flushQueue(true);
    redirectToLogin();
  }, LOCK_TTL_MS + 5_000);
}

function cancelCrossTabTimer(): void {
  if (!crossTabTimer) return;
  clearTimeout(crossTabTimer);
  crossTabTimer = null;
}

// ─── In-tab refresh queue ─────────────────────────────────────────────────────

let isRefreshing = false;
let isRedirectingToLogin = false;
let refreshSubscribers: Array<(failed: boolean) => void> = [];

function flushQueue(failed: boolean): void {
  const subs = refreshSubscribers;
  refreshSubscribers = [];
  subs.forEach((cb) => cb(failed));
}

function redirectToLogin(): void {
  if (!isRedirectingToLogin && !window.location.pathname.includes('/login')) {
    isRedirectingToLogin = true;
    window.location.href = '/login';
  }
}

// ─── Axios instance ───────────────────────────────────────────────────────────

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const axiosInstance: AxiosInstance = axios.create({
  baseURL: config.api.baseUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

const SKIP_REFRESH_URLS = [
  '/auth/refresh',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/send-otp',
  '/auth/verify-otp',
];

// ─── Shared refresh flow ────────────────────────────────────────────────────
//
// Performs (or waits out) a cross-tab-coordinated token refresh. Used by the
// 401 interceptor below, and exported so other long-lived connections
// authenticated via the same cookie (the chat Socket.IO transport) can
// proactively trigger the same flow instead of only reacting to a failed
// REST call. Resolves true once the accessToken cookie is known-fresh,
// false if the refresh ultimately failed (session is gone).
export function refreshAccessToken(): Promise<boolean> {
  // Ensure the BroadcastChannel listener is set up before we do anything else
  // so we don't miss a broadcast that arrives while we're deciding what to do.
  initBC();

  // ── Case 1: same tab — a refresh is already in flight ───────────────────
  if (isRefreshing) {
    return new Promise<boolean>((resolve) => {
      refreshSubscribers.push((failed) => resolve(!failed));
    });
  }

  isRefreshing = true;

  // ── Case 2: cross-tab — another tab holds the refresh lock ──────────────
  // Wait for that tab's BroadcastChannel message. The fallback timer handles
  // the case where that tab crashes mid-refresh.
  if (!tryAcquireLock()) {
    startCrossTabTimer();
    return new Promise<boolean>((resolve) => {
      refreshSubscribers.push((failed) => resolve(!failed));
    });
  }

  // ── Case 3: this tab holds the lock — perform the refresh ────────────────
  // POST /auth/refresh with no body — the browser sends the httpOnly
  // refresh-token cookie automatically. The backend rotates both cookies.
  return axios
    .post(`${config.api.baseUrl}/auth/refresh`, {}, { withCredentials: true })
    .then(() => {
      releaseLock();
      isRefreshing = false;
      broadcast('SUCCESS');
      notifyTokenRefreshed();
      flushQueue(false);
      return true;
    })
    .catch(() => {
      releaseLock();
      isRefreshing = false;
      broadcast('FAILURE');
      flushQueue(true);
      redirectToLogin();
      return false;
    });
}

// Response interceptor — silent token refresh on 401.
// No Authorization header is set: the access token is an httpOnly cookie the
// browser attaches automatically via withCredentials.
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequest;

    if (!error.response || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (SKIP_REFRESH_URLS.some((ep) => originalRequest.url?.includes(ep))) {
      redirectToLogin();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const refreshed = await refreshAccessToken();
    if (!refreshed) return Promise.reject(error);
    return axiosInstance(originalRequest);
  },
);

// ─── Error extraction ─────────────────────────────────────────────────────────

function extractApiError(err: unknown): Error {
  const e = err as {
    response?: {
      data?: {
        error?: { details?: Array<{ message?: string }>; message?: string };
        message?: string;
      };
    };
    message?: string;
  };

  const body = e?.response?.data;
  if (body) {
    const detail = body?.error?.details?.[0]?.message;
    if (typeof detail === 'string' && detail) {
      return Object.assign(new Error(detail), { response: (err as { response?: unknown }).response });
    }
    const msg = body?.error?.message ?? body?.message;
    if (typeof msg === 'string' && msg) {
      return Object.assign(new Error(msg), { response: (err as { response?: unknown }).response });
    }
  }
  return err instanceof Error ? err : new Error('An unexpected error occurred');
}

// ─── Response envelope unwrapping ──────────────────────────────────────────────
//
// The backend can respond with HTTP 200 and `{ success: false, ... }` for
// server-side validation failures instead of a 4xx status. Axios only rejects
// on network errors / non-2xx statuses, so without this check those responses
// would resolve normally and callers (e.g. mutation onSuccess handlers) would
// treat a failed operation as having succeeded.

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: { message?: string; details?: Array<{ message?: string }> };
}

function unwrap<T>(res: AxiosResponse<ApiEnvelope<T>>): T {
  const body = res.data;
  if (body?.success === false) {
    const detail = body.error?.details?.[0]?.message;
    throw new Error(detail || body.error?.message || body.message || 'Request failed');
  }
  return body.data;
}

// ─── ApiClient ────────────────────────────────────────────────────────────────

class ApiClient {
  async get<T>(url: string, cfg?: AxiosRequestConfig): Promise<T> {
    try {
      return unwrap<T>(await axiosInstance.get(url, cfg));
    } catch (err) { throw extractApiError(err); }
  }

  async post<T>(url: string, data?: unknown, cfg?: AxiosRequestConfig): Promise<T> {
    try {
      return unwrap<T>(await axiosInstance.post(url, data, cfg));
    } catch (err) { throw extractApiError(err); }
  }

  async put<T>(url: string, data?: unknown, cfg?: AxiosRequestConfig): Promise<T> {
    try {
      return unwrap<T>(await axiosInstance.put(url, data, cfg));
    } catch (err) { throw extractApiError(err); }
  }

  async patch<T>(url: string, data?: unknown, cfg?: AxiosRequestConfig): Promise<T> {
    try {
      return unwrap<T>(await axiosInstance.patch(url, data, cfg));
    } catch (err) { throw extractApiError(err); }
  }

  async delete<T>(url: string, cfg?: AxiosRequestConfig): Promise<T> {
    try {
      return unwrap<T>(await axiosInstance.delete(url, cfg));
    } catch (err) { throw extractApiError(err); }
  }

  get raw() { return axiosInstance; }
}

export const apiClient = new ApiClient();
