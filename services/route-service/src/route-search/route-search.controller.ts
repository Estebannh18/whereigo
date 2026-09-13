// services/route-service/src/route-search/route-search.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RouteSearchService, RouteOption } from './route-search.service';
import { RouteSearchDto } from './dto/route-search.dto';

@ApiTags('route-search')
@Controller('route-search')
export class RouteSearchController {
  constructor(private readonly routeSearchService: RouteSearchService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar opciones de ruta entre origen y destino' })
  async search(@Query() dto: RouteSearchDto): Promise<RouteOption[]> {
    return this.routeSearchService.search(
      dto.originLat,
      dto.originLon,
      dto.destinationLat,
      dto.destinationLon,
      dto.preference,
    );
  }
}
