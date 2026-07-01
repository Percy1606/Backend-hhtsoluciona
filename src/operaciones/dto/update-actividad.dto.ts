import { PartialType } from '@nestjs/mapped-types';
import { CreateActividadDto } from './create-actividad.dto';
import { IsOptional, IsString, Allow } from 'class-validator';

export class UpdateActividadDto extends PartialType(CreateActividadDto) {
  @Allow()
  userRole?: string;

  @Allow()
  responsableId?: string;

  @Allow()
  progreso?: number;
}
