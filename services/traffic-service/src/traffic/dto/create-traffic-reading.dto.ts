// services/traffic-service/src/traffic/dto/create-traffic-reading.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { IncidentType, Severity } from '../entities/traffic-reading.entity';

export class CreateTrafficReadingDto {
  @ApiProperty({ example: 'seg-001' })
  @IsString()
  segmentId!: string;

  @ApiProperty({ example: 7.1186 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: -73.1165 })
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ example: 24.5, description: 'Velocidad promedio en km/h' })
  @IsNumber()
  @Min(0)
  speedKmh!: number;

  @ApiProperty({ example: 65, description: 'Nivel de congestión entre 0 y 100' })
  @IsInt()
  @Min(0)
  @Max(100)
  congestionLevel!: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPeakHour?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isRainy?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  hasIncident?: boolean;

  @ApiPropertyOptional({ enum: IncidentType })
  @IsOptional()
  @IsEnum(IncidentType)
  incidentType?: IncidentType;

  @ApiPropertyOptional({ enum: Severity })
  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @ApiProperty({ example: '2026-09-13T10:30:00.000Z' })
  @IsDateString()
  recordedAt!: string;
}
