// services/auth-service/src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export const ROLES_KEY = 'roles';

/** Marca un endpoint como accesible solo para los roles indicados. Úsese junto a RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
