// services/route-service/src/routes/dto/update-route.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateRouteDto } from './create-route.dto';

export class UpdateRouteDto extends PartialType(CreateRouteDto) {}
