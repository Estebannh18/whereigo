// services/gateway/src/proxy/ai-proxy.controller.ts
import { All, Controller, Headers, Param, Query, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ProxyService } from './proxy.service';

/**
 * Punto de entrada del frontend hacia ai-service. Reenvía cualquier
 * petición bajo /ai/* preservando método, query params, body y headers.
 */
@Controller('ai')
export class AiProxyController {
  private readonly aiServiceUrl: string;

  constructor(
    private readonly proxyService: ProxyService,
    config: ConfigService,
  ) {
    this.aiServiceUrl = config.get<string>('AI_SERVICE_URL') ?? 'http://ai-service:8000';
  }

  @All('*')
  proxy(
    @Req() req: Request,
    @Param() _params: Record<string, string>,
    @Query() _query: Record<string, string>,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const path = req.path.replace(/^\/ai/, '') || '/';

    return this.proxyService.forward({
      baseUrl: this.aiServiceUrl,
      path,
      method: req.method as any,
      body: req.body,
      authorizationHeader,
    });
  }
}
