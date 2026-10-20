// frontend/src/components/PrivateRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import { Logo, Spinner } from './ui';

interface PrivateRouteProps {
  /** Si se omite, solo exige estar autenticado (cualquier rol). */
  allowedRoles?: UserRole[];
}

/**
 * Protege un subárbol de rutas. La validación real de autorización siempre ocurre
 * en el backend (guards de auth-service/api-gateway); esto solo evita que la UI
 * quede visible a un usuario sin sesión o con el rol equivocado.
 */
export function PrivateRoute({ allowedRoles }: PrivateRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-5 bg-surface-muted">
        <Logo />
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4 text-brand-600" />
          Cargando...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
