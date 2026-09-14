// services/route-service/src/route-search/dto/route-search.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export enum RoutePreference {
  CHEAPEST = 'cheapest',
  FASTEST = 'fastest',
  FEWEST_TRANSFERS = 'fewest_transfers',
}

export class RouteSearchDto {
  @ApiProperty({ example: 7.1193 })
  @Transform(({ value }) => Number(value))
  @Type(() => Number)
  @IsNumber()
  originLat!: number;

  @ApiProperty({ example: -73.1227 })
  @Transform(({ value }) => Number(value))
  @Type(() => Number)
  @IsNumber()
  originLon!: number;

  @ApiProperty({ example: 7.1384 })
  @Transform(({ value }) => Number(value))
  @Type(() => Number)
  @IsNumber()
  destinationLat!: number;

  @ApiProperty({ example: -73.1205 })
  @Transform(({ value }) => Number(value))
  @Type(() => Number)
  @IsNumber()
  destinationLon!: number;

  @ApiPropertyOptional({ enum: RoutePreference, default: RoutePreference.FASTEST })
  @IsEnum(RoutePreference)
  @IsOptional()
  preference?: RoutePreference;

  @ApiPropertyOptional({ example: '2026-09-13T08:00:00' })
  @IsString()
  @IsOptional()
  departureTime?: string;
}
