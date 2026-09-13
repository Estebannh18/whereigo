// services/alert-service/src/alerts/entities/alert.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AlertType {
  INCIDENT = 'incident',
  ROUTE_AFFECTED = 'route_affected',
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'segment_id' })
  segmentId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  latitude!: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  longitude!: number;

  @Column({ type: 'enum', enum: AlertType, name: 'alert_type' })
  alertType!: AlertType;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'enum', enum: AlertSeverity })
  severity!: AlertSeverity;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @Column({ type: 'timestamp', name: 'resolved_at', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'jsonb', nullable: true, name: 'payload' })
  payload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
