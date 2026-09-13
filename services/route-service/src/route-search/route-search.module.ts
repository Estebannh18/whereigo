// services/route-service/src/route-search/route-search.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from '../routes/entities/route.entity';
import { Stop } from '../stops/entities/stop.entity';
import { RouteSearchService } from './route-search.service';
import { RouteSearchController } from './route-search.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Route, Stop])],
  controllers: [RouteSearchController],
  providers: [RouteSearchService],
})
export class RouteSearchModule {}
