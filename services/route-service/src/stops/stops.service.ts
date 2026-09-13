// services/route-service/src/stops/stops.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Stop } from './entities/stop.entity';
import { CreateStopDto } from './dto/create-stop.dto';
import { UpdateStopDto } from './dto/update-stop.dto';

@Injectable()
export class StopsService {
  constructor(
    @InjectRepository(Stop)
    private readonly stopRepository: Repository<Stop>,
  ) {}

  async findByRoute(routeId: string): Promise<Stop[]> {
    return this.stopRepository.find({
      where: { route: { id: routeId } },
      order: { stopOrder: 'ASC' },
    });
  }

  async create(routeId: string, dto: CreateStopDto): Promise<Stop> {
    const stop = this.stopRepository.create({
      ...dto,
      route: { id: routeId } as any,
    });
    return this.stopRepository.save(stop);
  }

  async update(id: string, dto: UpdateStopDto): Promise<Stop> {
    const stop = await this.stopRepository.findOne({ where: { id } });
    if (!stop) {
      throw new NotFoundException(`Parada con id ${id} no encontrada`);
    }
    Object.assign(stop, dto);
    return this.stopRepository.save(stop);
  }

  async remove(id: string): Promise<void> {
    const stop = await this.stopRepository.findOne({ where: { id } });
    if (!stop) {
      throw new NotFoundException(`Parada con id ${id} no encontrada`);
    }
    await this.stopRepository.remove(stop);
  }
}
