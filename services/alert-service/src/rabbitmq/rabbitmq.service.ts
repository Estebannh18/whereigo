// services/alert-service/src/rabbitmq/rabbitmq.service.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelModel, Channel, connect } from 'amqplib';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.config.get<string>('RABBITMQ_ENABLED') !== 'false';
    if (!enabled) {
      this.logger.warn('RabbitMQ deshabilitado (RABBITMQ_ENABLED=false). No se consumirán eventos.');
      return;
    }

    await this.connectWithRetry();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  getChannel(): Channel | null {
    return this.channel;
  }

  private getConnectionUrl(): string {
    const host = this.config.get<string>('RABBITMQ_HOST') ?? 'localhost';
    const port = this.config.get<number>('RABBITMQ_PORT') ?? 5672;
    const user = this.config.get<string>('RABBITMQ_USER') ?? 'whereigo';
    const pass = this.config.get<string>('RABBITMQ_PASSWORD') ?? 'changeme';
    return `amqp://${user}:${pass}@${host}:${port}`;
  }

  private async connectWithRetry(retries = 15, delayMs = 2000): Promise<void> {
    const url = this.getConnectionUrl();

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.establishConnection(url);
        return;
      } catch (error) {
        this.logger.warn(`Intento ${attempt}/${retries} fallido para conectar a RabbitMQ. Reintentando en ${delayMs}ms...`);
        if (attempt === retries) {
          this.logger.error('No se pudo conectar a RabbitMQ después de varios intentos.');
          return;
        }
        await this.sleep(delayMs);
      }
    }
  }

  private async establishConnection(url: string): Promise<void> {
    this.connection = await connect(url);
    this.channel = await this.connection.createChannel();

    const exchange = this.config.get<string>('RABBITMQ_EXCHANGE') ?? 'traffic.events';
    await this.channel.assertExchange(exchange, 'topic', { durable: true });

    this.logger.log(`Conectado a RabbitMQ en ${url.replace(/:.*@/, ':***@')}, exchange ${exchange}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
