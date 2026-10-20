// frontend/src/components/MapView.tsx
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  NavigationControl,
  ScaleControl,
  LngLatBounds,
  GeoJSONSource,
  MapLayerMouseEvent,
  MapMouseEvent,
  StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ALERT_RADIUS_KM,
  RouteType,
  congestionColor,
  pointColors,
  routeColors,
  severityColors,
  severityLabels,
} from '../lib/routeStyle';

export interface TrafficReading {
  id: string;
  segmentId: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  congestionLevel: number;
  isPeakHour: boolean;
  isRainy: boolean;
  hasIncident: boolean;
  incidentType?: string;
  severity?: string;
  recordedAt: string;
}

export interface Alert {
  id: string;
  segmentId: string;
  alertType: 'incident' | 'route_affected';
  severity: 'low' | 'medium' | 'high';
  message: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

export interface RoutePoint {
  lat: number;
  lon: number;
  type: 'stop' | 'walk' | 'origin' | 'destination' | 'transfer';
  label?: string;
}

export interface MapRoute {
  id: string;
  type: RouteType;
  path: RoutePoint[];
}

interface MapViewProps {
  traffic?: TrafficReading[];
  alerts?: Alert[];
  /** Si está definido, el mapa permite seleccionar origen/destino mediante clics. */
  selectionMode?: 'origin' | 'destination' | null;
  onSelectPoint?: (lat: number, lon: number) => void;
  origin?: { lat: number; lon: number } | null;
  destination?: { lat: number; lon: number } | null;
  /** Ruta seleccionada: se dibuja resaltada sobre las alternativas. */
  selectedRoute?: MapRoute | null;
  /** Otras opciones calculadas; se dibujan atenuadas y se pueden elegir con un clic. */
  alternatives?: MapRoute[];
  onSelectAlternative?: (id: string) => void;
  /** Centra el mapa en un punto (p. ej. al tocar una alerta de la lista). */
  focusPoint?: { lat: number; lon: number; key: number } | null;
  className?: string;
  /** Capas de UI superpuestas al mapa (leyenda, avisos). */
  children?: ReactNode;
}

const BUCARAMANGA: [number, number] = [-73.1165, 7.1186];
// Estilo vectorial claro (OpenFreeMap Positron, sin API key) para que rutas y alertas destaquen.
const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
// Respaldo si el estilo vectorial no carga: teselas OSM con color atenuado.
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#f2f3f0' } },
    { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.75, 'raster-brightness-min': 0.12, 'raster-contrast': -0.1 } },
  ],
};
const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Polígono aproximado de un círculo de `radiusKm` alrededor de un punto. */
function circlePolygon(lat: number, lon: number, radiusKm: number, steps = 64): GeoJSON.Polygon {
  const coords: [number, number][] = [];
  const dLat = radiusKm / 110.574;
  const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    coords.push([lon + dLon * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

const warningSvg =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';

function alertElement(alert: Alert): HTMLElement {
  const color = severityColors[alert.severity];
  const el = document.createElement('div');
  el.className = 'relative flex h-9 w-9 cursor-pointer items-center justify-center';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `Alerta ${severityLabels[alert.severity]}: ${alert.message}`);
  el.innerHTML = `
    ${alert.severity !== 'low' ? `<span class="absolute inset-0 rounded-full animate-pulse-ring" style="background:${color}"></span>` : ''}
    <span class="relative flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white shadow-float" style="background:${color}">${warningSvg}</span>`;
  return el;
}

function alertPopupHtml(alert: Alert): string {
  const color = severityColors[alert.severity];
  return `<div class="max-w-[240px]">
    <div class="mb-1.5 flex items-center gap-2">
      <span class="inline-block h-2.5 w-2.5 rounded-full" style="background:${color}"></span>
      <strong class="text-sm text-slate-900">${alert.alertType === 'incident' ? 'Incidente' : 'Ruta afectada'}</strong>
      <span class="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style="background:${color}">${severityLabels[alert.severity]}</span>
    </div>
    <p class="text-[13px] leading-snug text-slate-700">${escapeHtml(alert.message)}</p>
    <p class="mt-1.5 text-[11px] text-slate-400">${escapeHtml(alert.segmentId)} · ${new Date(alert.createdAt).toLocaleString('es-CO')}</p>
  </div>`;
}

function trafficPopupHtml(reading: TrafficReading): string {
  const color = congestionColor(Number(reading.congestionLevel));
  return `<div class="min-w-[170px] text-[13px] text-slate-700">
    <strong class="mb-1 block text-sm text-slate-900">${escapeHtml(reading.segmentId)}</strong>
    <div class="flex justify-between gap-4"><span class="text-slate-500">Velocidad</span><span class="font-semibold">${escapeHtml(reading.speedKmh)} km/h</span></div>
    <div class="flex justify-between gap-4"><span class="text-slate-500">Congestión</span><span class="font-semibold" style="color:${color}">${escapeHtml(reading.congestionLevel)}%</span></div>
    ${reading.hasIncident ? `<p class="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">⚠️ Incidente: ${escapeHtml(reading.incidentType ?? 'otro')}</p>` : ''}
  </div>`;
}

function endpointElement(kind: 'origin' | 'destination'): HTMLElement {
  const el = document.createElement('div');
  if (kind === 'origin') {
    el.className = 'flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white text-[11px] font-bold text-white shadow-float';
    el.style.background = pointColors.origin;
    el.textContent = 'A';
  } else {
    el.className = 'flex h-10 w-8 items-start justify-center';
    el.innerHTML = `<svg viewBox="0 0 32 40" width="32" height="40" style="filter:drop-shadow(0 3px 4px rgba(16,24,40,.3))">
      <path d="M16 1.5C8.3 1.5 2 7.6 2 15.2 2 25.5 16 38.5 16 38.5S30 25.5 30 15.2C30 7.6 23.7 1.5 16 1.5z" fill="${pointColors.destination}" stroke="white" stroke-width="3"/>
      <text x="16" y="20" text-anchor="middle" font-family="Inter,sans-serif" font-size="12" font-weight="700" fill="white">B</text></svg>`;
  }
  el.setAttribute('aria-label', kind === 'origin' ? 'Origen' : 'Destino');
  return el;
}

function lineFeature(route: MapRoute, selected: boolean): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: { id: route.id, color: routeColors[route.type] ?? '#64748b', selected },
    geometry: { type: 'LineString', coordinates: route.path.map((p) => [p.lon, p.lat]) },
  };
}

