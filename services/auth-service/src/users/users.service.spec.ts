// services/auth-service/src/users/users.service.spec.ts
import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((data: Partial<User>) => data as User),
      save: jest.fn(async (u: User) => ({ ...u, id: 'nuevo' }) as User),
    };
    service = new UsersService(repo as unknown as Repository<User>);
  });

  it('crea el usuario con rol user y la contraseña hasheada (nunca en claro)', async () => {
    repo.findOne.mockResolvedValue(null);

    const created = await service.create('ana@whereigo.dev', 'Clave123!', 4);

    expect(created.role).toBe(UserRole.USER);
    expect(created.passwordHash).not.toBe('Clave123!');
    await expect(service.validatePassword(created, 'Clave123!')).resolves.toBe(true);
    await expect(service.validatePassword(created, 'otra')).resolves.toBe(false);
  });

  it('no permite dos cuentas con el mismo correo', async () => {
    repo.findOne.mockResolvedValue({ id: 'ya' } as User);
    await expect(service.create('ana@whereigo.dev', 'x', 4)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('toPublic no expone el hash', () => {
    const publicUser = service.toPublic({ id: '1', email: 'a@b.c', role: UserRole.ADMIN, passwordHash: 'h' } as User);
    expect(publicUser).toEqual({ id: '1', email: 'a@b.c', role: UserRole.ADMIN });
  });
});
