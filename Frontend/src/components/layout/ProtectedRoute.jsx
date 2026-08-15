/* ============================================================
   ProtectedRoute — gates the workspace / history / leaderboard
   behind a signed-in session, remembering the intended path.
   ============================================================ */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';

export function ProtectedRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return children;
}
