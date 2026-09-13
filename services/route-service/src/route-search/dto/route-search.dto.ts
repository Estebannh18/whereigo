// services/route-service/src/route-search/dto/route-search.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export enum RoutePreference {
  CHEAPEST = 'cheapest',
  FASTEST = 'fastest',
  FEWEST_TRANSFERS = 'fewest_transfers',
}

export class RouteSearchDto {
  @ApiProperty({ example: 7.1193 })
  @IsNumber({ maxDecimalPlaces: 8 })
  originLat!: number;

  @ApiProperty({ example: -73.1227 })
  @IsNumber({ maxDecimalPlaces: 8 })
  originLon!: number;

  @ApiProperty({ example: 7.1384 })
  @IsNumber({ maxDecimalPlaces: 8 })
  destinationLat!: number;

  @ApiProperty({ example: -73.1205 })
  @IsNumber({ maxDecimalPlaces: 8 })
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
