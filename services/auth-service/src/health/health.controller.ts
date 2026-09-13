// services/auth-service/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Endpoint de vida del servicio (Fase 0, Paso 2 del plan): usado por Render/Docker
 * para saber si el contenedor está listo, y por el api-gateway/monitoreo en fases futuras.
 * No verifica la base de datos a propósito: un fallo de DB no debe tumbar el healthcheck
 * del proceso (evita reinicios en cascada); la conexión a DB se valida en su propio módulo.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() };
  }
}
