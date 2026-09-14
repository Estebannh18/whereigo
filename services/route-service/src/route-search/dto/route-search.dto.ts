// services/route-service/src/route-search/dto/route-search.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString } from 'class-validator';

export enum RoutePreference {
  CHEAPEST = 'cheapest',
  FASTEST = 'fastest',
  FEWEST_TRANSFERS = 'fewest_transfers',
}

export class RouteSearchDto {
  @ApiProperty({ example: 7.1193 })
  @Transform(({ value }) => value === undefined || value === '' ? value : Number(value))
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLatitude()
  originLat!: number;

  @ApiProperty({ example: -73.1227 })
  @Transform(({ value }) => value === undefined || value === '' ? value : Number(value))
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLongitude()
  originLon!: number;

  @ApiProperty({ example: 7.1384 })
  @Transform(({ value }) => value === undefined || value === '' ? value : Number(value))
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLatitude()
  destinationLat!: number;

  @ApiProperty({ example: -73.1205 })
  @Transform(({ value }) => value === undefined || value === '' ? value : Number(value))
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLongitude()
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
