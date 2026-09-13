// services/route-service/src/routes/routes.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { Route, RouteType } from './entities/route.entity';

@ApiTags('routes')
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva ruta con sus paraderos' })
  create(@Body() dto: CreateRouteDto): Promise<Route> {
    return this.routesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar rutas' })
  @ApiQuery({ name: 'type', enum: RouteType, required: false })
  findAll(@Query('type') type?: RouteType): Promise<Route[]> {
    return this.routesService.findAll(type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una ruta por ID' })
  findOne(@Param('id') id: string): Promise<Route> {
    return this.routesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una ruta' })
  update(@Param('id') id: string, @Body() dto: UpdateRouteDto): Promise<Route> {
    return this.routesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una ruta' })
  remove(@Param('id') id: string): Promise<void> {
    return this.routesService.remove(id);
  }
}
