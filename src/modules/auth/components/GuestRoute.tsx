import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';

/**
 * Inverse of ProtectedRoute: keeps an already-authenticated user (valid
 * session cookies) off auth-only pages like /login, sending them straight to
 * the dashboard instead of re-showing the sign-in form. Waits out isLoading
 * first — on a hard refresh the session isn't known yet until /auth/me
 * resolves, and redirecting before that would either flash the wrong way or
 * bounce a genuinely logged-out user right back to a blank dashboard.
 */
export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AppLayoutSkeleton variant="dashboard" />;

  if (isAuthenticated) {
    const redirect = new URLSearchParams(location.search).get('redirect');
    return <Navigate to={redirect || '/'} replace />;
  }

  return <Outlet />;
}

export default GuestRoute;
