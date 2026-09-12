// services/gateway/src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export type AppRole = 'user' | 'admin';

export const ROLES_KEY = 'roles';

/** Restringe una ruta reenviada por el gateway a los roles indicados (ver RolesGuard). */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
