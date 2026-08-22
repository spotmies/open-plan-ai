import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';

interface ProtectedRouteProps {
  requireVerified?: boolean;
}

export function ProtectedRoute({ requireVerified = true }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isEmailVerified, pendingVerificationEmail } = useAuth();

  // Show a skeleton instead of a blank screen while the /auth/me call resolves.
  // This prevents a white-flash on slow connections and hard refreshes.
  if (isLoading) return <AppLayoutSkeleton variant="dashboard" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireVerified && !isEmailVerified) {
    return (
      <Navigate
        to="/verify-email"
        state={{ email: pendingVerificationEmail, fromLogin: true }}
        replace
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
