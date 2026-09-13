// services/alert-service/src/alerts/alerts.controller.ts
import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { AlertQueryDto } from './dto/alert-query.dto';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista alertas con filtros opcionales' })
  findAll(@Query() query: AlertQueryDto) {
    return this.alertsService.findAll(query);
  }

  @Get('active')
  @ApiOperation({ summary: 'Devuelve alertas activas' })
  findActive() {
    return this.alertsService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Devuelve una alerta por ID' })
  findById(@Param('id') id: string) {
    return this.alertsService.findById(id);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Marca una alerta como resuelta' })
  resolve(@Param('id') id: string) {
    return this.alertsService.resolve(id);
  }
}
