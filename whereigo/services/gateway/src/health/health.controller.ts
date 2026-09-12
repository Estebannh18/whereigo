// services/gateway/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';

/** Endpoint de vida del propio gateway (Fase 0, Paso 2 del plan). */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'gateway', timestamp: new Date().toISOString() };
  }
}
