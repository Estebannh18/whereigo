// services/route-service/src/stops/stops.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StopsService } from './stops.service';
import { CreateStopDto } from './dto/create-stop.dto';
import { UpdateStopDto } from './dto/update-stop.dto';
import { Stop } from './entities/stop.entity';

@ApiTags('stops')
@Controller('stops')
export class StopsController {
  constructor(private readonly stopsService: StopsService) {}

  @Get('route/:routeId')
  @ApiOperation({ summary: 'Listar paraderos de una ruta' })
  findByRoute(@Param('routeId') routeId: string): Promise<Stop[]> {
    return this.stopsService.findByRoute(routeId);
  }

  @Post('route/:routeId')
  @ApiOperation({ summary: 'Agregar parada a una ruta' })
  create(@Param('routeId') routeId: string, @Body() dto: CreateStopDto): Promise<Stop> {
    return this.stopsService.create(routeId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parada' })
  update(@Param('id') id: string, @Body() dto: UpdateStopDto): Promise<Stop> {
    return this.stopsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar parada' })
  remove(@Param('id') id: string): Promise<void> {
    return this.stopsService.remove(id);
  }
}
