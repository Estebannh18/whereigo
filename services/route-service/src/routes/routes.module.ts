// services/route-service/src/routes/routes.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from './entities/route.entity';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Route])],
  controllers: [RoutesController],
  providers: [RoutesService],
  exports: [RoutesService],
})
export class RoutesModule {}
