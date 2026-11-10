import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState } from './StateViews.jsx';

export function ProtectedRoute() {
  const { isAuthenticated, checking } = useAuth();
  const location = useLocation();

  if (checking) return <LoadingState label="Checking your session…" />;
  if (!isAuthenticated) return <Navigate to="/agent/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
