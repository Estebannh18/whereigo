// services/alert-service/src/alerts/dto/alert-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AlertSeverity, AlertType } from '../entities/alert.entity';

export class AlertQueryDto {
  @ApiPropertyOptional({ enum: AlertType })
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;

  @ApiPropertyOptional({ enum: AlertSeverity })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
