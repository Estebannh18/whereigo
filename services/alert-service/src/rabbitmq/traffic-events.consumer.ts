// services/alert-service/src/rabbitmq/traffic-events.consumer.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ConsumeMessage } from 'amqplib';
import { AlertsService } from '../alerts/alerts.service';
import { RabbitmqService } from './rabbitmq.service';

interface IncidentDetectedEvent {
  eventType: 'IncidentDetected';
  segmentId: string;
  latitude: number;
  longitude: number;
  incidentType: string;
  severity: string;
  detectedAt: string;
  emittedAt: string;
}

interface RouteAffectedEvent {
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

type TrafficEvent = IncidentDetectedEvent | RouteAffectedEvent;

@Injectable()
export class TrafficEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(TrafficEventsConsumer.name);

  constructor(
    private readonly config: ConfigService,
    private readonly rabbitmqService: RabbitmqService,
    private readonly alertsService: AlertsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.config.get<string>('RABBITMQ_ENABLED') !== 'false';
    if (!enabled) {
      return;
    }

    // Espera a que RabbitMQService establezca la conexión.
    await this.waitForChannel();

    const channel = this.rabbitmqService.getChannel();
    if (!channel) {
      this.logger.error('No se pudo iniciar el consumidor: canal RabbitMQ no disponible.');
      return;
    }

    await this.bindQueue(channel);
  }

  private async waitForChannel(retries = 30, delayMs = 1000): Promise<void> {
    for (let i = 1; i <= retries; i++) {
      if (this.rabbitmqService.getChannel()) {
        return;
      }
      this.logger.debug(`Esperando canal RabbitMQ... intento ${i}/${retries}`);
      await this.sleep(delayMs);
    }
  }

  private async bindQueue(channel: Channel): Promise<void> {
    const exchange = this.config.get<string>('RABBITMQ_EXCHANGE') ?? 'traffic.events';
    const queue = 'alert-service.traffic-events';

    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, exchange, 'traffic.incident.detected');
    await channel.bindQueue(queue, exchange, 'traffic.route.affected');

    await channel.consume(queue, (msg) => this.handleMessage(channel, msg), { noAck: false });

    this.logger.log(`Consumidor suscrito a ${queue} (exchange: ${exchange})`);
  }

  private async handleMessage(channel: Channel, msg: ConsumeMessage | null): Promise<void> {
    if (!msg) {
      return;
    }

    try {
      const event = JSON.parse(msg.content.toString()) as TrafficEvent;
      this.logger.debug(`Evento recibido: ${event.eventType} desde ${msg.fields.routingKey}`);

      if (event.eventType === 'IncidentDetected') {
        await this.alertsService.createFromIncident(event);
      } else if (event.eventType === 'RouteAffected') {
        await this.alertsService.createFromRouteAffected(event);
      }

      channel.ack(msg);
    } catch (error) {
      this.logger.error('Error procesando mensaje de RabbitMQ', error);
      channel.nack(msg, false, false);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
