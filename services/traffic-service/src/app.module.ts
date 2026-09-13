// services/traffic-service/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import { TrafficModule } from './traffic/traffic.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const isProduction = config.get<string>('NODE_ENV') === 'production';

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
          synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
        };
      },
    }),
    HealthModule,
    TrafficModule,
    RabbitmqModule,
  ],
})
export class AppModule {}
