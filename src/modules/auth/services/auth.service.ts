import axios from 'axios';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { config } from '@/config';

export interface SignUpMetadata {
  name?: string;
  company?: string;
  industry?: string;
}

export interface BackendUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  initials: string | null;
  jobTitle: string | null;
  timezone: string;
  emailVerified: boolean;
  createdAt: string;
  role?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: BackendUser;
}

// Dedupe concurrent bootstraps — React StrictMode double-invokes effects in dev
// and providers can mount together, so this keeps /auth/me to a single request.
let bootstrapInFlight: Promise<BackendUser | null> | null = null;

export const authService = {
  async register(email: string, password: string, metadata?: SignUpMetadata): Promise<{ message: string; email: string }> {
    return apiClient.post(ENDPOINTS.AUTH.REGISTER, {
      email,
      password,
      name: metadata?.name || email.split('@')[0],
      ...(metadata?.company ? { organizationName: metadata.company } : {}),
      ...(metadata?.industry ? { industry: metadata.industry } : {}),
    });
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    // The backend sets both tokens as httpOnly cookies; nothing to store here.
    return apiClient.post<AuthResponse>(ENDPOINTS.AUTH.LOGIN, { email, password });
  },

  /**
   * Restore the session on app load. The auth cookies are httpOnly so JS can't
   * read them — instead we probe /auth/me, and if the access cookie is missing
   * or expired, do one refresh and retry. Bare axios (no interceptors) is used
   * so a logged-out bootstrap never triggers a redirect on public pages.
   * Returns the user, or null if there is no valid session.
   */
  bootstrap(): Promise<BackendUser | null> {
    if (bootstrapInFlight) return bootstrapInFlight;

    bootstrapInFlight = (async () => {
      const opts = { withCredentials: true };
      const url = (path: string) => `${config.api.baseUrl}${path}`;
      try {
        const res = await axios.get(url(ENDPOINTS.AUTH.ME), opts);
        return res.data.data as BackendUser;
      } catch {
        // access cookie missing/expired — fall through to a single refresh attempt
      }
      try {
        await axios.post(url(ENDPOINTS.AUTH.REFRESH), {}, opts);
        const res = await axios.get(url(ENDPOINTS.AUTH.ME), opts);
        return res.data.data as BackendUser;
      } catch {
        return null;
      }
    })();

    void bootstrapInFlight.finally(() => { bootstrapInFlight = null; });
    return bootstrapInFlight;
  },

  async logout(): Promise<void> {
    // The refresh-token cookie is sent automatically via withCredentials, so no
    // body is needed. The backend revokes the token and clears both cookies.
    try {
      await apiClient.post(ENDPOINTS.AUTH.LOGOUT);
    } catch {
      // Ignore network/401 errors — the user is logging out regardless.
    }
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return apiClient.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post(ENDPOINTS.AUTH.RESET_PASSWORD, { token, password });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.patch(ENDPOINTS.AUTH.CHANGE_PASSWORD, { currentPassword, newPassword });
  },

  async sendOtp(email: string): Promise<{ message: string }> {
    return apiClient.post(ENDPOINTS.AUTH.SEND_OTP, { email });
  },

  async verifyOtp(email: string, otp: string): Promise<AuthResponse> {
    // Backend sets both tokens as httpOnly cookies on success.
    return apiClient.post<AuthResponse>(ENDPOINTS.AUTH.VERIFY_OTP, { email, otp });
  },

  async getMe(): Promise<BackendUser> {
    return apiClient.get(ENDPOINTS.AUTH.ME);
  },
};
