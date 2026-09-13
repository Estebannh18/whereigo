// services/traffic-service/src/traffic/entities/traffic-reading.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum IncidentType {
  ACCIDENT = 'accident',
  BLOCKADE = 'blockade',
  CONSTRUCTION = 'construction',
  OTHER = 'other',
}

export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

@Entity('traffic_readings')
export class TrafficReading {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'segment_id' })
  segmentId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  latitude!: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  longitude!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'speed_kmh' })
  speedKmh!: number;

  @Column({ type: 'int', name: 'congestion_level' })
  congestionLevel!: number;

  @Column({ type: 'boolean', name: 'is_peak_hour', default: false })
  isPeakHour!: boolean;

  @Column({ type: 'boolean', name: 'is_rainy', default: false })
  isRainy!: boolean;

  @Column({ type: 'boolean', name: 'has_incident', default: false })
  hasIncident!: boolean;

  @Column({
    type: 'enum',
    enum: IncidentType,
    nullable: true,
    name: 'incident_type',
  })
  incidentType!: IncidentType | null;

  @Column({ type: 'enum', enum: Severity, nullable: true })
  severity!: Severity | null;

  @Column({ type: 'timestamp', name: 'recorded_at' })
  recordedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
