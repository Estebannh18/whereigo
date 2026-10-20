// frontend/src/pages/Dashboard.tsx
// Dashboard con búsqueda de rutas A→B, ETA/tarifa y alertas en tiempo real.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { httpClient } from '../lib/httpClient';
import { MapView, TrafficReading, Alert, MapRoute } from '../components/MapView';
import { EnrichedRouteOption, RouteSearch } from '../components/RouteSearch';
import { FrequentRoutes, SavedRoute } from '../components/FrequentRoutes';
import { AppHeader } from '../components/AppHeader';
import { EmptyState, Icon, Notice } from '../components/ui';
import {
  ALERT_RADIUS_KM,
  routeColors,
  routeTypeLabels,
  severityChipClass,
  severityColors,
  severityLabels,
} from '../lib/routeStyle';

interface TrafficResponse {
  data: TrafficReading[];
}

interface AlertResponse {
  data: Alert[];
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
  const [traffic, setTraffic] = useState<TrafficReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Hora de la última consulta exitosa: evita mostrar el esqueleto de carga en cada sondeo de 5 s.
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<EnrichedRouteOption | null>(null);
  const [routeOptions, setRouteOptions] = useState<EnrichedRouteOption[]>([]);
  const [selectionMode, setSelectionMode] = useState<'origin' | 'destination' | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lon: number } | null>(null);
  const [focusPoint, setFocusPoint] = useState<{ lat: number; lon: number; key: number } | null>(null);

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
        setLastUpdated(new Date());
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

  const handleSelectRoute = useCallback((route: EnrichedRouteOption | null) => {
    setSelectedRoute(route);
    if (route?.path[0]) setOrigin({ lat: route.path[0].lat, lon: route.path[0].lon });
    const last = route?.path[route.path.length - 1];
    if (last) setDestination({ lat: last.lat, lon: last.lon });
  }, []);

  const handleSelectAlternative = useCallback(
    (id: string) => {
      const route = routeOptions.find((r) => r.id === id);
      if (route) handleSelectRoute(route);
    },
    [routeOptions, handleSelectRoute],
  );

  const routePath = selectedRoute?.path;
  const alertsNearRoute = useMemo(
    () =>
      new Set(
        routePath
          ? alerts
              .filter((alert) =>
                routePath.some((point) => distanceKm(point, { lat: Number(alert.latitude), lon: Number(alert.longitude) }) <= ALERT_RADIUS_KM),
              )
              .map((alert) => alert.id)
          : [],
      ),
    [alerts, routePath],
  );
  const incidentOnRoute = alertsNearRoute.size > 0;

  const mapSelected: MapRoute | null = useMemo(
    () => (selectedRoute ? { id: selectedRoute.id, type: selectedRoute.type, path: selectedRoute.path } : null),
    [selectedRoute],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Mapa: arriba en móvil, a la derecha y fijo en escritorio */}
        <div className="relative lg:order-2 lg:flex-1">
          <div className="lg:sticky lg:top-16">
            <MapView
              traffic={traffic}
              alerts={alerts}
              selectionMode={selectionMode}
              onSelectPoint={handleMapClick}
              origin={origin}
              destination={destination}
              selectedRoute={mapSelected}
              alternatives={routeOptions}
              onSelectAlternative={handleSelectAlternative}
              focusPoint={focusPoint}
              className="h-[58vh] min-h-[340px] lg:h-[calc(100vh-4rem)]"
            >
              <MapStatus
                selectionMode={selectionMode}
                onCancelSelection={() => setSelectionMode(null)}
                alertCount={alerts.length}
                hasError={Boolean(error)}
              />
              <MapLegend />
            </MapView>
          </div>
        </div>

        {/* Panel lateral */}
        <aside className="w-full border-slate-200 bg-white lg:order-1 lg:w-[420px] lg:shrink-0 lg:border-r xl:w-[440px]">
          <div className="divide-y divide-slate-100">
            <section className="px-4 py-6 sm:px-6" aria-labelledby="plan-title">
              <h1 id="plan-title" className="text-xl font-extrabold text-slate-900">
                Planifica tu ruta
              </h1>
              <p className="mb-5 mt-1 text-sm text-slate-500">Elige origen y destino en el mapa y compara opciones.</p>
              <RouteSearch
                origin={origin}
                destination={destination}
                selectionMode={selectionMode}
                onSetSelectionMode={setSelectionMode}
                onSelectRoute={handleSelectRoute}
                selectedRoute={selectedRoute}
                incidentOnRoute={incidentOnRoute}
                onResultsChange={setRouteOptions}
              />
            </section>

            {selectedRoute && (
              <section className="px-4 py-6 sm:px-6" aria-labelledby="steps-title">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 id="steps-title" className="section-title">
                    Indicaciones
                  </h2>
                  <span className="chip text-white" style={{ background: routeColors[selectedRoute.type] }}>
                    {routeTypeLabels[selectedRoute.type]} · {selectedRoute.name}
                  </span>
                </div>
                <ol className="relative space-y-4">
                  {selectedRoute.instructions.map((step, idx) => (
                    <li key={idx} className="relative flex gap-3">
                      {idx < selectedRoute.instructions.length - 1 && (
                        <span className="absolute left-[11px] top-7 h-[calc(100%-12px)] w-0.5 bg-slate-200" aria-hidden="true" />
                      )}
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 ring-1 ring-brand-200">
                        {idx + 1}
                      </span>
                      <p className="pt-0.5 text-sm leading-relaxed text-slate-700">{step}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <div className="px-4 py-6 sm:px-6">
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

            <section id="alertas" className="px-4 py-6 sm:px-6" aria-labelledby="alerts-title">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="alerts-title" className="section-title">
                  Alertas de tráfico activas
                </h2>
                <span className="flex items-center gap-1.5 text-xs text-slate-400" title="Actualizando cada 5 segundos">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  {lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString('es-CO')}` : 'Actualizando cada 5 s'}
                </span>
              </div>

              {isLoading && !lastUpdated && !error && (
                <div className="space-y-2" aria-label="Cargando alertas">
                  <div className="skeleton h-16" />
                  <div className="skeleton h-16" />
                </div>
              )}

              {error && <Notice tone="error">{error}</Notice>}

              {lastUpdated && alerts.length === 0 && !error && (
                <EmptyState icon="check" title="No hay alertas activas en este momento.">
                  El tráfico de la ciudad fluye sin incidentes reportados.
                </EmptyState>
              )}

              <ul className="space-y-2">
                {alerts.map((alert) => (
                  <li key={alert.id}>
                    <button
                      type="button"
                      onClick={() => setFocusPoint({ lat: Number(alert.latitude), lon: Number(alert.longitude), key: Date.now() })}
                      className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-3 pl-4 text-left transition hover:border-slate-300 hover:shadow-card"
                      title="Ver en el mapa"
                    >
                      <span className="absolute inset-y-0 left-0 w-1" style={{ background: severityColors[alert.severity] }} aria-hidden="true" />
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{alertTypeLabel(alert.alertType)}</span>
                        <span className="text-xs text-slate-400">· {alert.segmentId}</span>
                        <span className={`chip ml-auto ${severityChipClass[alert.severity]}`}>{severityLabels[alert.severity]}</span>
                      </div>
                      <p className="text-sm text-slate-600">{alert.message}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                        <span>{new Date(alert.createdAt).toLocaleString('es-CO')}</span>
                        {alertsNearRoute.has(alert.id) && (
                          <span className="chip bg-amber-100 text-amber-800">
                            <Icon name="alert" className="h-3 w-3" />
                            Cerca de tu ruta
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MapStatus({
  selectionMode,
  onCancelSelection,
  alertCount,
  hasError,
}: {
  selectionMode: 'origin' | 'destination' | null;
  onCancelSelection: () => void;
  alertCount: number;
  hasError: boolean;
}) {
  if (selectionMode) {
    return (
      <div className="absolute inset-x-3 top-3 z-10 flex justify-center sm:inset-x-auto sm:left-3">
        <div className="flex items-center gap-3 rounded-xl bg-slate-900/90 py-2 pl-3.5 pr-2 text-sm text-white shadow-float backdrop-blur">
          <span className={`h-2.5 w-2.5 animate-pulse rounded-full ${selectionMode === 'origin' ? 'bg-brand-300' : 'bg-red-400'}`} />
          Haz clic en el mapa para fijar el {selectionMode === 'origin' ? 'origen' : 'destino'}
          <button type="button" onClick={onCancelSelection} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/20">
            Cancelar
          </button>
        </div>
      </div>
    );
  }
  return (
    <a
      href="#alertas"
      className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-float backdrop-blur hover:bg-white"
    >
      <span className={`h-2 w-2 rounded-full ${hasError ? 'bg-slate-400' : alertCount > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
      {hasError ? 'Sin conexión con tráfico' : alertCount > 0 ? `${alertCount} alerta${alertCount === 1 ? '' : 's'} activa${alertCount === 1 ? '' : 's'}` : 'Tráfico en vivo · sin alertas'}
    </a>
  );
}

function MapLegend() {
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 640);
  return (
    <div className="absolute bottom-10 left-3 z-10 max-w-[calc(100%-6rem)] sm:bottom-3">
      {open ? (
        <div className="rounded-xl bg-white/95 p-3 text-[11px] text-slate-600 shadow-float backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Leyenda</span>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label="Ocultar leyenda">
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
            {(['bus', 'taxi', 'mixed'] as const).map((type) => (
              <span key={type} className="flex items-center gap-2">
                <span className="h-1.5 w-5 rounded-full ring-2 ring-white" style={{ background: routeColors[type] }} />
                {routeTypeLabels[type]}
              </span>
            ))}
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-5 rounded-full bg-slate-400/60" />
              Alternativa
            </span>
            <span className="flex items-center gap-2">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white">!</span>
              Alerta (750 m)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-green-600 ring-1 ring-white" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-1 ring-white" />
              <span className="h-2.5 w-2.5 rounded-full bg-red-600 ring-1 ring-white" />
              <span className="ml-1">Congestión</span>
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-float hover:bg-white"
        >
          <Icon name="map" className="h-3.5 w-3.5" />
          Leyenda
        </button>
      )}
    </div>
  );
}
