// frontend/src/components/MapView.tsx
import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, Popup, NavigationControl, LngLatLike, LngLatBoundsLike, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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

interface MapViewProps {
  traffic?: TrafficReading[];
  alerts?: Alert[];
  /** Si está definido, el mapa permite seleccionar origen/destino mediante clics. */
  selectionMode?: 'origin' | 'destination' | null;
  onSelectPoint?: (lat: number, lon: number) => void;
  origin?: { lat: number; lon: number } | null;
  destination?: { lat: number; lon: number } | null;
  routePath?: RoutePoint[];
}

function congestionColor(level: number): string {
  if (level >= 70) return '#ef4444';
  if (level >= 40) return '#eab308';
  return '#22c55e';
}

function alertColor(severity: Alert['severity']): string {
  const map = { low: '#22c55e', medium: '#eab308', high: '#ef4444' };
  return map[severity];
}

function pointColor(type: RoutePoint['type']): string {
  const map = {
    origin: '#3b82f6',
    destination: '#ef4444',
    stop: '#22c55e',
    walk: '#f59e0b',
    transfer: '#a855f7',
  };
  return map[type];
}

export function MapView({
  traffic = [],
  alerts = [],
  selectionMode,
  onSelectPoint,
  origin,
  destination,
  routePath,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [clickMarker, setClickMarker] = useState<Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm-tiles',
          },
        ],
      },
      center: [-73.1165, 7.1186],
      zoom: 13,
    });

    map.addControl(new NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Listener de clics para modo selección.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectionMode || !onSelectPoint) return;

    const handler = (e: any) => {
      onSelectPoint(e.lngLat.lat, e.lngLat.lng);
    };

    map.getCanvas().style.cursor = 'crosshair';
    map.on('click', handler);

    return () => {
      map.getCanvas().style.cursor = '';
      map.off('click', handler);
    };
  }, [selectionMode, onSelectPoint]);

  // Marcador temporal en modo selección.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    clickMarker?.remove();

    if (selectionMode && origin && !destination) {
      const marker = new Marker({ color: pointColor('origin') })
        .setLngLat([origin.lon, origin.lat])
        .addTo(map);
      setClickMarker(marker);
    } else if (selectionMode === 'destination' && destination) {
      const marker = new Marker({ color: pointColor('destination') })
        .setLngLat([destination.lon, destination.lat])
        .addTo(map);
      setClickMarker(marker);
    }
  }, [selectionMode, origin, destination]);

  // Renderizado de tráfico, alertas y ruta.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Limpiar marcadores anteriores.
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Limpiar capas/sources de ruta anteriores.
    ['route-line', 'route-walk-line', 'route-points'].forEach((layerId) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    });
    ['route-path', 'route-points-source'].forEach((sourceId) => {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    });

    // Marcadores de tráfico por segmento.
    const latestBySegment = new Map<string, TrafficReading>();
    traffic.forEach((reading) => {
      const existing = latestBySegment.get(reading.segmentId);
      if (!existing || new Date(reading.recordedAt) > new Date(existing.recordedAt)) {
        latestBySegment.set(reading.segmentId, reading);
      }
    });

    latestBySegment.forEach((reading) => {
      const color = congestionColor(reading.congestionLevel);
      const el = document.createElement('div');
      el.className = 'rounded-full border-2 border-white shadow-sm';
      el.style.width = '18px';
      el.style.height = '18px';
      el.style.backgroundColor = color;

      const popup = new Popup({ offset: 12 }).setHTML(
        `<div class="text-sm">
          <strong>${reading.segmentId}</strong><br/>
          Velocidad: ${reading.speedKmh} km/h<br/>
          Congestión: ${reading.congestionLevel}%<br/>
          ${reading.hasIncident ? `⚠️ Incidente: ${reading.incidentType ?? 'otro'}` : ''}
        </div>`,
      );

      const marker = new Marker({ element: el })
        .setLngLat([reading.longitude, reading.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Marcadores de alertas.
    alerts.forEach((alert) => {
      const color = alertColor(alert.severity);
      const el = document.createElement('div');
      el.className =
        'flex items-center justify-center rounded-full border-2 border-white font-bold text-xs text-white shadow-md';
      el.style.width = '26px';
      el.style.height = '26px';
      el.style.backgroundColor = color;
      el.textContent = '!';

      const popup = new Popup({ offset: 15 }).setHTML(
        `<div class="text-sm max-w-xs">
          <strong>${alert.alertType === 'incident' ? 'Incidente' : 'Ruta afectada'}</strong><br/>
          ${alert.message}<br/>
          <span class="text-xs text-slate-500">${new Date(alert.createdAt).toLocaleString('es-CO')}</span>
        </div>`,
      );

      const marker = new Marker({ element: el })
        .setLngLat([alert.longitude, alert.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Dibujar ruta.
    if (routePath && routePath.length > 0) {
      const coordinates: [number, number][] = routePath.map((p) => [p.lon, p.lat]);
      const bounds = coordinates.reduce(
        (acc, coord) => acc.extend(coord as LngLatLike),
        new LngLatBounds(coordinates[0] as LngLatLike, coordinates[0] as LngLatLike),
      );
      map.fitBounds(bounds as LngLatBoundsLike, { padding: 60, maxZoom: 16 });

      map.addSource('route-path', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates },
        },
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-path',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 5, 'line-opacity': 0.85 },
      });

      // Puntos de la ruta.
      map.addSource('route-points-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: routePath.map((p) => ({
            type: 'Feature' as const,
            properties: { type: p.type, label: p.label ?? '' },
            geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
          })),
        },
      });

      map.addLayer({
        id: 'route-points',
        type: 'circle',
        source: 'route-points-source',
        paint: {
          'circle-radius': 8,
          'circle-color': ['match', ['get', 'type'], 'origin', '#3b82f6', 'destination', '#ef4444', 'stop', '#22c55e', 'walk', '#f59e0b', 'transfer', '#a855f7', '#64748b'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Marcadores con labels para origen y destino.
      routePath.forEach((p) => {
        if (p.type === 'origin' || p.type === 'destination' || p.type === 'transfer') {
          const el = document.createElement('div');
          el.className = 'px-2 py-0.5 rounded text-xs font-semibold text-white shadow';
          el.style.backgroundColor = pointColor(p.type);
          el.textContent = p.label ?? (p.type === 'origin' ? 'A' : p.type === 'destination' ? 'B' : 'T');

          const marker = new Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map);
          markersRef.current.push(marker);
        }
      });
    }
  }, [traffic, alerts, routePath]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full rounded-xl border border-slate-200 shadow-sm"
      style={{ height: '500px' }}
    />
  );
}
