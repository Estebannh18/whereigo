// frontend/src/components/RouteSearch.tsx
import { useEffect, useMemo, useState } from 'react';
import { httpClient } from '../lib/httpClient';
import { formatCOP, formatMinutes, routeColors, routeTypeLabels } from '../lib/routeStyle';
import { EmptyState, Icon, IconName, Notice, RouteTypeIcon, Spinner } from './ui';

export type RoutePreference = 'cheapest' | 'fastest' | 'fewest_transfers';
type TransportMode = 'all' | 'bus' | 'taxi';

export interface RouteOption {
  id: string;
  type: 'bus' | 'taxi' | 'mixed';
  name: string;
  estimatedFare: number;
  estimatedEtaMinutes: number;
  transfers: number;
  walkingDistanceKm: number;
  totalDistanceKm: number;
  path: Array<{ lat: number; lon: number; type: 'stop' | 'walk' | 'origin' | 'destination' | 'transfer'; label?: string }>;
  instructions: string[];
  routeIds: string[];
  incidentWarning?: string;
}

interface AiPrediction {
  eta_minutes: number;
  fare_cop: number;
  distance_km: number;
  avg_congestion: number;
  is_peak_hour: boolean;
  is_rainy: boolean;
  has_incident: boolean;
}

export interface EnrichedRouteOption extends RouteOption {
  aiEta?: number;
  aiFare?: number;
}

interface RouteSearchProps {
  origin: { lat: number; lon: number } | null;
  destination: { lat: number; lon: number } | null;
  selectionMode: 'origin' | 'destination' | null;
  onSetSelectionMode: (mode: 'origin' | 'destination' | null) => void;
  onSelectRoute: (route: EnrichedRouteOption | null) => void;
  selectedRoute: EnrichedRouteOption | null;
  incidentOnRoute?: boolean;
  /** Notifica las opciones visibles (según el filtro) para dibujarlas en el mapa. */
  onResultsChange?: (routes: EnrichedRouteOption[]) => void;
}

const preferenceOptions: Array<{ value: RoutePreference; label: string; icon: IconName }> = [
  { value: 'cheapest', label: 'Más barato', icon: 'star' },
  { value: 'fastest', label: 'Más rápido', icon: 'clock' },
  { value: 'fewest_transfers', label: 'Menos transbordos', icon: 'route' },
];

const modeLabels: Record<TransportMode, string> = { all: 'Todas', bus: 'Solo buses', taxi: 'Solo taxi' };

