// services/auth-service/src/health/health.controller.ts
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

/**
 * /health: vida del proceso, usado por Render/Docker. No verifica la base de datos a
 * propósito: un fallo de DB no debe tumbar el healthcheck del proceso (evita reinicios
 * en cascada).
 * /health/ready: dependencias (Postgres). Lo revisa Nagios en la fase de Operar.
 * Responde con el mismo formato de @nestjs/terminus que entiende el plugin de Nagios.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  check() {
    return { status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      const database = { status: 'down' };
      throw new ServiceUnavailableException({ status: 'error', info: {}, error: { database }, details: { database } });
    }
    const database = { status: 'up' };
    return { status: 'ok', info: { database }, error: {}, details: { database } };
  }
}
