// services/alert-service/src/alerts/alerts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert, AlertSeverity, AlertType } from './entities/alert.entity';
import { AlertQueryDto } from './dto/alert-query.dto';

interface IncidentDetectedEvent {
  eventType: 'IncidentDetected';
  segmentId: string;
  latitude: number;
  longitude: number;
  incidentType: string;
  severity: string;
  detectedAt: string;
  emittedAt: string;
}

interface RouteAffectedEvent {
  eventType: 'RouteAffected';
  segmentId: string;
  latitude: number;
  longitude: number;
  congestionLevel: number;
  incidentType: string | null;
  reason: 'incident' | 'congestion';
  affectedAt: string;
  emittedAt: string;
}

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
  ) {}

  async findAll(query: AlertQueryDto): Promise<{ data: Alert[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (query.alertType) {
      where.alertType = query.alertType;
    }
    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [data, total] = await this.alertRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit,
      skip: query.offset,
    });

    return { data, total };
  }

  async findActive(): Promise<{ data: Alert[] }> {
    const data = await this.alertRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
    return { data };
  }

  async findById(id: string): Promise<Alert> {
    const alert = await this.alertRepository.findOne({ where: { id } });
    if (!alert) {
      throw new NotFoundException(`Alerta ${id} no encontrada.`);
    }
    return alert;
  }

  async resolve(id: string): Promise<Alert> {
    const alert = await this.findById(id);
    alert.isActive = false;
    alert.resolvedAt = new Date();
    return this.alertRepository.save(alert);
  }

  async createFromIncident(event: IncidentDetectedEvent): Promise<Alert> {
    const severity = this.mapSeverity(event.severity);
    const message = `Incidente reportado en ${event.segmentId}: ${this.translateIncidentType(event.incidentType)}. Severidad: ${severity}.`;

    const alert = this.alertRepository.create({
      segmentId: event.segmentId,
      latitude: event.latitude,
      longitude: event.longitude,
      alertType: AlertType.INCIDENT,
      message,
      severity,
      isActive: true,
      payload: event as unknown as Record<string, unknown>,
    });

    return (await this.alertRepository.save(alert)) as Alert;
  }

  async createFromRouteAffected(event: RouteAffectedEvent): Promise<Alert> {
    const severity = event.congestionLevel >= 80 ? AlertSeverity.HIGH : event.congestionLevel >= 60 ? AlertSeverity.MEDIUM : AlertSeverity.LOW;
    const message = `Ruta afectada en ${event.segmentId}. Congestión: ${event.congestionLevel}%. Motivo: ${event.reason === 'incident' ? 'incidente' : 'congestión'}.`;

    const alert = this.alertRepository.create({
      segmentId: event.segmentId,
      latitude: event.latitude,
      longitude: event.longitude,
      alertType: AlertType.ROUTE_AFFECTED,
      message,
      severity,
      isActive: true,
      payload: event as unknown as Record<string, unknown>,
    });

    return (await this.alertRepository.save(alert)) as Alert;
  }

  private mapSeverity(severity: string): AlertSeverity {
    switch (severity.toLowerCase()) {
      case 'high':
        return AlertSeverity.HIGH;
      case 'medium':
        return AlertSeverity.MEDIUM;
      case 'low':
      default:
        return AlertSeverity.LOW;
    }
  }

  private translateIncidentType(type: string): string {
    const map: Record<string, string> = {
      accident: 'accidente',
      blockade: 'bloqueo',
      construction: 'obra en vía',
      other: 'otro',
    };
    return map[type] ?? type;
  }
}
