// frontend/src/lib/routeStyle.ts
// Paleta compartida entre el mapa (MapLibre necesita hex) y la UI (Tailwind usa los mismos
// valores bajo `route.*` y `brand.*` en tailwind.config.js).

export type RouteType = 'bus' | 'taxi' | 'mixed';
export type Severity = 'low' | 'medium' | 'high';

export const routeColors: Record<RouteType, string> = {
  bus: '#2549ea',
  taxi: '#f59e0b',
  mixed: '#0d9488',
};

export const routeTypeLabels: Record<RouteType, string> = {
  bus: 'Bus',
  taxi: 'Taxi',
  mixed: 'Combinado',
};

export const severityColors: Record<Severity, string> = {
  low: '#ca8a04',
  medium: '#ea580c',
  high: '#dc2626',
};

export const severityLabels: Record<Severity, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

export const severityChipClass: Record<Severity, string> = {
  low: 'bg-yellow-100 text-yellow-800',
  medium: 'bg-orange-100 text-orange-800',
  high: 'bg-red-100 text-red-700',
};

export const pointColors = {
  origin: '#1e2d89',
  destination: '#dc2626',
  transfer: '#7c3aed',
};

export function congestionColor(level: number): string {
  if (level >= 70) return '#dc2626';
  if (level >= 40) return '#f59e0b';
  return '#16a34a';
}

/** Radio (km) en el que una alerta se considera "sobre" la ruta seleccionada. */
export const ALERT_RADIUS_KM = 0.75;

export function formatCOP(value: number, withCurrency = true): string {
  return `$${Math.round(value).toLocaleString('es-CO')}${withCurrency ? ' COP' : ''}`;
}

export function formatMinutes(value: number): string {
  return `${Math.round(value)} min`;
}
