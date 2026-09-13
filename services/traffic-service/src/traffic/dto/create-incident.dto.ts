// services/traffic-service/src/traffic/dto/create-incident.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
} from 'class-validator';
import { IncidentType, Severity } from '../entities/traffic-reading.entity';

export class CreateIncidentDto {
  @ApiProperty({ example: 'seg-001' })
  @IsString()
  segmentId!: string;

  @ApiProperty({ example: 7.1186 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: -73.1165 })
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ enum: IncidentType, example: IncidentType.ACCIDENT })
  @IsEnum(IncidentType)
  incidentType!: IncidentType;

  @ApiPropertyOptional({ enum: Severity, example: Severity.HIGH })
  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @ApiPropertyOptional({ example: '2026-09-13T10:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  detectedAt?: string;
}
