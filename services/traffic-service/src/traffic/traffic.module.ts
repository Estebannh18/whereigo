// services/traffic-service/src/traffic/traffic.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrafficService } from './traffic.service';
import { TrafficController } from './traffic.controller';
import { TrafficReading } from './entities/traffic-reading.entity';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [TypeOrmModule.forFeature([TrafficReading]), RabbitmqModule],
  controllers: [TrafficController],
  providers: [TrafficService],
  exports: [TrafficService],
})
export class TrafficModule {}
