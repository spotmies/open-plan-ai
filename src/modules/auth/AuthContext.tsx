import React, { createContext, useEffect, useRef, useState, useCallback, useContext, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { authService, BackendUser, SignUpMetadata } from './services/auth.service';
import { apiClient } from '@/shared/api/client';
import { clearProactiveRefresh } from '@/services/api/client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import { config } from '@/config';
import { setSentryUser, clearSentryUser } from '@/infrastructure/monitoring/sentry';
import { parseOrgReviewError, type OrgReviewBlock } from './orgReview';

interface AuthContextValue {
  user: BackendUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  pendingVerificationEmail: string | null;
  setPendingVerificationEmail: (email: string | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; requiresVerification?: boolean; email?: string; orgReview?: OrgReviewBlock }>;
  signUp: (email: string, password: string, metadata?: SignUpMetadata) => Promise<{ error: Error | null; orgReview?: OrgReviewBlock }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null; exists?: boolean }>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  deleteAccount: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  // Initialize auth state from stored token
  useEffect(() => {
    const init = async () => {
      try {
        // Auth lives entirely in httpOnly cookies, so login state can't be read
        // from JS — bootstrap() probes the session (and refreshes if needed).
        const me = await authService.bootstrap();
        if (me) {
          const pRole = me.platformRole?.toLowerCase();
          if (pRole && pRole !== 'none') {
            await authService.logout().catch(() => {});
            setUser(null);
            return;
          }
          setUser(me);
          setSentryUser(me.id, me.email);
        }
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Open a socket once authenticated; listen for server-initiated force-logout
  // (e.g. account deleted by an admin). The server emits 'auth:force_logout' to
  // the user:{userId} room, which the socket server auto-joins on connect.
  const authSocketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      authSocketRef.current?.disconnect();
      authSocketRef.current = null;
      return;
    }

    const socket = io(config.api.wsUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('auth:force_logout', () => {
      socket.disconnect();
      authSocketRef.current = null;
      clearSentryUser();
      clearProactiveRefresh();
      setUser(null);
      setPendingVerificationEmail(null);
      window.location.href = '/login';
    });

    authSocketRef.current = socket;

    return () => {
      socket.disconnect();
      authSocketRef.current = null;
    };
  }, [user?.id]); // reconnect only if the logged-in user changes

  const refreshProfile = useCallback(async () => {
    try {
      const me = await authService.getMe();
      const pRole = me.platformRole?.toLowerCase();
      if (pRole && pRole !== 'none') {
        await authService.logout().catch(() => {});
        setUser(null);
        window.location.href = '/login';
        return;
      }
      setUser(me);
    } catch {
      // ignore — token may have expired, interceptor handles redirect
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const result = await authService.login(email, password);
      const pRole = result.user.platformRole?.toLowerCase();
      if (pRole && pRole !== 'none') {
        await authService.logout().catch(() => {});
        return {
          error: new Error(
            'This account is a platform administrator. Please sign in at the Admin Console (admin.openplanai.com).',
          ),
        };
      }
      setUser(result.user);
      setSentryUser(result.user.id, result.user.email);
      setPendingVerificationEmail(null);
      return { error: null };
    } catch (err: unknown) {
      // Check if the error is an unverified email response (403).
      // The backend sends ForbiddenError with a JSON-encoded message:
      //   { "code": "EMAIL_NOT_VERIFIED", "email": "..." }
      const axiosErr = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      if (axiosErr?.response?.status === 403) {
        const rawMsg = axiosErr.response?.data?.error?.message || '';
        let code = '';
        try { code = (JSON.parse(rawMsg) as { code?: string }).code || ''; } catch { /* not JSON */ }
        if (code === 'EMAIL_NOT_VERIFIED') {
          // Backend auto-sends OTP on this 403 — just flag the state
          setPendingVerificationEmail(email);
          return { error: null, requiresVerification: true, email };
        }
      }

      // Organization awaiting (or refused) admin approval. Returned as state, not
      // an Error: the login box renders an explanation in place of the form, and
      // the raw payload is JSON that must never reach an error alert.
      const orgReview = parseOrgReviewError(err);
      if (orgReview) {
        return { error: null, orgReview };
      }
      const serverMessage = axiosErr?.response?.data?.error?.message;
      const message = serverMessage || (err instanceof Error ? err.message : 'Login failed');
      return { error: new Error(message) };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, metadata?: SignUpMetadata) => {
    try {
      await authService.register(email, password, metadata);
      // Backend auto-sends OTP on register
      setPendingVerificationEmail(email);
      return { error: null };
    } catch (err) {
      // Re-registering an email whose organization is already under review (or was
      // rejected) returns the coded 403 instead of a duplicate-email conflict, so
      // the signup box can explain the real situation.
      const orgReview = parseOrgReviewError(err);
      if (orgReview) {
        return { error: null, orgReview };
      }
      // Prefer the server's message: this catch used to drop the axios response
      // entirely, which left Signup.tsx rendering whatever `err.message` held.
      const serverMessage = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      const message = serverMessage || (err instanceof Error ? err.message : 'Registration failed');
      return { error: new Error(message) };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setPendingVerificationEmail(null);
      clearSentryUser();
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const result = await authService.forgotPassword(email);
      return { error: null, exists: result.exists };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Failed to send reset email') };
    }
  }, []);

  const updatePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      await authService.changePassword(currentPassword, newPassword);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Failed to update password') };
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      await apiClient.delete(ENDPOINTS.USERS.ME);
      await signOut();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Failed to delete account') };
    }
  }, [signOut]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    isEmailVerified: user?.emailVerified ?? false,
    pendingVerificationEmail,
    setPendingVerificationEmail,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile,
    deleteAccount,
  }), [user, isLoading, pendingVerificationEmail, signIn, signUp, signOut, resetPassword, updatePassword, refreshProfile, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
