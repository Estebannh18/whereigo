// services/traffic-service/src/rabbitmq/rabbitmq.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitmqService } from './rabbitmq.service';

@Module({
  imports: [ConfigModule],
  providers: [RabbitmqService],
  exports: [RabbitmqService],
})
export class RabbitmqModule {}
