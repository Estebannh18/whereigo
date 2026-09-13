// services/route-service/src/stops/dto/update-stop.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateStopDto } from './create-stop.dto';

export class UpdateStopDto extends PartialType(CreateStopDto) {}
