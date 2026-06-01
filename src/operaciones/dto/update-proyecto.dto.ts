// src/operaciones/dto/update-proyecto.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { CreateProyectoDto } from './create-proyecto.dto';
import {
  Area,
  Prioridad,
  EstadoProyecto,
  Semaforo,
} from '@prisma/client';
import { IsString, IsOptional, IsEnum, IsNumber, Min, Max, IsDateString } from 'class-validator';

export class UpdateProyectoDto extends PartialType(CreateProyectoDto) {
  @IsOptional()
  @IsEnum(EstadoProyecto)
  estado?: EstadoProyecto;

  @IsOptional()
  @IsEnum(Semaforo)
  semaforo?: Semaforo;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  avance?: number; // Can be manually set, but usually calculated

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  avanceCalculado?: number; // Usually calculated
  
  @IsOptional()
  @IsDateString()
  fechaFinReal?: string; // Only available when project is finished
}
