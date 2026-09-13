// services/route-service/src/stops/stops.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stop } from './entities/stop.entity';
import { StopsService } from './stops.service';
import { StopsController } from './stops.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Stop])],
  controllers: [StopsController],
  providers: [StopsService],
  exports: [StopsService],
})
export class StopsModule {}
