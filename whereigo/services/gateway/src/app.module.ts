// services/gateway/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ProxyModule, HealthModule],
})
export class AppModule {}
