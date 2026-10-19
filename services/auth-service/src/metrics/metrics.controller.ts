// services/auth-service/src/metrics/metrics.controller.ts
import { Controller, Get, Header, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { metricsTokenIsValid, registry } from './metrics';

@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', registry.contentType)
  async metrics(@Headers('authorization') authorization?: string): Promise<string> {
    if (!metricsTokenIsValid(authorization)) {
      throw new UnauthorizedException();
    }
    return registry.metrics();
  }
}
