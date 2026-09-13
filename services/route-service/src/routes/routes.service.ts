// services/route-service/src/routes/routes.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route, RouteType } from './entities/route.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
  ) {}

  async create(dto: CreateRouteDto): Promise<Route> {
    const route = this.routeRepository.create({
      ...dto,
      stops: dto.stops.map((s, index) => ({
        ...s,
        stopOrder: s.stopOrder ?? index,
      })),
    });
    return this.routeRepository.save(route);
  }

  async findAll(type?: RouteType): Promise<Route[]> {
    const query = this.routeRepository.createQueryBuilder('route').leftJoinAndSelect('route.stops', 'stops').orderBy('stops.stopOrder', 'ASC');
    if (type) {
      query.where('route.type = :type', { type });
    }
    return query.getMany();
  }

  async findOne(id: string): Promise<Route> {
    const route = await this.routeRepository.findOne({
      where: { id },
      relations: ['stops'],
    });
    if (!route) {
      throw new NotFoundException(`Ruta con id ${id} no encontrada`);
    }
    route.stops.sort((a, b) => a.stopOrder - b.stopOrder);
    return route;
  }

  async update(id: string, dto: UpdateRouteDto): Promise<Route> {
    const route = await this.findOne(id);
    if (dto.stops) {
      // Simplificación: reemplazamos los stops existentes.
      route.stops = dto.stops.map((s, index) => ({
        ...s,
        stopOrder: s.stopOrder ?? index,
      })) as any;
    }
    Object.assign(route, dto);
    return this.routeRepository.save(route);
  }

  async remove(id: string): Promise<void> {
    const route = await this.findOne(id);
    await this.routeRepository.remove(route);
  }
}
