// services/traffic-service/src/traffic/traffic.controller.ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrafficService } from './traffic.service';
import { CreateTrafficReadingDto } from './dto/create-traffic-reading.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { TrafficQueryDto } from './dto/traffic-query.dto';

@ApiTags('traffic')
@Controller('traffic')
export class TrafficController {
  constructor(private readonly trafficService: TrafficService) {}

  @Get()
  @ApiOperation({ summary: 'Lista lecturas de tráfico ordenadas por fecha descendente' })
  findAll(@Query() query: TrafficQueryDto) {
    return this.trafficService.findAll(query.segmentId, query.limit, query.offset);
  }

  @Get('current')
  @ApiOperation({ summary: 'Devuelve la lectura más reciente por segmento' })
  findCurrent(@Query('segmentId') segmentId?: string) {
    return this.trafficService.findCurrent(segmentId);
  }

  @Get('incidents/active')
  @ApiOperation({ summary: 'Lista incidentes activos reportados' })
  findActiveIncidents() {
    return this.trafficService.findActiveIncidents();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Devuelve una lectura específica por ID' })
  findById(@Param('id') id: string) {
    return this.trafficService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Registra una nueva lectura de tráfico y emite eventos correspondientes' })
  create(@Body() dto: CreateTrafficReadingDto) {
    return this.trafficService.create(dto);
  }

  @Post('incident')
  @ApiOperation({ summary: 'Reporta un incidente en un segmento vial' })
  createIncident(@Body() dto: CreateIncidentDto) {
    return this.trafficService.createIncident(dto);
  }
}
