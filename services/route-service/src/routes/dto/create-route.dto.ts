// services/route-service/src/routes/dto/create-route.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RouteType } from '../entities/route.entity';
import { CreateStopDto } from '../../stops/dto/create-stop.dto';

export class CreateRouteDto {
  @ApiProperty({ example: 'Ruta Centro - UIS' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: RouteType, example: RouteType.BUS })
  @IsEnum(RouteType)
  type!: RouteType;

  @ApiProperty({ example: 2800, description: 'Tarifa base en COP' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseFare!: number;

  @ApiPropertyOptional({ example: 100, description: 'Tarifa por km adicional en COP' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  perKmRate?: number;

  @ApiProperty({ type: [CreateStopDto], description: 'Paraderos de la ruta ordenados' })
  @ValidateNested({ each: true })
  @Type(() => CreateStopDto)
  stops!: CreateStopDto[];
}
