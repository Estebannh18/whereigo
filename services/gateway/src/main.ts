// services/gateway/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Único punto de entrada del frontend: se restringe CORS a los orígenes conocidos,
  // nunca "*", porque el gateway reenvía credenciales (Bearer JWT) a los microservicios.
  const origins = (config.get<string>('CORS_ORIGINS') ?? '').split(',').filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
}

bootstrap();
