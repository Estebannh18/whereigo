// services/auth-service/src/auth/guards/roles.guard.spec.ts
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';
import { RolesGuard } from './roles.guard';

function contextFor(role: UserRole): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'u-1', email: 'a@b.c', role } }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard (auth-service)', () => {
  const build = (requiredRoles: UserRole[] | undefined) => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it('deja pasar cuando la ruta no declara roles', () => {
    expect(build(undefined).canActivate(contextFor(UserRole.USER))).toBe(true);
    expect(build([]).canActivate(contextFor(UserRole.USER))).toBe(true);
  });

  it('un admin entra a una ruta solo para admin', () => {
    expect(build([UserRole.ADMIN]).canActivate(contextFor(UserRole.ADMIN))).toBe(true);
  });

  it('un user NO entra a una ruta solo para admin', () => {
    expect(build([UserRole.ADMIN]).canActivate(contextFor(UserRole.USER))).toBe(false);
  });

  it('acepta cualquiera de los roles declarados', () => {
    expect(build([UserRole.USER, UserRole.ADMIN]).canActivate(contextFor(UserRole.USER))).toBe(true);
  });
});
