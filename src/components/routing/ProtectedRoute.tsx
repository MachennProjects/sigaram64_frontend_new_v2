// SIGARAM64 — Protected Route
// Route guard — redirects to /login if not authenticated or wrong role
// Waits for auth state to resolve before deciding (prevents flash on refresh)
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getToken } from '../../api/client';
import logoIcon from '../../assets/Images/Logo/sigaram64_icon_transparent_512.png';
import { ROLE_HOME } from '../../config/roleConfig';
import type { UserRole } from '../../data/users';

export default function ProtectedRoute({ allowedRoles }: { allowedRoles?: UserRole[] }) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const location = useLocation();

  // Detect browser back button (bfcache restoration) where token is cleared but memory state is stale
  if (isAuthenticated && !getToken()) {
    logout();
    return <Navigate to="/login" replace />;
  }

  // While auth state is being resolved — show a minimal spinner
  // This prevents a flash-redirect to /login on page refresh
  if (loading) {
    return (
      <div className="h-screen bg-dark-bg flex flex-col items-center justify-center gap-4">
        <img src={logoIcon} alt="SIGARAM64 Logo" className="h-12 w-12 object-contain animate-pulse" />
        <span className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-xs">Verifying session…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Not logged in — send to login, preserve intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Super admin can bypass role restrictions — sees everything
  if (user?.role === 'super_admin') {
    return <Outlet />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Wrong role — redirect to their home
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return <Outlet />;
}
