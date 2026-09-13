// services/gateway/src/proxy/auth-proxy.controller.ts
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtGatewayGuard } from '../common/guards/jwt-gateway.guard';
import { ProxyService } from './proxy.service';

/**
 * Único punto de entrada del frontend hacia auth-service. El frontend nunca
 * conoce la URL interna del microservicio (AUTH_SERVICE_URL), solo habla con
 * el gateway bajo /api/auth/*.
 */
@Controller('auth')
export class AuthProxyController {
  private readonly authServiceUrl: string;

  constructor(
    private readonly proxyService: ProxyService,
    config: ConfigService,
  ) {
    this.authServiceUrl = config.get<string>('AUTH_SERVICE_URL') ?? 'http://auth-service:3001';
  }

  @Post('register')
  register(@Body() body: unknown) {
    return this.proxyService.forward({ baseUrl: this.authServiceUrl, path: '/auth/register', method: 'POST', body });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: unknown) {
    return this.proxyService.forward({ baseUrl: this.authServiceUrl, path: '/auth/login', method: 'POST', body });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: unknown) {
    return this.proxyService.forward({ baseUrl: this.authServiceUrl, path: '/auth/refresh', method: 'POST', body });
  }

  // Ruta protegida: el gateway exige un JWT válido ANTES de reenviar al microservicio.
  @Get('me')
  @UseGuards(JwtGatewayGuard)
  me(@Headers('authorization') authorizationHeader: string) {
    return this.proxyService.forward({
      baseUrl: this.authServiceUrl,
      path: '/auth/me',
      method: 'GET',
      authorizationHeader,
    });
  }
}
