// services/auth-service/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const isProduction = config.get<string>('NODE_ENV') === 'production';

        // Render (y la mayoría de Postgres administrados) inyectan una única
        // DATABASE_URL y exigen TLS. En desarrollo local seguimos usando las
        // variables DB_* sueltas (más simples de leer en un .env manual).
        const base = databaseUrl
          ? { url: databaseUrl, ssl: isProduction ? { rejectUnauthorized: false } : false }
          : {
              host: config.get<string>('DB_HOST'),
              port: config.get<number>('DB_PORT'),
              username: config.get<string>('DB_USERNAME'),
              password: config.get<string>('DB_PASSWORD'),
              database: config.get<string>('DB_NAME'),
            };

        return {
          type: 'postgres',
          ...base,
          autoLoadEntities: true,
          // Solo para desarrollo/demo: en producción real, usar migraciones (typeorm migration:run).
          synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
        };
      },
    }),
    UsersModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
