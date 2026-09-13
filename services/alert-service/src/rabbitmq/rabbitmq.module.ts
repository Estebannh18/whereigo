// services/alert-service/src/rabbitmq/rabbitmq.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlertsModule } from '../alerts/alerts.module';
import { TrafficEventsConsumer } from './traffic-events.consumer';
import { RabbitmqService } from './rabbitmq.service';

@Module({
  imports: [ConfigModule, AlertsModule],
  providers: [RabbitmqService, TrafficEventsConsumer],
})
export class RabbitmqModule {}
