// services/gateway/src/proxy/traffic-proxy.controller.ts
import { All, Controller, Headers, Param, Query, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ProxyService } from './proxy.service';

/**
 * Punto de entrada del frontend hacia traffic-service. Reenvía cualquier
 * petición bajo /traffic/* preservando método, query params, body y headers.
 */
@Controller('traffic')
export class TrafficProxyController {
  private readonly trafficServiceUrl: string;

  constructor(
    private readonly proxyService: ProxyService,
    config: ConfigService,
  ) {
    this.trafficServiceUrl = config.get<string>('TRAFFIC_SERVICE_URL') ?? 'http://traffic-service:3002';
  }

  @All('*')
  proxy(
    @Req() req: Request,
    @Param() _params: Record<string, string>,
    @Query() _query: Record<string, string>,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const path = req.path.replace(/^\/traffic/, '') || '/';
    const targetPath = `/traffic${path}`;
    const queryString = req.originalUrl.split('?')[1];

    return this.proxyService.forward({
      baseUrl: this.trafficServiceUrl,
      path: targetPath,
      queryString,
      method: req.method as any,
      body: req.body,
      authorizationHeader,
    });
  }
}
