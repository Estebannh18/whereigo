// frontend/src/components/FrequentRoutes.tsx
import { useEffect, useState } from 'react';
import { EnrichedRouteOption } from './RouteSearch';

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
    persist([saved, ...filtered].slice(0, 10));
  };

  const remove = (id: string) => {
    persist(routes.filter((r) => r.id !== id));
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Rutas frecuentes</h2>
        {currentRoute && (
          <button
            onClick={saveCurrent}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
          >
            Guardar ruta actual
          </button>
        )}
      </div>

      {routes.length === 0 ? (
        <p className="text-sm text-slate-500">No tienes rutas guardadas.</p>
      ) : (
        <ul className="space-y-3">
          {routes.map((route) => (
            <li key={route.id} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-slate-900">{route.name}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-600">
                  {route.type}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                ${Math.round(route.estimatedFare).toLocaleString('es-CO')} · {Math.round(route.estimatedEtaMinutes)} min
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onSelect(route)}
                  className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700"
                >
                  Usar ruta
                </button>
                <button
                  onClick={() => remove(route.id)}
                  className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
