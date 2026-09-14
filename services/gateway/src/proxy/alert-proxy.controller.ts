// services/gateway/src/proxy/alert-proxy.controller.ts
import { All, Controller, Headers, Param, Query, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ProxyService } from './proxy.service';

/**
 * Punto de entrada del frontend hacia alert-service.
 */
@Controller('alerts')
export class AlertProxyController {
  private readonly alertServiceUrl: string;

  constructor(
    private readonly proxyService: ProxyService,
    config: ConfigService,
  ) {
    this.alertServiceUrl = config.get<string>('ALERT_SERVICE_URL') ?? 'http://alert-service:3003';
  }

  @All('*')
  proxy(
    @Req() req: Request,
    @Param() _params: Record<string, string>,
    @Query() _query: Record<string, string>,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const path = req.path.replace(/^\/alerts/, '') || '/';
    const targetPath = `/alerts${path}`;
    const queryString = req.originalUrl.split('?')[1];

    return this.proxyService.forward({
      baseUrl: this.alertServiceUrl,
      path: targetPath,
      queryString,
      method: req.method as any,
      body: req.body,
      authorizationHeader,
    });
  }
}
