// frontend/src/pages/Dashboard.tsx
// Dashboard con búsqueda de rutas A→B, ETA/tarifa y alertas en tiempo real.
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { httpClient } from '../lib/httpClient';
import { MapView, TrafficReading, Alert, RoutePoint } from '../components/MapView';
import { EnrichedRouteOption, RouteSearch } from '../components/RouteSearch';
import { FrequentRoutes, SavedRoute } from '../components/FrequentRoutes';

interface TrafficResponse {
  data: TrafficReading[];
}

interface AlertResponse {
  data: Alert[];
}

function severityLabel(severity: Alert['severity']): string {
  const map = { low: 'Baja', medium: 'Media', high: 'Alta' };
  return map[severity];
}

function severityClass(severity: Alert['severity']): string {
  const map = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700',
  };
  return map[severity];
}

function alertTypeLabel(type: Alert['alertType']): string {
  return type === 'incident' ? 'Incidente' : 'Ruta afectada';
}

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [traffic, setTraffic] = useState<TrafficReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<EnrichedRouteOption | null>(null);
  const [selectionMode, setSelectionMode] = useState<'origin' | 'destination' | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [trafficRes, alertsRes] = await Promise.all([
          httpClient.get<TrafficResponse>('/traffic/current'),
          httpClient.get<AlertResponse>('/alerts/active'),
        ]);
        setTraffic(trafficRes.data.data);
        setAlerts(alertsRes.data.data);
        setError(null);
      } catch {
        setError('No se pudieron cargar los datos de tráfico o alertas.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleMapClick = (lat: number, lon: number) => {
    if (selectionMode === 'origin') {
      setOrigin({ lat, lon });
      setSelectionMode(null);
    } else if (selectionMode === 'destination') {
      setDestination({ lat, lon });
      setSelectionMode(null);
    }
  };

  const routePath: RoutePoint[] | undefined = selectedRoute?.path;
  const incidentOnRoute = Boolean(
    routePath?.some((point) =>
      alerts.some((alert) => distanceKm(point, { lat: Number(alert.latitude), lon: Number(alert.longitude) }) <= 0.75),
    ),
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Whereigo?</h1>
        <button onClick={logout} className="text-sm text-slate-500 underline">
          Cerrar sesión
        </button>
      </header>

      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Sesión iniciada como</p>
        <p className="text-lg font-medium text-slate-900">{user?.email}</p>
        <span className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
          {user?.role}
        </span>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MapView
            traffic={traffic}
            alerts={alerts}
            selectionMode={selectionMode}
            onSelectPoint={handleMapClick}
            origin={origin}
            destination={destination}
            routePath={routePath}
          />
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Planifica tu ruta</h2>
          <RouteSearch
            origin={origin}
            destination={destination}
            selectionMode={selectionMode}
            onSetSelectionMode={setSelectionMode}
            onSelectRoute={(route) => {
              setSelectedRoute(route);
              if (route?.path[0]) setOrigin({ lat: route.path[0].lat, lon: route.path[0].lon });
              const last = route?.path[route.path.length - 1];
              if (last) setDestination({ lat: last.lat, lon: last.lon });
            }}
            selectedRoute={selectedRoute}
            incidentOnRoute={incidentOnRoute}
          />

          {selectedRoute && (
            <div className="mt-6 rounded-lg border border-slate-200 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Indicaciones</h3>
              <ol className="list-decimal space-y-1 pl-4 text-sm text-slate-700">
                {selectedRoute.instructions.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-6">
            <FrequentRoutes
              currentRoute={selectedRoute}
              origin={origin}
              destination={destination}
              onSelect={(saved: SavedRoute) => {
                setOrigin(saved.origin);
                setDestination(saved.destination);
                setSelectedRoute(null);
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Alertas de tráfico activas</h2>
          <span className="text-sm text-slate-400">Actualizando cada 5 segundos</span>
        </div>

        {isLoading && alerts.length === 0 && <p className="text-sm text-slate-500">Cargando alertas...</p>}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!isLoading && alerts.length === 0 && !error && (
          <p className="text-sm text-slate-500">No hay alertas activas en este momento.</p>
        )}

        <ul className="space-y-3">
          {alerts.map((alert) => (
            <li key={alert.id} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                  {alertTypeLabel(alert.alertType)} · {alert.segmentId}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityClass(
                    alert.severity,
                  )}`}
                >
                  {severityLabel(alert.severity)}
                </span>
              </div>
              <p className="text-sm text-slate-600">{alert.message}</p>
              <p className="mt-2 text-xs text-slate-400">
                {new Date(alert.createdAt).toLocaleString('es-CO')}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
