// services/auth-service/src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { PublicUser, UsersService } from '../users/users.service';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(email: string, password: string): Promise<PublicUser> {
    const saltRounds = Number(this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? 10);
    const user = await this.usersService.create(email, password, saltRounds);
    return this.usersService.toPublic(user);
  }

  /**
   * Verifica credenciales contra el hash almacenado (bcrypt.compare, tiempo constante).
   * Devuelve un mensaje genérico en cualquier fallo para no filtrar si el correo existe.
   */
  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const passwordMatches = await this.usersService.validatePassword(user, password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    return user;
  }

  async login(email: string, password: string): Promise<{ user: PublicUser } & TokenPair> {
    const user = await this.validateCredentials(email, password);
    const tokens = this.issueTokens(user);
    return { user: this.usersService.toPublic(user), ...tokens };
  }

  /** Emite un par access/refresh token con secretos y expiraciones independientes. */
  private issueTokens(user: User): TokenPair {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN'),
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
    });

    return { accessToken, refreshToken };
  }

  /** Valida un refresh token contra su propio secreto y emite un nuevo par de tokens (rotación). */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('El usuario asociado al token ya no existe.');
    }

    return this.issueTokens(user);
  }
}
