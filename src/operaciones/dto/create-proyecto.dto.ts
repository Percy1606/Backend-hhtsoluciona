// src/operaciones/dto/create-proyecto.dto.ts

import { Area, Prioridad, EstadoProyecto } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProyectoDto {
  @IsString()
  clientId: string;

  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsEnum(EstadoProyecto)
  estado: EstadoProyecto;

  @IsEnum(Prioridad)
  prioridad: Prioridad;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFinEstimada: string;

  @IsString()
  responsablePrincipalId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsablesAdicionales?: string[];

  @IsEnum(Area)
  area: Area;

  @IsString()
  cotizacionId: string;
}
