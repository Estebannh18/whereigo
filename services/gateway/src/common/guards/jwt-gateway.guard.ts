// services/gateway/src/common/guards/jwt-gateway.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface GatewayJwtPayload {
  sub: string;
  email: string;
  role: 'user' | 'admin';
}

/**
 * Verifica el access token (firma + expiración) directamente en el gateway,
 * ANTES de reenviar la petición al microservicio correspondiente. Así una
 * petición con token inválido nunca sale del gateway hacia la red interna.
 * El microservicio de destino vuelve a validar el token de forma independiente
 * (defensa en profundidad); el gateway no es la única barrera de seguridad.
 */
@Injectable()
export class JwtGatewayGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: GatewayJwtPayload }>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Token de autenticación no proporcionado.');
    }

    try {
      const payload = this.jwtService.verify<GatewayJwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token de autenticación inválido o expirado.');
    }
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return null;
    }
    return header.slice('Bearer '.length);
  }
}
