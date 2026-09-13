// services/gateway/src/proxy/route-proxy.controller.ts
import { All, Controller, Headers, Param, Query, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ProxyService } from './proxy.service';

/**
 * Punto de entrada del frontend hacia route-service. Reenvía cualquier
 * petición bajo /routes/* preservando método, query params, body y headers.
 */
@Controller('routes')
export class RouteProxyController {
  private readonly routeServiceUrl: string;

  constructor(
    private readonly proxyService: ProxyService,
    config: ConfigService,
  ) {
    this.routeServiceUrl = config.get<string>('ROUTE_SERVICE_URL') ?? 'http://route-service:3004';
  }

  @All('*')
  proxy(
    @Req() req: Request,
    @Param() _params: Record<string, string>,
    @Query() _query: Record<string, string>,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const path = req.path.replace(/^\/routes/, '') || '/';
    const targetPath = `/routes${path}`;

    return this.proxyService.forward({
      baseUrl: this.routeServiceUrl,
      path: targetPath,
      method: req.method as any,
      body: req.body,
      authorizationHeader,
    });
  }
}