export function MapView({
  traffic = [],
  alerts = [],
  selectionMode,
  onSelectPoint,
  origin,
  destination,
  selectedRoute,
  alternatives = [],
  onSelectAlternative,
  focusPoint,
  className = 'h-[500px]',
  children,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const alertMarkersRef = useRef(new Map<string, Marker>());
  const trafficMarkersRef = useRef(new Map<string, Marker>());
  const endpointMarkersRef = useRef<Marker[]>([]);
  const transferMarkersRef = useRef<Marker[]>([]);
  // Refs para que los handlers registrados una sola vez vean siempre los valores actuales.
  const selectionModeRef = useRef(selectionMode);
  const onSelectAlternativeRef = useRef(onSelectAlternative);
  selectionModeRef.current = selectionMode;
  onSelectAlternativeRef.current = onSelectAlternative;

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: BASEMAP_STYLE,
      center: BUCARAMANGA,
      zoom: 13,
      attributionControl: { compact: true },
    });

    map.addControl(new NavigationControl({ visualizePitch: false }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');

    let styleLoaded = false;
    map.once('style.load', () => {
      styleLoaded = true;
    });
    map.on('error', (e) => {
      // Si el estilo base falla antes de cargar, se usa el respaldo raster.
      if (!styleLoaded && !map.loaded()) {
        console.warn('Estilo base no disponible, usando respaldo OSM.', e.error?.message);
        styleLoaded = true;
        map.setStyle(FALLBACK_STYLE);
      }
    });

    map.on('load', () => {
      map.addSource('alert-zones', { type: 'geojson', data: EMPTY_FC });
      map.addSource('routes-alt', { type: 'geojson', data: EMPTY_FC });
      map.addSource('route-selected', { type: 'geojson', data: EMPTY_FC });
      map.addSource('route-stops', { type: 'geojson', data: EMPTY_FC });

      map.addLayer({
        id: 'alert-zones-fill',
        type: 'fill',
        source: 'alert-zones',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.06 },
      });
      map.addLayer({
        id: 'alert-zones-line',
        type: 'line',
        source: 'alert-zones',
        paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.45, 'line-dasharray': [2, 2] },
      });

      const round = { 'line-join': 'round', 'line-cap': 'round' } as const;
      const width = (base: number) => ['interpolate', ['linear'], ['zoom'], 10, base * 0.55, 14, base, 17, base * 1.6] as any;

      // Alternativas: más delgadas y atenuadas, con borde blanco para separarlas del mapa.
      map.addLayer({ id: 'routes-alt-casing', type: 'line', source: 'routes-alt', layout: round, paint: { 'line-color': '#ffffff', 'line-width': width(9) } });
      map.addLayer({
        id: 'routes-alt-line',
        type: 'line',
        source: 'routes-alt',
        layout: round,
        paint: { 'line-color': ['get', 'color'], 'line-width': width(5), 'line-opacity': 0.42 },
      });
      // Capa invisible más ancha para que sea fácil tocar una alternativa.
      map.addLayer({ id: 'routes-alt-hit', type: 'line', source: 'routes-alt', layout: round, paint: { 'line-color': '#000', 'line-width': 22, 'line-opacity': 0 } });

      // Ruta seleccionada: halo oscuro + borde blanco + color del tipo, siempre encima.
      map.addLayer({
        id: 'route-selected-halo',
        type: 'line',
        source: 'route-selected',
        layout: round,
        paint: { 'line-color': '#0f172a', 'line-width': width(17), 'line-opacity': 0.16, 'line-blur': 3 },
      });
      map.addLayer({ id: 'route-selected-casing', type: 'line', source: 'route-selected', layout: round, paint: { 'line-color': '#ffffff', 'line-width': width(12) } });
      map.addLayer({ id: 'route-selected-line', type: 'line', source: 'route-selected', layout: round, paint: { 'line-color': ['get', 'color'], 'line-width': width(7) } });

      map.addLayer({
        id: 'route-stops',
        type: 'circle',
        source: 'route-stops',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 5.5],
          'circle-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 15, 3],
          'circle-stroke-color': ['get', 'color'],
        },
      });

      map.on('click', 'routes-alt-hit', (e: MapLayerMouseEvent) => {
        if (selectionModeRef.current) return;
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelectAlternativeRef.current?.(String(id));
      });
      map.on('mouseenter', 'routes-alt-hit', () => {
        if (!selectionModeRef.current) map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'routes-alt-hit', () => {
        if (!selectionModeRef.current) map.getCanvas().style.cursor = '';
      });

      setMapReady(true);
    });

    mapRef.current = map;

    // El contenedor cambia de tamaño con el layout responsive: mantener el canvas ajustado.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(mapContainerRef.current);

    const alertMarkers = alertMarkersRef.current;
    const trafficMarkers = trafficMarkersRef.current;
    return () => {
      observer.disconnect();
      alertMarkers.clear();
      trafficMarkers.clear();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Listener de clics para modo selección.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectionMode || !onSelectPoint) return;

    const handler = (e: MapMouseEvent) => {
      onSelectPoint(e.lngLat.lat, e.lngLat.lng);
    };

    map.getCanvas().style.cursor = 'crosshair';
    map.on('click', handler);

    return () => {
      map.getCanvas().style.cursor = '';
      map.off('click', handler);
    };
  }, [selectionMode, onSelectPoint]);

  // Marcadores de origen (A) y destino (B).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    endpointMarkersRef.current.forEach((m) => m.remove());
    endpointMarkersRef.current = [];
    if (origin) {
      endpointMarkersRef.current.push(new Marker({ element: endpointElement('origin') }).setLngLat([origin.lon, origin.lat]).addTo(map));
    }
    if (destination) {
      endpointMarkersRef.current.push(
        new Marker({ element: endpointElement('destination'), anchor: 'bottom' }).setLngLat([destination.lon, destination.lat]).addTo(map),
      );
    }
  }, [origin, destination]);

  // Tráfico por segmento: se actualizan los marcadores existentes en lugar de recrearlos,
  // así un popup abierto no se cierra con cada consulta (cada 5 s).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const latestBySegment = new Map<string, TrafficReading>();
    traffic.forEach((reading) => {
      const existing = latestBySegment.get(reading.segmentId);
      if (!existing || new Date(reading.recordedAt) > new Date(existing.recordedAt)) {
        latestBySegment.set(reading.segmentId, reading);
      }
    });

    const markers = trafficMarkersRef.current;
    markers.forEach((marker, segmentId) => {
      if (!latestBySegment.has(segmentId)) {
        marker.remove();
        markers.delete(segmentId);
      }
    });

    latestBySegment.forEach((reading, segmentId) => {
      const color = congestionColor(Number(reading.congestionLevel));
      let marker = markers.get(segmentId);
      if (!marker) {
        const el = document.createElement('div');
        el.className = 'h-3.5 w-3.5 cursor-pointer rounded-full border-2 border-white shadow-card ring-1 ring-black/10';
        el.setAttribute('aria-label', `Tráfico ${segmentId}`);
        marker = new Marker({ element: el }).setLngLat([Number(reading.longitude), Number(reading.latitude)]).setPopup(new Popup({ offset: 10 })).addTo(map);
        markers.set(segmentId, marker);
      }
      marker.getElement().style.backgroundColor = color;
      marker.getPopup()?.setHTML(trafficPopupHtml(reading));
    });
  }, [traffic]);

  // Alertas: marcador por id + zona de 750 m alrededor (el mismo radio que usa el aviso de la ruta).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ids = new Set(alerts.map((a) => a.id));
    const markers = alertMarkersRef.current;
    markers.forEach((marker, id) => {
      if (!ids.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    });
    alerts.forEach((alert) => {
      if (markers.has(alert.id)) return;
      const marker = new Marker({ element: alertElement(alert) })
        .setLngLat([Number(alert.longitude), Number(alert.latitude)])
        .setPopup(new Popup({ offset: 18, maxWidth: '280px' }).setHTML(alertPopupHtml(alert)))
        .addTo(map);
      markers.set(alert.id, marker);
    });

    if (mapReady) {
      (map.getSource('alert-zones') as GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection',
        features: alerts.map((alert) => ({
          type: 'Feature',
          properties: { color: severityColors[alert.severity] },
          geometry: circlePolygon(Number(alert.latitude), Number(alert.longitude), ALERT_RADIUS_KM),
        })),
      });
    }
  }, [alerts, mapReady]);

  // Líneas de ruta: alternativas atenuadas debajo, seleccionada resaltada encima.
  useEffect(() => {
    const map = mapRef.current;
    // Tras un remount (HMR/StrictMode) mapReady puede venir de la instancia anterior.
    if (!map || !mapReady || !map.getSource('routes-alt')) return;

    const others = alternatives.filter((r) => r.id !== selectedRoute?.id && r.path.length > 1);
    (map.getSource('routes-alt') as GeoJSONSource).setData({ type: 'FeatureCollection', features: others.map((r) => lineFeature(r, false)) });
    (map.getSource('route-selected') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: selectedRoute && selectedRoute.path.length > 1 ? [lineFeature(selectedRoute, true)] : [],
    });

    const color = selectedRoute ? routeColors[selectedRoute.type] : '#64748b';
    const stops = (selectedRoute?.path ?? []).filter((p) => p.type === 'stop');
    (map.getSource('route-stops') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: stops.map((p) => ({ type: 'Feature', properties: { color, label: p.label ?? '' }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })),
    });

    transferMarkersRef.current.forEach((m) => m.remove());
    transferMarkersRef.current = (selectedRoute?.path ?? [])
      .filter((p) => p.type === 'transfer')
      .map((p) => {
        const el = document.createElement('div');
        el.className = 'rounded-md border-2 border-white px-1.5 py-0.5 text-[10px] font-bold text-white shadow-float';
        el.style.background = pointColors.transfer;
        el.textContent = p.label ?? 'Transbordo';
        return new Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map);
      });
  }, [mapReady, alternatives, selectedRoute]);

  const fitToRoutes = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const routes = selectedRoute ? [selectedRoute] : alternatives;
    const coords = routes.flatMap((r) => r.path.map((p) => [p.lon, p.lat] as [number, number]));
    if (coords.length === 0) return;
    const bounds = coords.reduce((acc, c) => acc.extend(c), new LngLatBounds(coords[0], coords[0]));
    const narrow = (mapContainerRef.current?.clientWidth ?? 800) < 640;
    map.fitBounds(bounds, {
      padding: narrow ? { top: 60, bottom: 60, left: 40, right: 50 } : { top: 80, bottom: 90, left: 80, right: 80 },
      maxZoom: 16,
      duration: 700,
    });
  }, [selectedRoute, alternatives]);

  // Encuadre automático solo cuando cambia la ruta elegida o el conjunto de opciones,
  // no en cada actualización de tráfico/alertas.
  useEffect(() => {
    fitToRoutes();
  }, [fitToRoutes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusPoint) return;
    map.flyTo({ center: [focusPoint.lon, focusPoint.lat], zoom: Math.max(map.getZoom(), 15), duration: 800 });
  }, [focusPoint]);

  const hasRoutes = Boolean(selectedRoute) || alternatives.length > 0;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={mapContainerRef} className="absolute inset-0" />
      {hasRoutes && (
        <button
          type="button"
          onClick={fitToRoutes}
          className="absolute right-[10px] top-[86px] z-10 flex h-[29px] w-[29px] items-center justify-center rounded-xl bg-white text-slate-700 shadow-float hover:bg-slate-50"
          title="Centrar en la ruta"
          aria-label="Centrar en la ruta"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
          </svg>
        </button>
      )}
      {children}
    </div>
  );
}
