// services/auth-service/src/health/health.controller.spec.ts
import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const build = (query: jest.Mock) => new HealthController({ query } as unknown as DataSource);

  it('/health responde ok sin tocar la base de datos', () => {
    const query = jest.fn();
    expect(build(query).check()).toMatchObject({ status: 'ok', service: 'auth-service' });
    expect(query).not.toHaveBeenCalled();
  });

  it('/health/ready reporta la base de datos arriba', async () => {
    const result = await build(jest.fn().mockResolvedValue([{ ok: 1 }])).ready();
    expect(result).toEqual({
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    });
  });

  it('/health/ready responde 503 y nombra la dependencia caída', async () => {
    const error = await build(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')))
      .ready()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const exception = error as ServiceUnavailableException;
    expect(exception.getStatus()).toBe(503);
    expect(exception.getResponse()).toMatchObject({ status: 'error', error: { database: { status: 'down' } } });
  });
});
