// services/gateway/src/common/guards/guards.spec.ts
// El gateway es la primera barrera: un token inválido nunca debe llegar a la red interna.
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppRole } from '../decorators/roles.decorator';
import { GatewayJwtPayload, JwtGatewayGuard } from './jwt-gateway.guard';
import { RolesGuard } from './roles.guard';

const SECRET = 'secreto-de-prueba';

function contextWith(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtGatewayGuard', () => {
  const jwt = new JwtService({});
  const config = { get: () => SECRET } as unknown as ConfigService;
  const guard = new JwtGatewayGuard(jwt, config);

  it('acepta un Bearer válido y deja el usuario en request.user', () => {
    const token = jwt.sign({ sub: 'u-1', email: 'ana@whereigo.dev', role: 'user' }, { secret: SECRET });
    const request: { headers: Record<string, string>; user?: GatewayJwtPayload } = {
      headers: { authorization: `Bearer ${token}` },
    };

    expect(guard.canActivate(contextWith(request))).toBe(true);
    expect(request.user).toMatchObject({ sub: 'u-1', role: 'user' });
  });

  it('rechaza la petición sin header Authorization', () => {
    expect(() => guard.canActivate(contextWith({ headers: {} }))).toThrow(
      new UnauthorizedException('Token de autenticación no proporcionado.'),
    );
  });

  it('rechaza un header que no es Bearer', () => {
    expect(() => guard.canActivate(contextWith({ headers: { authorization: 'Basic abc' } }))).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un token firmado con otro secreto', () => {
    const forged = jwt.sign({ sub: 'u-1', role: 'admin' }, { secret: 'otro-secreto' });
    expect(() => guard.canActivate(contextWith({ headers: { authorization: `Bearer ${forged}` } }))).toThrow(
      new UnauthorizedException('Token de autenticación inválido o expirado.'),
    );
  });

  it('rechaza un token expirado', () => {
    const expired = jwt.sign({ sub: 'u-1', role: 'user', exp: Math.floor(Date.now() / 1000) - 60 }, { secret: SECRET });
    expect(() => guard.canActivate(contextWith({ headers: { authorization: `Bearer ${expired}` } }))).toThrow(
      UnauthorizedException,
    );
  });
});

describe('RolesGuard (gateway)', () => {
  const build = (roles: AppRole[] | undefined) =>
    new RolesGuard({ getAllAndOverride: jest.fn().mockReturnValue(roles) } as unknown as Reflector);
  const asRole = (role: AppRole) => contextWith({ user: { sub: 'u-1', email: 'a@b.c', role } });

  it('sin roles declarados deja pasar', () => {
    expect(build(undefined).canActivate(asRole('user'))).toBe(true);
  });

  it('bloquea a un user en una ruta de admin y deja pasar al admin', () => {
    expect(build(['admin']).canActivate(asRole('user'))).toBe(false);
    expect(build(['admin']).canActivate(asRole('admin'))).toBe(true);
  });
});
