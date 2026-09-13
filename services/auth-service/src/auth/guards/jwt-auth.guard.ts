// services/auth-service/src/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Exige un Bearer JWT válido (firma + expiración). Ver JwtStrategy para el detalle de validación. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
