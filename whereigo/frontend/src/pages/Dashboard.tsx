// frontend/src/pages/Dashboard.tsx
// Placeholder de la Fase 1: valida que la sesión y el guard de roles funcionan
// de punta a punta. El mapa y la búsqueda de rutas se agregan en la Fase 2.
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Whereigo?</h1>
        <button onClick={logout} className="text-sm text-slate-500 underline">
          Cerrar sesión
        </button>
      </header>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Sesión iniciada como</p>
        <p className="text-lg font-medium text-slate-900">{user?.email}</p>
        <span className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
          {user?.role}
        </span>
        <p className="mt-6 text-sm text-slate-400">
          El buscador de rutas multimodales (mapa, paraderos, tarifas y ETA) se agrega en las próximas fases.
        </p>
      </div>
    </div>
  );
}
