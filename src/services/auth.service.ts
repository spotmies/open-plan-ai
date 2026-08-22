// Bridge re-export — progressively migrate callers to '@/modules/auth'.
export { authService } from '@/modules/auth/services/auth.service';
export type { BackendUser, AuthTokens, AuthResponse, SignUpMetadata } from '@/modules/auth/services/auth.service';
