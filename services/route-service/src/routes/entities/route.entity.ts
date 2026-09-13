// services/route-service/src/routes/entities/route.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Stop } from '../../stops/entities/stop.entity';

export enum RouteType {
  BUS = 'bus',
  TAXI = 'taxi',
  MIXED = 'mixed',
}

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: RouteType, default: RouteType.BUS })
  type!: RouteType;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'base_fare' })
  baseFare!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'per_km_rate', default: 0 })
  perKmRate!: number;

  @Column({ default: true })
  active!: boolean;

  @OneToMany(() => Stop, (stop) => stop.route, { cascade: true })
  stops!: Stop[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
