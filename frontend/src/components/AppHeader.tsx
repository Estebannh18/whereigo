// frontend/src/components/AppHeader.tsx
// Barra superior de las pantallas autenticadas: logo, navegación por rol y sesión.
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icon, Logo } from './ui';

export function AppHeader() {
  const { user, logout } = useAuth();
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <NavLink to="/" aria-label="Whereigo? inicio">
          <Logo />
        </NavLink>

        {user?.role === 'admin' && (
          <nav className="ml-2 hidden items-center gap-1 sm:ml-6 sm:flex" aria-label="Principal">
            <NavLink to="/" end className={navClass}>
              <Icon name="map" />
              Mapa
            </NavLink>
            <NavLink to="/admin" className={navClass}>
              <Icon name="shield" />
              Administración
            </NavLink>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-[11px] leading-tight text-slate-500">Sesión iniciada como</p>
            <p className="max-w-[220px] truncate text-sm font-semibold leading-tight text-slate-900" title={user?.email}>
              {user?.email}
            </p>
          </div>
          <span
            className={`chip uppercase tracking-wide ${user?.role === 'admin' ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600'}`}
            title="Rol"
          >
            {user?.role}
          </span>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className="btn-ghost px-2.5 sm:hidden" aria-label="Administración">
              <Icon name="shield" />
            </NavLink>
          )}
          <button onClick={logout} className="btn-ghost px-2.5 sm:px-3" aria-label="Cerrar sesión">
            <Icon name="logout" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </header>
  );
}
