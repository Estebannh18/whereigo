// services/gateway/src/proxy/route-proxy.controller.ts
import { All, Controller, Headers, Param, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtGatewayGuard } from '../common/guards/jwt-gateway.guard';
import { RolesGuard } from '../common/guards/roles.guard';
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

  @All('route-search')
  search(
    @Req() req: Request,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    return this.forwardRequest(req, authorizationHeader);
  }

  @All()
  @UseGuards(JwtGatewayGuard, RolesGuard)
  @Roles('admin')
  proxyRoot(
    @Req() req: Request,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    return this.forwardRequest(req, authorizationHeader);
  }

  @All('*')
  @UseGuards(JwtGatewayGuard, RolesGuard)
  @Roles('admin')
  proxy(
    @Req() req: Request,
    @Param() _params: Record<string, string>,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    return this.forwardRequest(req, authorizationHeader);
  }

  private forwardRequest(req: Request, authorizationHeader?: string) {
    const path = req.path === '/routes/route-search' ? '/route-search' : req.path;
    const queryString = req.originalUrl.split('?')[1];

    return this.proxyService.forward({
      baseUrl: this.routeServiceUrl,
      path,
      queryString,
      method: req.method as any,
      body: req.body,
      authorizationHeader,
    });
  }
}
