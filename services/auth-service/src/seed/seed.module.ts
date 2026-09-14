// services/auth-service/src/seed/seed.module.ts
import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
})
export class SeedModule implements OnModuleInit {
  private readonly logger = new Logger(SeedModule.name);

  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config.get<string>('DEMO_ADMIN_EMAIL') ?? 'admin@whereigo.dev';
    const password = this.config.get<string>('DEMO_ADMIN_PASSWORD') ?? 'Admin123!';
    const existing = await this.usersRepository.findOne({ where: { email } });

    if (existing) {
      return;
    }

    const saltRounds = Number(this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? 10);
    const user = this.usersRepository.create({
      email,
      passwordHash: await bcrypt.hash(password, saltRounds),
      role: UserRole.ADMIN,
    });
    await this.usersRepository.save(user);
    this.logger.log(`Usuario admin demo creado: ${email}`);
  }
}
