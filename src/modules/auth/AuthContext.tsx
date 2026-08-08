import React, { createContext, useEffect, useRef, useState, useCallback, useContext, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { authService, BackendUser, SignUpMetadata } from './services/auth.service';
import { apiClient } from '@/shared/api/client';
import { clearProactiveRefresh } from '@/services/api/client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import { config } from '@/config';
import { setSentryUser, clearSentryUser } from '@/infrastructure/monitoring/sentry';

interface AuthContextValue {
  user: BackendUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  pendingVerificationEmail: string | null;
  setPendingVerificationEmail: (email: string | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; requiresVerification?: boolean; email?: string }>;
  signUp: (email: string, password: string, metadata?: SignUpMetadata) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
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
      setUser(me);
    } catch {
      // ignore — token may have expired, interceptor handles redirect
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const result = await authService.login(email, password);
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
      const message = err instanceof Error ? err.message : 'Login failed';
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
      const message = err instanceof Error ? err.message : 'Registration failed';
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
      await authService.forgotPassword(email);
      return { error: null };
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
