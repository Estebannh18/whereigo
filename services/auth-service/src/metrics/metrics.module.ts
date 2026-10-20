// services/auth-service/src/metrics/metrics.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { httpMetricsMiddleware } from './metrics';
import { MetricsController } from './metrics.controller';

@Module({ controllers: [MetricsController] })
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(httpMetricsMiddleware).forRoutes('*');
  }
}
