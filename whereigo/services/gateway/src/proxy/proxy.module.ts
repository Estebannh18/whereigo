// services/gateway/src/proxy/proxy.module.ts
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthProxyController } from './auth-proxy.controller';
import { ProxyService } from './proxy.service';
import { JwtGatewayGuard } from '../common/guards/jwt-gateway.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    HttpModule.register({ timeout: 5000, maxRedirects: 0 }),
  ],
  controllers: [AuthProxyController],
  providers: [ProxyService, JwtGatewayGuard, RolesGuard],
})
export class ProxyModule {}
