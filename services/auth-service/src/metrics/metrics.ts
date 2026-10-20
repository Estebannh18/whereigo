// services/auth-service/src/metrics/metrics.ts
// Métricas de Prometheus (fase de Monitorear). Los nombres coinciden con las
// reglas de ops/monitoring/alert-rules.yml (latencia p95 y tasa de 5xx).
import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Peticiones HTTP atendidas por el auth-service',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de las peticiones HTTP',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

/**
 * Se etiqueta por la ruta declarada (/auth/login), no por la URL real, para no
 * crear una serie por cada id o query string. Las rutas inexistentes van juntas.
 */
export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const stop = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'sin-ruta';
    const labels = { method: req.method, route, status: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    stop(labels);
  });
  next();
}

/** /metrics es público en Render: solo responde con el token de Prometheus. */
export function metricsTokenIsValid(authorizationHeader: string | undefined): boolean {
  const expected = process.env.METRICS_TOKEN ?? '';
  if (!expected || !authorizationHeader) {
    return false;
  }
  const provided = Buffer.from(authorizationHeader.replace(/^Bearer /, '').trim());
  const wanted = Buffer.from(expected);
  // Comparación en tiempo constante (requiere el mismo largo).
  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}
