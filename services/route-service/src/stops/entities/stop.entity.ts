// services/route-service/src/stops/entities/stop.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Route } from '../../routes/entities/route.entity';

@Entity('stops')
export class Stop {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  latitude!: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  longitude!: number;

  @Column({ name: 'stop_order' })
  stopOrder!: number;

  @Column({ nullable: true })
  description!: string | null;

  @ManyToOne(() => Route, (route) => route.stops, { onDelete: 'CASCADE' })
  route!: Route;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