export function RouteSearch({
  origin,
  destination,
  selectionMode,
  onSetSelectionMode,
  onSelectRoute,
  selectedRoute,
  incidentOnRoute = false,
  onResultsChange,
}: RouteSearchProps) {
  const [preference, setPreference] = useState<RoutePreference>(() => {
    return (localStorage.getItem('whereigo_preference') as RoutePreference) ?? 'fastest';
  });
  const [departureTime, setDepartureTime] = useState<string>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [results, setResults] = useState<EnrichedRouteOption[]>([]);
  const [transportMode, setTransportMode] = useState<TransportMode>('all');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleResults = useMemo(
    () => results.filter((route) => transportMode === 'all' || route.type === transportMode),
    [results, transportMode],
  );

  useEffect(() => {
    localStorage.setItem('whereigo_preference', preference);
  }, [preference]);

  useEffect(() => {
    onResultsChange?.(visibleResults);
  }, [visibleResults, onResultsChange]);

  const handleSearch = async () => {
    if (!origin || !destination) {
      setError('Selecciona origen y destino en el mapa.');
      return;
    }
    setError(null);
    setLoading(true);
    setResults([]);
    onSelectRoute(null);

    try {
      const { data: routeOptions } = await httpClient.get<RouteOption[]>('/routes/route-search', {
        params: {
          originLat: origin.lat,
          originLon: origin.lon,
          destinationLat: destination.lat,
          destinationLon: destination.lon,
          preference,
          departureTime,
        },
      });

      const enriched = await Promise.all(
        routeOptions.map(async (option) => {
          try {
            const { data: prediction } = await httpClient.post<AiPrediction>('/ai/predict', {
              origin_lat: origin.lat,
              origin_lon: origin.lon,
              destination_lat: destination.lat,
              destination_lon: destination.lon,
              departure_time: departureTime,
            });
            return {
              ...option,
              aiEta: prediction.eta_minutes,
              // Taxi uses the regulated route-service calculation; AI remains
              // responsible for ETA and does not replace that fare.
              aiFare: option.type === 'bus' || option.type === 'taxi' ? option.estimatedFare : prediction.fare_cop,
            };
          } catch {
            return option;
          }
        }),
      );

      setResults(enriched);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error buscando rutas.');
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  };

  return (
    <div className="space-y-5">
      {/* Origen y destino */}
      <div className="relative rounded-2xl border border-slate-200 bg-slate-50/70 p-1.5">
        <span className="absolute bottom-[30px] left-[25px] top-[30px] border-l-2 border-dotted border-slate-300" aria-hidden="true" />
        <PointPicker
          kind="origin"
          value={origin}
          active={selectionMode === 'origin'}
          onClick={() => onSetSelectionMode(selectionMode === 'origin' ? null : 'origin')}
        />
        <div className="ml-11 border-t border-slate-200" />
        <PointPicker
          kind="destination"
          value={destination}
          active={selectionMode === 'destination'}
          onClick={() => onSetSelectionMode(selectionMode === 'destination' ? null : 'destination')}
        />
      </div>

      {/* Prioridad */}
      <fieldset>
        <legend className="field-label">Prioridad</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Prioridad">
          {preferenceOptions.map((option) => {
            const active = preference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPreference(option.value)}
                className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11.5px] font-semibold leading-tight transition sm:text-xs ${
                  active ? 'bg-white text-brand-700 shadow-card' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon name={option.icon} className="h-4 w-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="departure-time" className="field-label">
          Hora de salida
        </label>
        <input
          id="departure-time"
          type="datetime-local"
          value={departureTime}
          onChange={(e) => setDepartureTime(e.target.value)}
          className="field-input"
        />
      </div>

      <button onClick={handleSearch} disabled={loading || !origin || !destination} className="btn-primary w-full py-3">
        {loading ? <Spinner /> : <Icon name="search" />}
        {loading ? 'Buscando...' : 'Buscar rutas'}
      </button>
      {!origin || !destination ? (
        <p className="-mt-2 text-center text-xs text-slate-500">Marca el origen y el destino en el mapa para buscar.</p>
      ) : null}

      {error && <Notice tone="error">{error}</Notice>}

      {loading && (
        <div className="space-y-3" aria-label="Cargando rutas">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 p-4">
              <div className="skeleton mb-3 h-4 w-1/2" />
              <div className="grid grid-cols-3 gap-3">
                <div className="skeleton h-8" />
                <div className="skeleton h-8" />
                <div className="skeleton h-8" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && hasSearched && !error && results.length === 0 && (
        <EmptyState icon="route" title="No encontramos rutas">
          Prueba con otro origen o destino, o cambia la hora de salida.
        </EmptyState>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="section-title">Rutas sugeridas</h3>
            <span className="text-xs text-slate-500">
              {visibleResults.length} de {results.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar tipo de transporte">
            {(['all', 'bus', 'taxi'] as TransportMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={transportMode === mode}
                onClick={() => setTransportMode(mode)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  transportMode === mode
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {mode !== 'all' && <RouteTypeIcon type={mode} className="h-3.5 w-3.5" />}
                {modeLabels[mode]}
              </button>
            ))}
          </div>

          {incidentOnRoute && (
            <Notice tone="warning">Hay un incidente cerca de esta ruta. Puedes elegir otra opción calculada.</Notice>
          )}
          {incidentOnRoute && selectedRoute && visibleResults.some((route) => route.id !== selectedRoute.id) && (
            <button
              type="button"
              onClick={() => onSelectRoute(visibleResults.find((route) => route.id !== selectedRoute.id) ?? null)}
              className="btn w-full bg-amber-500 text-white shadow-sm hover:bg-amber-600 focus-visible:ring-amber-500/30"
            >
              <Icon name="route" />
              Calcular ruta alternativa
            </button>
          )}

          <div className="space-y-2.5">
            {visibleResults.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                selected={selectedRoute?.id === route.id}
                onClick={() => onSelectRoute(route)}
              />
            ))}
          </div>
          {visibleResults.length === 0 && <EmptyState icon="search" title="No hay opciones para este filtro." />}
          {visibleResults.length > 1 && (
            <p className="text-center text-xs text-slate-400">También puedes tocar una línea en el mapa para elegirla.</p>
          )}
        </div>
      )}
    </div>
  );
}

function PointPicker({
  kind,
  value,
  active,
  onClick,
}: {
  kind: 'origin' | 'destination';
  value: { lat: number; lon: number } | null;
  active: boolean;
  onClick: () => void;
}) {
  const isOrigin = kind === 'origin';
  const label = isOrigin ? 'Origen' : 'Destino';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
        active ? 'bg-white ring-2 ring-brand-500' : 'hover:bg-white'
      }`}
    >
      <span
        className={`z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-white text-[11px] font-bold text-white shadow-card ${
          isOrigin ? 'bg-brand-900' : 'bg-red-600'
        }`}
      >
        {isOrigin ? 'A' : 'B'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`block truncate text-sm ${value || active ? 'font-medium text-slate-900' : 'text-slate-500'}`}>
          {active ? (
            <span className="inline-flex items-center gap-1.5 text-brand-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
              Haz clic en el mapa…
            </span>
          ) : value ? (
            `${value.lat.toFixed(5)}, ${value.lon.toFixed(5)}`
          ) : (
            `Elegir ${label.toLowerCase()} en el mapa`
          )}
        </span>
      </span>
      <Icon name="crosshair" className={`h-4 w-4 shrink-0 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
    </button>
  );
}

function RouteCard({ route, selected, onClick }: { route: EnrichedRouteOption; selected: boolean; onClick: () => void }) {
  const color = routeColors[route.type];
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative w-full overflow-hidden rounded-2xl border bg-white p-4 pl-5 text-left transition ${
        selected ? 'border-brand-500 shadow-float ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300 hover:shadow-card'
      }`}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: color, opacity: selected ? 1 : 0.55 }} aria-hidden="true" />
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: color }}>
          <RouteTypeIcon type={route.type} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-slate-900">{route.name}</span>
          <span className="block text-xs text-slate-500">
            {routeTypeLabels[route.type]}
            {route.transfers > 0 ? ` · ${route.transfers} transbordo(s)` : ' · Directo'}
          </span>
        </span>
        {selected && (
          <span className="chip bg-brand-600 text-white">
            <Icon name="check" className="h-3 w-3" />
            Elegida
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
        <div>
          <p className="text-[11px] text-slate-500">Tarifa</p>
          <p className="font-semibold text-slate-900">{formatCOP(route.aiFare ?? route.estimatedFare)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            Tiempo
            {route.aiEta !== undefined && (
              <span className="inline-flex items-center text-brand-600" title="Tiempo estimado por el servicio de IA">
                <Icon name="sparkles" className="h-3 w-3" />
              </span>
            )}
          </p>
          <p className="font-semibold text-slate-900">{formatMinutes(route.aiEta ?? route.estimatedEtaMinutes)}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">Distancia</p>
          <p className="font-semibold text-slate-900">{route.totalDistanceKm.toFixed(2)} km</p>
        </div>
      </div>
      {route.walkingDistanceKm > 0 && (
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
          <Icon name="walk" className="h-3.5 w-3.5" />
          {route.walkingDistanceKm.toFixed(2)} km a pie
        </p>
      )}
      {route.incidentWarning && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          <Icon name="alert" className="mt-px h-3.5 w-3.5 shrink-0" />
          {route.incidentWarning}
        </p>
      )}
    </button>
  );
}
