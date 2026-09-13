// services/traffic-service/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'traffic-service', timestamp: new Date().toISOString() };
  }
}
