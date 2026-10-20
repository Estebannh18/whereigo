// services/auth-service/src/auth/auth.service.spec.ts
// Pruebas unitarias (Jest) de login y rotación de tokens, sin base de datos.
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const CONFIG: Record<string, string> = {
  JWT_ACCESS_SECRET: 'access-de-prueba',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'refresh-de-prueba',
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_SALT_ROUNDS: '4',
};

const user = { id: 'u-1', email: 'ana@whereigo.dev', passwordHash: 'hash', role: UserRole.USER } as User;

type UsersMock = jest.Mocked<
  Pick<UsersService, 'findByEmail' | 'findById' | 'validatePassword' | 'toPublic' | 'create'>
>;

describe('AuthService', () => {
  let users: UsersMock;
  let jwt: JwtService;
  let service: AuthService;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      validatePassword: jest.fn(),
      create: jest.fn(),
      toPublic: jest.fn((u: User) => ({ id: u.id, email: u.email, role: u.role })),
    };
    jwt = new JwtService({});
    const config = { get: (key: string) => CONFIG[key] } as unknown as ConfigService;
    service = new AuthService(users as unknown as UsersService, jwt, config);
  });

  it('login correcto devuelve el usuario público y un par de tokens firmados', async () => {
    users.findByEmail.mockResolvedValue(user);
    users.validatePassword.mockResolvedValue(true);

    const result = await service.login(user.email, 'Clave123!');

    expect(result.user).toEqual({ id: 'u-1', email: user.email, role: UserRole.USER });
    expect(result.user).not.toHaveProperty('passwordHash');
    const payload = jwt.verify(result.accessToken, { secret: CONFIG.JWT_ACCESS_SECRET });
    expect(payload).toMatchObject({ sub: 'u-1', email: user.email, role: 'user' });
  });

  it('contraseña incorrecta y correo inexistente dan el mismo error genérico', async () => {
    users.findByEmail.mockResolvedValueOnce(user);
    users.validatePassword.mockResolvedValueOnce(false);
    await expect(service.login(user.email, 'mala')).rejects.toThrow(
      new UnauthorizedException('Credenciales inválidas.'),
    );

    users.findByEmail.mockResolvedValueOnce(null);
    await expect(service.login('nadie@x.dev', 'x')).rejects.toThrow(
      new UnauthorizedException('Credenciales inválidas.'),
    );
  });

  it('refresh con un refresh token válido emite un par nuevo', async () => {
    const refreshToken = jwt.sign(
      { sub: 'u-1', email: user.email, role: 'user' },
      { secret: CONFIG.JWT_REFRESH_SECRET },
    );
    users.findById.mockResolvedValue(user);

    const tokens = await service.refresh(refreshToken);

    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(tokens.refreshToken).toEqual(expect.any(String));
  });

  it('refresh rechaza un access token (firmado con otro secreto)', async () => {
    const accessToken = jwt.sign({ sub: 'u-1' }, { secret: CONFIG.JWT_ACCESS_SECRET });
    await expect(service.refresh(accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh rechaza el token de un usuario que ya no existe', async () => {
    const refreshToken = jwt.sign({ sub: 'borrado' }, { secret: CONFIG.JWT_REFRESH_SECRET });
    users.findById.mockResolvedValue(null);
    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('register usa las rondas de bcrypt del entorno y no devuelve el hash', async () => {
    users.create.mockResolvedValue(user);
    await expect(service.register(user.email, 'Clave123!')).resolves.not.toHaveProperty('passwordHash');
    expect(users.create).toHaveBeenCalledWith(user.email, 'Clave123!', 4);
  });
});
