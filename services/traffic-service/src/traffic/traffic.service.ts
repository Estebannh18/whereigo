// services/traffic-service/src/traffic/traffic.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Severity, TrafficReading } from './entities/traffic-reading.entity';
import { CreateTrafficReadingDto } from './dto/create-traffic-reading.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class TrafficService {
  constructor(
    @InjectRepository(TrafficReading)
    private readonly trafficRepository: Repository<TrafficReading>,
    private readonly rabbitmqService: RabbitmqService,
  ) {}

  async findAll(segmentId?: string, limit = 20, offset = 0): Promise<{ data: TrafficReading[]; total: number }> {
    const where = segmentId ? { segmentId } : {};
    const [data, total] = await this.trafficRepository.findAndCount({
      where,
      order: { recordedAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total };
  }

  async findCurrent(segmentId?: string): Promise<{ data: TrafficReading[] }> {
    // Devuelve la lectura más reciente por segmento.
    const qb = this.trafficRepository
      .createQueryBuilder('tr')
      .distinctOn(['tr.segmentId'])
      .orderBy('tr.segmentId', 'ASC')
      .addOrderBy('tr.recordedAt', 'DESC');

    if (segmentId) {
      qb.where('tr.segmentId = :segmentId', { segmentId });
    }

    const data = await qb.getMany();
    return { data };
  }

  async findById(id: string): Promise<TrafficReading> {
    const reading = await this.trafficRepository.findOne({ where: { id } });
    if (!reading) {
      throw new NotFoundException(`Lectura de tráfico ${id} no encontrada.`);
    }
    return reading;
  }

  async create(dto: CreateTrafficReadingDto): Promise<TrafficReading> {
    const reading = this.trafficRepository.create({
      ...dto,
      recordedAt: new Date(dto.recordedAt),
    });
    const saved = await this.trafficRepository.save(reading);

    await this.emitTrafficUpdated(saved);

    if (saved.hasIncident) {
      await this.emitIncidentDetected(saved);
    }

    if (saved.congestionLevel >= 70 || saved.hasIncident) {
      await this.emitRouteAffected(saved);
    }

    return saved;
  }

  async createIncident(dto: CreateIncidentDto): Promise<TrafficReading> {
    const dtoWithIncident: CreateTrafficReadingDto = {
      segmentId: dto.segmentId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      speedKmh: 5,
      congestionLevel: 95,
      isPeakHour: false,
      isRainy: false,
      hasIncident: true,
      incidentType: dto.incidentType,
      severity: (dto.severity ?? 'high') as Severity,
      recordedAt: dto.detectedAt ?? new Date().toISOString(),
    };

    return this.create(dtoWithIncident);
  }

  async findActiveIncidents(): Promise<{ data: TrafficReading[] }> {
    const data = await this.trafficRepository.find({
      where: { hasIncident: true },
      order: { recordedAt: 'DESC' },
    });
    return { data };
  }

  private async emitTrafficUpdated(reading: TrafficReading): Promise<void> {
    await this.rabbitmqService.publishEvent('traffic.updated', {
      eventType: 'TrafficUpdated',
      segmentId: reading.segmentId,
      latitude: Number(reading.latitude),
      longitude: Number(reading.longitude),
      speedKmh: Number(reading.speedKmh),
      congestionLevel: reading.congestionLevel,
      isPeakHour: reading.isPeakHour,
      isRainy: reading.isRainy,
      recordedAt: reading.recordedAt.toISOString(),
      emittedAt: new Date().toISOString(),
    });
  }

  private async emitIncidentDetected(reading: TrafficReading): Promise<void> {
    await this.rabbitmqService.publishEvent('traffic.incident.detected', {
      eventType: 'IncidentDetected',
      segmentId: reading.segmentId,
      latitude: Number(reading.latitude),
      longitude: Number(reading.longitude),
      incidentType: reading.incidentType ?? 'other',
      severity: reading.severity ?? 'medium',
      detectedAt: reading.recordedAt.toISOString(),
      emittedAt: new Date().toISOString(),
    });
  }

  private async emitRouteAffected(reading: TrafficReading): Promise<void> {
    await this.rabbitmqService.publishEvent('traffic.route.affected', {
      eventType: 'RouteAffected',
      segmentId: reading.segmentId,
      latitude: Number(reading.latitude),
      longitude: Number(reading.longitude),
      congestionLevel: reading.congestionLevel,
      incidentType: reading.incidentType ?? null,
      reason: reading.hasIncident ? 'incident' : 'congestion',
      affectedAt: reading.recordedAt.toISOString(),
      emittedAt: new Date().toISOString(),
    });
  }
}
