// services/auth-service/src/metrics/metrics.spec.ts
import { EventEmitter } from 'events';
import { NextFunction, Request, Response } from 'express';
import { httpMetricsMiddleware, metricsTokenIsValid, registry } from './metrics';

describe('métricas', () => {
  const original = process.env.METRICS_TOKEN;
  afterEach(() => {
    process.env.METRICS_TOKEN = original;
  });

  it('/metrics exige el token exacto de Prometheus', () => {
    process.env.METRICS_TOKEN = 'secreto';
    expect(metricsTokenIsValid('Bearer secreto')).toBe(true);
    expect(metricsTokenIsValid('Bearer otro')).toBe(false);
    expect(metricsTokenIsValid('Bearer secreto-mas-largo')).toBe(false);
    expect(metricsTokenIsValid(undefined)).toBe(false);
  });

  it('sin METRICS_TOKEN configurado nadie puede leer /metrics', () => {
    delete process.env.METRICS_TOKEN;
    expect(metricsTokenIsValid('Bearer ')).toBe(false);
  });

  it('cuenta cada petición por ruta declarada y código', async () => {
    const res = Object.assign(new EventEmitter(), { statusCode: 401 }) as unknown as Response;
    const req = { method: 'POST', baseUrl: '', route: { path: '/auth/login' } } as unknown as Request;
    const next = jest.fn() as NextFunction;

    httpMetricsMiddleware(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    expect(next).toHaveBeenCalled();
    const text = await registry.metrics();
    expect(text).toContain('http_requests_total{method="POST",route="/auth/login",status="401"} 1');
    expect(text).toContain('http_request_duration_seconds_bucket');
  });
});
