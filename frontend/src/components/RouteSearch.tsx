// frontend/src/components/RouteSearch.tsx
import { useEffect, useState } from 'react';
import { httpClient } from '../lib/httpClient';

export type RoutePreference = 'cheapest' | 'fastest' | 'fewest_transfers';

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
}

const preferenceLabels: Record<RoutePreference, string> = {
  cheapest: 'Más barato',
  fastest: 'Más rápido',
  fewest_transfers: 'Menos transbordos',
};

const typeLabels: Record<RouteOption['type'], string> = {
  bus: 'Bus',
  taxi: 'Taxi',
  mixed: 'Combinado',
};

function formatCOP(value: number): string {
  return `$${Math.round(value).toLocaleString('es-CO')} COP`;
}

function formatMinutes(value: number): string {
  return `${Math.round(value)} min`;
}

export function RouteSearch({
  origin,
  destination,
  selectionMode,
  onSetSelectionMode,
  onSelectRoute,
  selectedRoute,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('whereigo_preference', preference);
  }, [preference]);

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
              aiFare: typeLabels[option.type] === 'Bus' ? option.estimatedFare : prediction.fare_cop,
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
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Origen</label>
          <button
            type="button"
            onClick={() => onSetSelectionMode('origin')}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
              selectionMode === 'origin'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-300 bg-white text-slate-600'
            }`}
          >
            {origin ? `${origin.lat.toFixed(5)}, ${origin.lon.toFixed(5)}` : 'Haz clic en el mapa'}
          </button>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Destino</label>
          <button
            type="button"
            onClick={() => onSetSelectionMode('destination')}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
              selectionMode === 'destination'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-300 bg-white text-slate-600'
            }`}
          >
            {destination ? `${destination.lat.toFixed(5)}, ${destination.lon.toFixed(5)}` : 'Haz clic en el mapa'}
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Prioridad</label>
          <select
            value={preference}
            onChange={(e) => setPreference(e.target.value as RoutePreference)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="cheapest">{preferenceLabels.cheapest}</option>
            <option value="fastest">{preferenceLabels.fastest}</option>
            <option value="fewest_transfers">{preferenceLabels.fewest_transfers}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Hora de salida</label>
          <input
            type="datetime-local"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        onClick={handleSearch}
        disabled={loading || !origin || !destination}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300"
      >
        {loading ? 'Buscando...' : 'Buscar rutas'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Rutas sugeridas</h3>
          {results.map((route) => (
            <button
              key={route.id}
              onClick={() => onSelectRoute(route)}
              className={`w-full rounded-lg border p-4 text-left transition ${
                selectedRoute?.id === route.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-slate-900">{route.name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {typeLabels[route.type]}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Tarifa</p>
                  <p className="font-semibold text-slate-800">{formatCOP(route.aiFare ?? route.estimatedFare)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Tiempo</p>
                  <p className="font-semibold text-slate-800">{formatMinutes(route.aiEta ?? route.estimatedEtaMinutes)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Distancia</p>
                  <p className="font-semibold text-slate-800">{route.totalDistanceKm.toFixed(2)} km</p>
                </div>
              </div>
              {route.transfers > 0 && (
                <p className="mt-2 text-xs text-slate-500">{route.transfers} transbordo(s)</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
