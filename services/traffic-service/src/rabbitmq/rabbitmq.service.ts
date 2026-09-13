// services/traffic-service/src/rabbitmq/rabbitmq.service.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelModel, Channel, connect } from 'amqplib';

export interface TrafficUpdatedEvent {
  eventType: 'TrafficUpdated';
  segmentId: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  congestionLevel: number;
  isPeakHour: boolean;
  isRainy: boolean;
  recordedAt: string;
  emittedAt: string;
}

export interface IncidentDetectedEvent {
  eventType: 'IncidentDetected';
  segmentId: string;
  latitude: number;
  longitude: number;
  incidentType: string;
  severity: string;
  detectedAt: string;
  emittedAt: string;
}

export interface RouteAffectedEvent {
  eventType: 'RouteAffected';
  segmentId: string;
  latitude: number;
  longitude: number;
  congestionLevel: number;
  incidentType: string | null;
  reason: 'incident' | 'congestion';
  affectedAt: string;
  emittedAt: string;
}

export type TrafficEvent = TrafficUpdatedEvent | IncidentDetectedEvent | RouteAffectedEvent;

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.config.get<string>('RABBITMQ_ENABLED') !== 'false';
    if (!enabled) {
      this.logger.warn('RabbitMQ deshabilitado (RABBITMQ_ENABLED=false). Los eventos no se publicarán.');
      return;
    }

    await this.connectWithRetry();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
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
          this.logger.error('No se pudo conectar a RabbitMQ después de varios intentos. Los eventos no se publicarán hasta reconectar.');
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

  async publishEvent(routingKey: string, event: TrafficEvent): Promise<void> {
    if (!this.channel) {
      // Intenta reconectar una vez antes de descartar el evento.
      this.logger.warn(`Canal RabbitMQ no disponible. Intentando reconectar antes de publicar ${event.eventType}...`);
      await this.connectWithRetry(3, 1000);
    }

    if (!this.channel) {
      this.logger.error(`Canal RabbitMQ no disponible. Evento ${event.eventType} no publicado.`);
      return;
    }

    const exchange = this.config.get<string>('RABBITMQ_EXCHANGE') ?? 'traffic.events';
    const payload = Buffer.from(JSON.stringify(event));

    this.channel.publish(exchange, routingKey, payload, { persistent: true });
    this.logger.debug(`Evento publicado: ${event.eventType} -> ${routingKey}`);
  }
}
