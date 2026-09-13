// frontend/src/components/PrivateRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';

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
    return <div className="flex h-screen items-center justify-center text-slate-500">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
