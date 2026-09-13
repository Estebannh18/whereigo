// services/auth-service/src/users/users.service.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// bcryptjs (implementación pura en JS, sin binarios nativos): evita fallos de
// compilación en Windows/CI/Render que sí puede tener el paquete "bcrypt" original.
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './entities/user.entity';

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /**
   * Crea un usuario nuevo con la contraseña ya hasheada (bcrypt).
   * El número de rondas de sal es configurable por entorno para poder
   * ajustar el costo computacional sin tocar código.
   */
  async create(email: string, plainPassword: string, saltRounds: number): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Ya existe una cuenta registrada con este correo.');
    }

    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);
    const user = this.usersRepository.create({
      email,
      passwordHash,
      role: UserRole.USER,
    });
    return this.usersRepository.save(user);
  }

  async validatePassword(user: User, plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, user.passwordHash);
  }

  /** Nunca devolver la entidad completa (incluye passwordHash) fuera de este módulo. */
  toPublic(user: User): PublicUser {
    return { id: user.id, email: user.email, role: user.role };
  }
}
