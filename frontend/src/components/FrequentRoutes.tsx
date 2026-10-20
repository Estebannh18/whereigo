// frontend/src/components/FrequentRoutes.tsx
import { useEffect, useState } from 'react';
import { EnrichedRouteOption } from './RouteSearch';
import { formatCOP, formatMinutes, routeColors, routeTypeLabels } from '../lib/routeStyle';
import { EmptyState, Icon, RouteTypeIcon } from './ui';

export interface SavedRoute {
  id: string;
  name: string;
  type: 'bus' | 'taxi' | 'mixed';
  origin: { lat: number; lon: number };
  destination: { lat: number; lon: number };
  estimatedFare: number;
  estimatedEtaMinutes: number;
  savedAt: string;
}

interface FrequentRoutesProps {
  currentRoute: EnrichedRouteOption | null;
  origin: { lat: number; lon: number } | null;
  destination: { lat: number; lon: number } | null;
  onSelect: (route: SavedRoute) => void;
}

const STORAGE_KEY = 'whereigo_frequent_routes';
const MAX_ROUTES = 10;

function savedAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export function FrequentRoutes({ currentRoute, origin, destination, onSelect }: FrequentRoutesProps) {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setRoutes(JSON.parse(saved));
      } catch {
        setRoutes([]);
      }
    }
  }, []);

  const persist = (updated: SavedRoute[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setRoutes(updated);
  };

  const saveCurrent = () => {
    if (!currentRoute || !origin || !destination) return;
    const saved: SavedRoute = {
      id: currentRoute.id,
      name: currentRoute.name,
      type: currentRoute.type,
      origin,
      destination,
      estimatedFare: currentRoute.aiFare ?? currentRoute.estimatedFare,
      estimatedEtaMinutes: currentRoute.aiEta ?? currentRoute.estimatedEtaMinutes,
      savedAt: new Date().toISOString(),
    };
    const filtered = routes.filter((r) => r.id !== saved.id);
    persist([saved, ...filtered].slice(0, MAX_ROUTES));
  };

  const remove = (id: string) => {
    persist(routes.filter((r) => r.id !== id));
  };

  return (
    <section aria-labelledby="frequent-routes-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 id="frequent-routes-title" className="section-title">
            Rutas frecuentes
          </h2>
          <span className="text-xs text-slate-400">
            {routes.length}/{MAX_ROUTES}
          </span>
        </div>
        {currentRoute && (
          <button onClick={saveCurrent} className="btn-secondary px-3 py-1.5 text-xs">
            <Icon name="star" className="h-3.5 w-3.5 text-amber-500" />
            Guardar ruta actual
          </button>
        )}
      </div>

      {routes.length === 0 ? (
        <EmptyState icon="star" title="No tienes rutas guardadas.">
          Elige una ruta y pulsa «Guardar ruta actual» para tenerla a mano.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {routes.map((route) => (
            <li key={route.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ background: routeColors[route.type] }}
                title={routeTypeLabels[route.type]}
              >
                <RouteTypeIcon type={route.type} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{route.name}</p>
                <p className="text-xs text-slate-500">
                  {formatCOP(route.estimatedFare, false)} · {formatMinutes(route.estimatedEtaMinutes)} · {savedAgo(route.savedAt)}
                </p>
              </div>
              <button onClick={() => onSelect(route)} className="btn bg-brand-50 px-3 py-1.5 text-xs text-brand-700 hover:bg-brand-100">
                Usar ruta
              </button>
              <button
                onClick={() => remove(route.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label={`Eliminar ${route.name}`}
                title="Eliminar"
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
