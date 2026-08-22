// ── Auth Module — Public API ───────────────────────────────────────────────────
//
// ONLY import from this file. Never import directly from
// src/modules/auth/components/* or src/modules/auth/services/*.
// Internal paths are private implementation details.

// Context + hook
export { AuthProvider, AuthContext, useAuth } from './AuthContext';

// Route guards
export { ProtectedRoute } from './components/ProtectedRoute';
export { GuestRoute } from './components/GuestRoute';

// Pages (consumed by the router in src/app/router.tsx)
export { default as LoginPage }            from './components/Login';
export { default as SignupPage }           from './components/Signup';
export { default as ForgotPasswordPage }   from './components/ForgotPassword';
export { default as ResetPasswordPage }    from './components/ResetPassword';
export { default as VerifyEmailPage }      from './components/VerifyEmail';
export { default as JoinOrganizationPage } from './components/JoinOrganization';

// Service (only for use by other auth-adjacent code — prefer useAuth() in components)
export { authService }                     from './services/auth.service';
export type { BackendUser, AuthTokens, AuthResponse, SignUpMetadata } from './services/auth.service';
