// services/auth-service/src/users/entities/user.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

/** Prioridad de viaje que el motor de preferencias (Fase 3.3) usará por defecto. */
export enum TravelPriority {
  COST = 'cost',
  TIME = 'time',
  TRANSFERS = 'transfers',
}

@Entity('users')
export class User {
  // `!` (definite assignment): TypeORM asigna estos valores al hidratar la fila,
  // no en el constructor, por lo que TypeScript no puede inferirlo por sí solo.
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  // Nunca se expone tal cual: se excluye explícitamente al serializar (ver UsersService.toPublic).
  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  // Última preferencia de búsqueda elegida por el usuario (HU-03), usada como
  // valor por defecto en /routes/search cuando no se envía `priority` explícito.
  @Column({ type: 'enum', enum: TravelPriority, nullable: true, name: 'last_preference' })
  lastPreference!: TravelPriority | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
