// services/route-service/src/stops/dto/create-stop.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateStopDto {
  @ApiProperty({ example: 'Parque Santander' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 7.1193 })
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -73.1227 })
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  stopOrder!: number;

  @ApiPropertyOptional({ example: 'Frente a la Catedral' })
  @IsString()
  @IsOptional()
  description?: string;
}
